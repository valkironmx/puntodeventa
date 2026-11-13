import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any */
// App del teléfono sin internet: inicio de sesión con token, paquete de datos y sincronización.
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { asUser, errMsg, sql, type Tx } from './db'
import type { Ctx, Session } from './auth'
import { getTerms } from './terms'
import { getFeatures, modeDefaults } from './mode-defaults'
import type { Role } from './permissions'
import { ticketData } from './panel-data'
import { preorderEdit, quoteSchema, saleSchema, uuid, amount } from './sale-schemas'
import * as business from '@/app/actions/business'
import * as catalog from '@/app/actions/catalog'
import * as staff from '@/app/actions/staff'
import * as booking from '@/app/actions/booking'
import * as notifications from '@/app/actions/notifications'
import * as orders from '@/app/actions/orders'
import * as prefs from '@/app/actions/prefs'
import * as sales from '@/app/actions/sales'
import { changePasswordAction, deleteAccountAction } from '@/app/actions/auth'
import * as sec from './sections'

const hash = (t: string) => createHash('sha256').update(t).digest('hex')

export class MobileError extends Error { constructor(msg: string, public status = 400) { super(msg) } }

// La app del teléfono corre en https://localhost (Capacitor); en pruebas, en localhost con puerto
const okOrigin = (o: string) => /^(https?|capacitor):\/\/localhost(:\d+)?$/.test(o)
export function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? ''
  return {
    'access-control-allow-origin': okOrigin(o) ? o : 'https://localhost',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}
export function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(req) } })
}
export async function handle(req: Request, fn: () => Promise<unknown>) {
  try { return json(req, await fn()) } catch (e) {
    if (e instanceof MobileError) return json(req, { error: e.message }, e.status)
    if (e instanceof z.ZodError) return json(req, { error: e.issues[0]?.message ?? 'Datos inválidos' }, 400)
    return json(req, { error: errMsg(e) }, 400)
  }
}

/* ---------- Sesión ---------- */
export async function mobileLogin(email: string, password: string): Promise<string> {
  const e = email.toLowerCase().trim()
  const [{ n }] = await sql`select count(*)::int n from app_auth.login_attempts where email = ${e} and not ok and at > now() - interval '15 minutes'`
  if (n >= 8) throw new MobileError('Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.', 429)
  const [u] = await sql`select id from auth.users where email = ${e} and encrypted_password is not null and encrypted_password = extensions.crypt(${password}, encrypted_password)`
  await sql`insert into app_auth.login_attempts (email, ok) values (${e}, ${!!u})`
  if (!u) throw new MobileError('Correo o contraseña incorrectos', 401)
  await sql`delete from app_auth.login_attempts where email = ${e} and not ok`
  const [m] = await sql`select 1 from public.memberships where user_id = ${u.id} and active limit 1`
  if (!m) throw new MobileError('Esta cuenta no pertenece a un negocio. Usa la cuenta del negocio para la app.', 403)
  const token = randomBytes(32).toString('hex')
  // La app trabaja sin conexión: la sesión dura un año y se renueva en cada sincronización
  await sql`insert into app_auth.sessions (token_hash, user_id, expires_at, device_label) values (${hash(token)}, ${u.id}, now() + interval '365 days', 'App Android')`
  await sql`update auth.users set last_sign_in_at = now() where id = ${u.id}`
  return token
}

export async function mobileLogout(token: string) {
  await sql`delete from app_auth.sessions where token_hash = ${hash(token)}`
}

export function bearer(req: Request): string {
  const t = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!/^[a-f0-9]{64}$/.test(t)) throw new MobileError('Inicia sesión de nuevo', 401)
  return t
}

/** Igual que getCtx del panel, pero con el token de la app y sin redirecciones. */
export async function ctxFromToken(token: string): Promise<Ctx> {
  const [s] = await sql`update app_auth.sessions set expires_at = greatest(expires_at, now() + interval '365 days')
    where token_hash = ${hash(token)} and expires_at > now() returning id, user_id, acting_user_id, business_id, is_cash_device, device_label`
  if (!s) throw new MobileError('Tu sesión terminó. Inicia sesión de nuevo.', 401)
  const session: Session = { id: s.id, loginUserId: s.user_id, uid: s.acting_user_id ?? s.user_id, businessId: s.business_id, isCashDevice: s.is_cash_device, deviceLabel: s.device_label ?? 'App Android' }
  const uid = session.uid
  const mems = await sql`select id, business_id, role, display_name from public.memberships where user_id = ${uid} and active order by created_at`
  const mem = mems.find((m) => m.business_id === session.businessId) ?? mems[0]
  if (!mem) throw new MobileError('Tu cuenta ya no pertenece a un negocio', 403)
  const [business] = (await sql`select * from public.businesses where id = ${mem.business_id}`) as any[]
  if (!business) throw new MobileError('Negocio no encontrado', 404)
  if (business.status === 'suspendido') throw new MobileError('Este negocio está suspendido. Contacta a soporte.', 403)
  return {
    session, uid, isSuper: false, role: mem.role as Role, business,
    membership: { id: mem.id, display_name: mem.display_name },
    terms: getTerms(business), features: getFeatures(business),
    db: (fn) => asUser(uid, fn),
  }
}

/* ---------- Paquete de datos para trabajar sin conexión ---------- */
export async function snapshot(ctx: Ctx) {
  const b = ctx.business
  const md = modeDefaults(b)
  const [cats, products, preorders, sales, quotes, t] = await Promise.all([
    ctx.db((tx) => tx`select id, name from public.categories where business_id = ${b.id} order by position, name`),
    ctx.db((tx) => tx`select public.product_json(p.id, false) as p from public.products p where p.business_id = ${b.id} and p.active and p.deleted_at is null order by p.position, p.name`),
    ctx.db((tx) => tx`
      select s.id, s.folio, s.customer_name, s.customer_phone, s.order_type, s.delivery_at, s.delivered_at, s.status, s.total, s.paid_total, s.balance, s.notes, s.custom_fields,
        coalesce((select json_agg(json_build_object('title', i.title, 'qty', i.qty, 'sale_unit', i.sale_unit, 'notes', i.notes) order by i.created_at, i.id) from public.sale_items i where i.sale_id = s.id), '[]') as items,
        coalesce((select json_agg(json_build_object('id', p.id, 'amount', p.amount, 'method', p.method, 'note', p.note, 'date', p.created_at, 'initial', p.is_initial,
          'by', (select m.display_name from public.memberships m where m.business_id = s.business_id and m.user_id = p.received_by limit 1)) order by p.created_at) from public.payments p where p.sale_id = s.id), '[]') as payments
      from public.sales s
      where s.business_id = ${b.id} and s.source = 'encargo' and (s.delivered_at is null or s.balance > 0 or s.delivery_at > now() - interval '30 days')
      order by s.delivery_at desc limit 300`),
    ctx.role === 'cashier' ? Promise.resolve([]) : ctx.db((tx) => tx`
      select s.id, s.folio, s.source, s.customer_name, s.status, s.subtotal, s.tax, s.total, s.paid_total, s.balance, s.created_at, s.delivery_at, s.cash_received, s.change_given,
        coalesce((select json_agg(json_build_object('title', i.title, 'qty', i.qty, 'unit_price', i.unit_price, 'list_price', i.list_price, 'line_total', i.line_total, 'sale_unit', i.sale_unit,
          'opts', coalesce((select json_agg(o->>'label') from jsonb_array_elements(i.options) o), '[]'), 'notes', i.notes) order by i.created_at, i.id) from public.sale_items i where i.sale_id = s.id), '[]') as items,
        coalesce((select json_agg(json_build_object('id', p.id, 'amount', p.amount, 'method', p.method, 'note', p.note, 'date', p.created_at, 'initial', p.is_initial) order by p.created_at) from public.payments p where p.sale_id = s.id), '[]') as payments
      from public.sales s where s.business_id = ${b.id} and s.created_at > now() - interval '60 days'
      order by s.created_at desc limit 200`),
    ctx.role === 'cashier' ? Promise.resolve([]) : ctx.db((tx) => tx`
      select q.id, q.folio, q.client_name, q.client_phone, q.status, q.subtotal, q.tax, q.total, q.valid_days, q.expires_at, q.created_at, q.notes,
        coalesce((select json_agg(json_build_object('title', i.title, 'description', i.description, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total, 'sale_unit', i.sale_unit) order by i.position) from public.quote_items i where i.quote_id = q.id), '[]') as items
      from public.quotes q where q.business_id = ${b.id} and q.deleted_at is null and q.created_at > now() - interval '90 days'
      order by q.created_at desc limit 100`),
    ticketData(ctx),
  ])
  const num = (v: unknown) => (v == null ? null : String(v))
  return {
    at: new Date().toISOString(),
    user: { name: ctx.membership?.display_name ?? '', role: ctx.role },
    device: ctx.session.deviceLabel || 'App Android',
    business: { id: b.id, name: b.name, slug: b.slug, mode: b.mode, accent: b.accent_color, logo: b.logo_path, catalogWord: ctx.terms.catalog, itemWord: ctx.terms.item,
      planName: b.is_master ? 'Maestro' : ((await sql`select name from public.plans where code = ${b.plan}`)[0]?.name ?? b.plan), domain: process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'tuapp.com' },
    unread: (await ctx.db((tx) => tx`select public.unread_notifications(${b.id}) as n`))[0].n as number,
    pos: {
      products: products.map((r) => r.p), cats: cats.map((c) => ({ id: c.id, name: c.name })), rate: Number(b.tax_rate), orderTypes: md.orderTypes, mode: b.mode,
      globalMode: b.tax_mode_global, fieldSuggestions: b.features?.custom_field_labels ?? md.customFields, searchPh: `Buscar ${ctx.terms.item}...`,
    },
    ticket: { ...t, business: { name: b.name, logo: b.logo_path ? `/storage/${b.logo_path}` : null } },
    pages: await buildPages(ctx),
    booking: !!ctx.features.booking,
    canQuote: ctx.role !== 'cashier',
    preorders: preorders.map((r) => ({
      id: r.id, folio: r.folio, customer: r.customer_name ?? 'Cliente', phone: r.customer_phone, orderType: r.order_type, deliveryAt: r.delivery_at.toISOString(),
      deliveredAt: r.delivered_at ? r.delivered_at.toISOString() : null, status: r.status, total: num(r.total), paid: num(r.paid_total), balance: num(r.balance), notes: r.notes,
      fields: r.custom_fields ?? [], items: r.items, payments: r.payments.map((p: any) => ({ ...p, amount: String(p.amount), by: p.by ?? undefined })),
    })),
    sales: sales.map((s) => ({
      id: s.id, folio: s.folio, source: s.source, customer: s.customer_name, status: s.status, subtotal: num(s.subtotal), tax: num(s.tax), total: num(s.total), paid: num(s.paid_total),
      balance: num(s.balance), date: s.created_at.toISOString(), deliveryAt: s.delivery_at ? s.delivery_at.toISOString() : null, cashReceived: num(s.cash_received), change: num(s.change_given),
      items: s.items.map((i: any) => ({ ...i, qty: String(i.qty), unit_price: String(i.unit_price), list_price: i.list_price == null ? null : String(i.list_price), line_total: String(i.line_total) })),
      payments: s.payments.map((p: any) => ({ ...p, amount: String(p.amount) })),
    })),
    quotes: quotes.map((q) => ({
      id: q.id, folio: q.folio, client: q.client_name, phone: q.client_phone, status: q.status, subtotal: num(q.subtotal), tax: num(q.tax), total: num(q.total),
      validDays: q.valid_days, expires: q.expires_at ? new Date(q.expires_at).toISOString().slice(0, 10) : null, date: q.created_at.toISOString(), notes: q.notes,
      items: q.items.map((i: any) => ({ ...i, qty: String(i.qty), unit_price: String(i.unit_price), line_total: String(i.line_total) })),
    })),
  }
}

/* ---------- Todas las secciones del panel, para verlas y editarlas sin conexión ---------- */
async function all<T>(keys: string[], fn: (k: string) => Promise<T>): Promise<Record<string, T>> {
  const out: Record<string, T> = {}
  for (let i = 0; i < keys.length; i += 6) {
    const part = keys.slice(i, i + 6)
    const vals = await Promise.all(part.map((k) => fn(k).catch(() => null as T)))
    part.forEach((k, j) => { if (vals[j] != null) out[k] = vals[j] })
  }
  return out
}

export async function buildPages(ctx: Ctx): Promise<Record<string, unknown>> {
  const b = ctx.business
  const manager = ctx.role !== 'cashier'
  const pages: Record<string, unknown> = {}
  const set = (k: string, v: unknown) => { if (v != null) pages[k] = v }
  set('notificaciones', await sec.loadNotifications(ctx))
  set('cuenta', await sec.loadAccount(ctx))
  Object.assign(pages, await all(sec.ORDER_FILTERS.map((f) => `pedidos-web:${f}`), (k) => sec.loadWebOrders(ctx, k.split(':')[1])))
  if (ctx.features.booking) {
    const ap = await sec.loadAppointments(ctx, undefined, undefined)
    Object.assign(pages, await all(ap.days.map((d) => `citas:${d.d}`), (k) => sec.loadAppointments(ctx, k.split(':')[1], undefined)))
    const ids = new Set<string>()
    for (const k of Object.keys(pages)) if (k.startsWith('citas:')) for (const a of [...(pages[k] as any).pending, ...(pages[k] as any).agenda]) ids.add(a.id)
    Object.assign(pages, await all([...ids].map((id) => `cita:${id}`), (k) => sec.loadAppointment(ctx, k.split(':')[1])))
    if (manager) { set('cita-nueva', await sec.loadNewAppointment(ctx)); set('citas-ajustes', await sec.loadBookingSettings(ctx)) }
  }
  if (!manager) return pages
  const [home, corte, catalogo, categorias, promociones, personalizar, qr, ticket, empleados, ajustes, qp] = await Promise.all([
    sec.loadHome(ctx), sec.loadCashCut(ctx), sec.loadCatalog(ctx), sec.loadCategories(ctx), sec.loadPromotions(ctx), sec.loadCustomize(ctx),
    sec.loadQr(ctx), sec.loadTicket(ctx), sec.loadStaff(ctx), sec.loadSettings(ctx), sec.loadQuoteProducts(ctx),
  ])
  Object.assign(pages, { home, corte, catalogo, categorias, promociones, personalizar, qr, ticket, empleados, ajustes, 'cotizacion-productos': qp })
  Object.assign(pages, await all(sec.QUOTE_FILTERS.map(([f]) => `cotizaciones:${f}`), (k) => sec.loadQuotes(ctx, k.split(':')[1])))
  const quoteIds = (pages['cotizaciones:todas'] as any)?.rows.slice(0, 60).map((q: any) => q.id) ?? []
  Object.assign(pages, await all(quoteIds.map((id: string) => `cotizacion:${id}`), (k) => sec.loadQuote(ctx, k.split(':')[1])))
  Object.assign(pages, await all(['nuevo', ...catalogo.products.map((p) => p.id)].map((id) => `producto:${id}`), (k) => sec.loadProduct(ctx, k.split(':')[1])))
  const saleIds = await ctx.db((tx) => tx`(select id from public.sales where business_id = ${b.id} order by created_at desc limit 40)
    union (select id from public.sales where business_id = ${b.id} and balance > 0 and status <> 'cancelled' order by created_at desc limit 30)`)
  Object.assign(pages, await all(saleIds.map((r) => `venta:${r.id}`), (k) => sec.loadSale(ctx, k.split(':')[1])))
  return pages
}

/* ---------- Operaciones hechas sin conexión ---------- */
const opSchema = z.object({ id: uuid, kind: z.enum(['sale', 'payment', 'delivered', 'preorder_update', 'quote', 'convert_quote', 'action']), payload: z.record(z.string(), z.unknown()), at: z.string().optional() })
export const opsSchema = z.array(opSchema).max(500)
export type Op = z.infer<typeof opSchema>
const ref = z.object({ sale_id: uuid.optional(), sale_client_id: uuid.optional() })

async function resolveSale(tx: Tx, p: z.infer<typeof ref>): Promise<string> {
  if (p.sale_id) return p.sale_id
  if (p.sale_client_id) {
    const [r] = await tx`select result->>'sale_id' as id from public.mobile_ops where client_id = ${p.sale_client_id}`
    if (r?.id) return r.id
  }
  throw new Error('La venta de este movimiento todavía no se sube')
}

async function runOp(ctx: Ctx, op: Op, tx: Tx): Promise<Record<string, unknown>> {
  const b = ctx.business
  switch (op.kind) {
    case 'sale': {
      const d = saleSchema.parse({ appointment_id: null, table_label: null, ...op.payload })
      if (!d.extra && d.payments.length === 0) throw new Error('Indica cómo te pagan')
      const [open] = await tx`select id from public.cash_sessions where business_id = ${b.id} and closed_at is null`
      if (!open) await tx`select public.open_cash_session(${b.id}, 0, ${ctx.session.deviceLabel || 'App Android'})`
      const [r] = await tx`select public.register_pos_sale(${b.id}, ${JSON.stringify(d.items)}::text::jsonb, ${JSON.stringify(d.payments)}::text::jsonb,
        ${d.cash_received}, ${d.customer_name}, ${d.order_type}, ${d.table_label}, ${null}, ${d.extra ? JSON.stringify(d.extra) : null}::text::jsonb) as r`
      return r.r
    }
    case 'payment': {
      const p = ref.extend({ amount, method: z.enum(['cash', 'card', 'transfer']), note: z.string().max(120).default('') }).parse(op.payload)
      const id = await resolveSale(tx, p)
      const [r] = await tx`select public.add_payment(${id}, ${p.amount}, ${p.method}, ${p.note}) as r`
      return { sale_id: id, ...r.r }
    }
    case 'delivered': {
      const p = ref.extend({ delivered: z.boolean() }).parse(op.payload)
      const id = await resolveSale(tx, p)
      await tx`select public.set_preorder_delivered(${id}, ${p.delivered})`
      return { sale_id: id }
    }
    case 'preorder_update': {
      const p = ref.extend({ data: preorderEdit }).parse(op.payload)
      const id = await resolveSale(tx, p)
      await tx`select public.update_preorder(${id}, ${JSON.stringify(p.data)}::text::jsonb)`
      return { sale_id: id }
    }
    case 'quote': {
      if (ctx.role === 'cashier') throw new Error('Tu rol no puede hacer cotizaciones')
      const d = quoteSchema.parse(op.payload)
      const [r] = await tx`select public.save_quote(${b.id}, ${null}, ${JSON.stringify(d)}::text::jsonb) as id`
      return { quote_id: r.id }
    }
    case 'convert_quote': {
      const p = z.object({ quote_id: uuid.optional(), quote_client_id: uuid.optional() }).parse(op.payload)
      let qid = p.quote_id
      if (!qid && p.quote_client_id) qid = (await tx`select result->>'quote_id' as id from public.mobile_ops where client_id = ${p.quote_client_id}`)[0]?.id
      if (!qid) throw new Error('La cotización todavía no se sube')
      const [r] = await tx`select public.convert_quote_to_sale(${qid}, ${null}::jsonb) as r`
      return r.r
    }
  }
  throw new Error('Operación desconocida')
}

/* ---------- Acciones del panel (mismas funciones que usa la web) ---------- */
const ACTIONS: Record<string, Record<string, unknown>> = {
  business, catalog, staff, booking, notifications, orders, prefs, sales, auth: { changePasswordAction, deleteAccountAction },
}
// Las del público (página del negocio) no se llaman desde la app
const BLOCKED = new Set(['publicSlotsAction', 'requestAppointmentAction', 'cancelPublicAppointmentAction', 'requestOrderAction', 'publicOrderAction'])
const actionSchema = z.object({ mod: z.string().regex(/^[a-z]+$/), fn: z.string().regex(/^[a-zA-Z]+Action$/), args: z.array(z.unknown()).max(10) })

function revive(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(revive)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.__formData)) { const fd = new FormData(); for (const [k, val] of o.__formData as [string, string][]) fd.append(k, val); return fd }
    return Object.fromEntries(Object.entries(o).map(([k, val]) => [k, revive(val)]))
  }
  return v
}

/** Ejecuta una acción del panel como el usuario del token (getSession lee el encabezado Authorization). */
export async function callAction(payload: unknown): Promise<unknown> {
  const { mod, fn, args } = actionSchema.parse(payload)
  const f = ACTIONS[mod]?.[fn]
  if (typeof f !== 'function' || BLOCKED.has(fn)) throw new Error('Acción no disponible en la app')
  try {
    const r = await (f as (...a: unknown[]) => Promise<unknown>)(...(revive(args) as unknown[]))
    if (r && typeof r === 'object' && 'ok' in r && (r as { ok: boolean }).ok === false) throw new Error((r as { error?: string }).error ?? 'No se pudo completar')
    return r ?? null
  } catch (e) {
    // redirect() de Next al terminar una acción: la acción sí se completó
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')) return { redirected: true }
    throw e
  }
}

export async function applyOps(ctx: Ctx, ops: Op[]) {
  const results: { id: string; ok: boolean; data?: unknown; error?: string }[] = []
  for (const op of ops) {
    if (op.kind === 'action') {
      try {
        const [done] = await sql`select result from public.mobile_ops where client_id = ${op.id}`
        const data = done ? done.result : await callAction(op.payload)
        if (!done) await sql`insert into public.mobile_ops (client_id, user_id, business_id, kind, result) values (${op.id}, ${ctx.uid}, ${ctx.business.id}, 'action', ${JSON.stringify(data ?? null)}::text::jsonb) on conflict do nothing`
        results.push({ id: op.id, ok: true, data })
      } catch (e) {
        results.push({ id: op.id, ok: false, error: e instanceof z.ZodError ? e.issues[0]?.message ?? 'Datos inválidos' : errMsg(e) })
      }
      continue
    }
    try {
      const data = await ctx.db(async (tx) => {
        const [done] = await tx`select result from public.mobile_ops where client_id = ${op.id}`
        if (done) return done.result
        const r = await runOp(ctx, op, tx)
        await tx`insert into public.mobile_ops (client_id, user_id, business_id, kind, result) values (${op.id}, ${ctx.uid}, ${ctx.business.id}, ${op.kind}, ${JSON.stringify(r)}::text::jsonb)`
        return r
      })
      results.push({ id: op.id, ok: true, data })
    } catch (e) {
      results.push({ id: op.id, ok: false, error: e instanceof z.ZodError ? e.issues[0]?.message ?? 'Datos inválidos' : errMsg(e) })
    }
  }
  return results
}
