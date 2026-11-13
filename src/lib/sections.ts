import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any */
// Datos de cada sección del panel. Los usan las páginas web y el paquete de la app del teléfono (sin conexión),
// así ambas pintan exactamente el mismo diseño (src/sections/views.tsx).
import type { Ctx } from './auth'
import { sql } from './db'
import { addDays, appDomain, appUrl, dayParts, fmtDate, fmtDateTime, fmtPlainDate, fmtTime, storageUrl, ymd } from './format'
import { fillTemplate } from './appt'
import { DEFAULT_SCHEDULE } from './hours'
import { modeDefaults } from './mode-defaults'
import { ticketData } from './panel-data'
import { canDelete, canManage, canManageStaff, ROLE_LABEL } from './permissions'
import { quoteProducts } from './quote-data'

const memberNames = (businessId: string) => sql`select user_id, display_name from public.memberships where business_id = ${businessId}`

export async function loadHome(ctx: Ctx) {
  const b = ctx.business
  const [{ n: pending }] = await ctx.db((tx) => tx`select count(*)::int n from public.appointments where business_id = ${b.id} and status = 'pending'`)
  const [{ n: orders }] = await ctx.db((tx) => tx`select count(*)::int n from public.order_requests where business_id = ${b.id} and status = 'pending'`)
  return {
    name: b.name as string, slug: b.slug as string, logo: storageUrl(b.logo_path), hero: storageUrl(b.hero_path), domain: appDomain(),
    userName: ctx.membership?.display_name ?? 'Super Admin', isSuper: ctx.role === 'super', catalogWord: ctx.terms.catalog, booking: !!ctx.features.booking,
    pending: pending as number, orders: orders as number,
  }
}

export async function loadNotifications(ctx: Ctx) {
  const [r] = await ctx.db((tx) => tx`select public.my_notifications(${ctx.business.id}) as list`)
  return { back: ctx.role === 'cashier' ? '/app/pos' : '/app', items: r.list }
}

export async function loadCashCut(ctx: Ctx) {
  const b = ctx.business
  const [open] = await ctx.db((tx) => tx`select id, device_label, opened_by, opened_at, opening_float from public.cash_sessions where business_id = ${b.id} and closed_at is null`)
  const names = await memberNames(b.id)
  const who = (u: string | null) => names.find((n) => n.user_id === u)?.display_name ?? '—'
  let summary = null, moves: { type: string; amount: string; reason: string | null }[] = []
  if (open) {
    summary = (await ctx.db((tx) => tx`select public.cash_session_summary(${open.id}) as s`))[0].s
    moves = (await ctx.db((tx) => tx`select type, amount, reason from public.cash_movements where cash_session_id = ${open.id} order by created_at`)).map((m) => ({ type: m.type, amount: m.amount, reason: m.reason }))
  }
  const history = await ctx.db((tx) => tx`select id, closed_at, closed_by, expected_cash, counted_cash, difference from public.cash_sessions where business_id = ${b.id} and closed_at is not null order by closed_at desc limit 20`)
  return {
    session: open ? { id: open.id as string, device: open.device_label as string, by: who(open.opened_by), at: fmtDateTime(open.opened_at) } : null,
    summary, moves, canClose: ctx.role !== 'super', businessName: b.name as string,
    history: history.map((h) => ({ id: h.id as string, closed: fmtDateTime(h.closed_at), by: who(h.closed_by), diff: Number(h.difference), expected: h.expected_cash as string, counted: h.counted_cash as string })),
  }
}

export async function loadCatalog(ctx: Ctx) {
  const b = ctx.business
  const [cats, products] = await ctx.db(async (tx) => [
    await tx`select id, name from public.categories where business_id = ${b.id} order by position, name`,
    await tx`select p.id, p.name, p.emoji, p.price, p.sale_price, p.sale_unit, p.category_id, p.track_stock, p.stock, p.show_in_catalog, p.active, p.kind,
        (select path from public.product_images i where i.product_id = p.id order by position limit 1) as img,
        (select coalesce(sum(o.stock), 0) from public.product_options o join public.product_option_groups g on g.id = o.group_id where g.product_id = p.id and o.track_stock) as var_stock,
        exists (select 1 from public.product_options o join public.product_option_groups g on g.id = o.group_id where g.product_id = p.id and o.track_stock) as has_var
      from public.products p where p.business_id = ${b.id} and p.deleted_at is null order by p.position, p.name`,
  ] as const)
  return {
    terms: ctx.terms, cats: cats.map((c) => ({ id: c.id as string, name: c.name as string })),
    products: products.map((p) => ({ id: p.id as string, name: p.name as string, emoji: p.emoji, price: p.price, sale_price: p.sale_price, unit: p.sale_unit, cat: p.category_id,
      track: p.track_stock, stock: p.has_var ? String(p.var_stock) : p.stock, pub: p.show_in_catalog, active: p.active, img: p.img })),
  }
}

export async function loadProduct(ctx: Ctx, id: string) {
  const b = ctx.business
  const cats = await ctx.db((tx) => tx`select id, name from public.categories where business_id = ${b.id} order by position, name`)
  let product = null
  if (id !== 'nuevo') {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null
    const [r] = await ctx.db((tx) => tx`select public.product_json(${id}, false) as p from public.products where id = ${id} and business_id = ${b.id} and deleted_at is null`)
    if (!r) return null
    const [raw] = await ctx.db((tx) => tx`select tax_mode from public.products where id = ${id}`)
    product = { ...r.p, tax_mode: raw.tax_mode }
  }
  const md = modeDefaults(b)
  return {
    product, cats: cats.map((c) => ({ id: c.id as string, name: c.name as string })), terms: ctx.terms, features: ctx.features, mode: b.mode as string, businessId: b.id as string,
    units: md.units, suggested: (b.features?.custom_field_labels ?? md.customFields) as string[], tax: { mode: b.tax_mode_global, rate: Number(b.tax_rate) }, canDelete: canDelete(ctx.role),
  }
}

export async function loadCategories(ctx: Ctx) {
  const cats = await ctx.db((tx) => tx`select c.id, c.name, c.visible, (select count(*)::int from public.products p where p.category_id = c.id and p.deleted_at is null) as n
    from public.categories c where c.business_id = ${ctx.business.id} order by c.position, c.name`)
  return { cats: cats.map((c) => ({ id: c.id as string, name: c.name as string, visible: c.visible as boolean, n: c.n as number })), canDelete: canDelete(ctx.role), items: ctx.terms.items }
}

export async function loadPromotions(ctx: Ctx) {
  const b = ctx.business
  const [promos, products] = await ctx.db(async (tx) => [
    await tx`select id, title, description, image_path, button_label, product_id, active from public.promotions where business_id = ${b.id} order by position, created_at`,
    await tx`select id, name from public.products where business_id = ${b.id} and active and show_in_catalog and deleted_at is null order by name`,
  ] as const)
  return {
    businessId: b.id as string, canDelete: canDelete(ctx.role), item: ctx.terms.item,
    promos: promos.map((p) => ({ id: p.id, title: p.title, description: p.description, image_path: p.image_path, button_label: p.button_label, product_id: p.product_id, active: p.active })),
    products: products.map((p) => ({ id: p.id as string, name: p.name as string })),
  }
}

export async function loadCustomize(ctx: Ctx) {
  const b = ctx.business
  return {
    availableTypes: modeDefaults(b).orderTypes, booking: !!ctx.features.booking, catalogWord: ctx.terms.catalog,
    b: {
      id: b.id, name: b.name, tagline: b.tagline ?? '', logo_path: b.logo_path, hero_path: b.hero_path, hero_focal_x: b.hero_focal_x, hero_focal_y: b.hero_focal_y,
      hero_title: b.hero_title ?? '', hero_text: b.hero_text ?? '', hero_button: b.hero_button ?? '', hero_action: b.hero_action, hero_links: b.hero_links ?? { show: [], custom: null },
      order_types: b.order_types?.length ? b.order_types : modeDefaults(b).orderTypes,
      accent_color: b.accent_color, accent_auto: b.accent_auto, address: b.address ?? '', maps_url: b.maps_url ?? '',
      lat: b.lat === null ? null : Number(b.lat), lng: b.lng === null ? null : Number(b.lng),
      contact: b.contact ?? {}, schedule: b.schedule?.length ? b.schedule : DEFAULT_SCHEDULE,
    },
  }
}

export async function loadQr(ctx: Ctx) {
  const b = ctx.business
  const [qr] = await ctx.db((tx) => tx`select id, code, destination_type, destination_url, scans_count from public.qr_codes where business_id = ${b.id} and active and deleted_at is null order by created_at desc limit 1`)
  return {
    qr: qr ? { id: qr.id as string, code: qr.code as string, type: qr.destination_type as string, url: qr.destination_url as string | null, scans: qr.scans_count as number } : null,
    base: appUrl(), domain: appDomain(), slug: b.slug as string, hasWhatsapp: !!(b.contact?.whatsapp || b.phone), catalogWord: ctx.terms.catalogLower,
  }
}

export async function loadTicket(ctx: Ctx) {
  return { t: await ticketData(ctx), cashier: ctx.membership?.display_name ?? '', device: ctx.session.deviceLabel }
}

export async function loadStaff(ctx: Ctx) {
  const b = ctx.business
  // Correos e invitaciones pendientes: solo con service role en el servidor
  const rows = await sql`select m.id, m.display_name, m.role, m.active, m.pin_hash is not null as has_pin, u.email, u.encrypted_password is null as pending, (select token from app_auth.invites i where i.user_id = u.id) as invite_token
    from public.memberships m join auth.users u on u.id = m.user_id where m.business_id = ${b.id} order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.display_name`
  const [plan] = await sql`select name, max_employees from public.plans where code = ${b.plan}`
  const owner = canManageStaff(ctx.role)
  return {
    sub: b.is_master ? 'Panel maestro: sin límite de empleados' : `Plan ${plan?.name ?? b.plan}: hasta ${plan?.max_employees ?? '—'} empleados`,
    canEdit: owner, cashDevice: !!ctx.session.isCashDevice,
    staff: rows.map((r) => ({ id: r.id as string, name: r.display_name as string, role: r.role as string, active: r.active as boolean, hasPin: r.has_pin as boolean, email: r.email as string,
      invite: owner && r.pending && r.invite_token ? `/invitacion/${r.invite_token}` : null })),
  }
}

export async function loadSettings(ctx: Ctx) {
  const b = ctx.business
  return {
    taxSub: `IVA ${Number(b.tax_rate)}% · ${b.tax_mode_global === 'included' ? 'incluido en precios' : 'se suma al precio'}`,
    booking: !!ctx.features.booking, mode: b.mode as string, features: ctx.features,
    tax: { mode: b.tax_mode_global as 'included' | 'plus', rate: Number(b.tax_rate) },
    labels: (b.features?.custom_field_labels ?? modeDefaults(b).customFields) as string[], item: ctx.terms.item,
  }
}

export async function loadAccount(ctx: Ctx) {
  const [u] = await sql`select email from auth.users where id = ${ctx.uid}`
  const [prev] = await ctx.db((tx) => tx`select public.account_deletion_preview() as p`)
  return {
    back: ctx.role === 'cashier' ? '/app/pos' : '/app', email: u.email as string, name: ctx.membership?.display_name ?? 'Super Admin', role: ROLE_LABEL[ctx.role],
    preview: prev.p, cashMode: ctx.session.uid !== ctx.session.loginUserId,
  }
}

export { QUOTE_FILTERS } from './quote-status'
export async function loadQuotes(ctx: Ctx, f: string) {
  const rows = await ctx.db((tx) => tx`select id, folio, client_name, status, total, expires_at, deleted_at from public.quotes where business_id = ${ctx.business.id}
    and case when ${f} = 'papelera' then deleted_at is not null else deleted_at is null and (${f} = 'todas' or status = ${f}) end order by created_at desc limit 200`)
  return {
    f, hint: ctx.terms.quoteHint,
    rows: rows.map((q) => ({ id: q.id as string, folio: q.folio as number, client: q.client_name as string | null, status: q.status as string, total: q.total as string, expires: q.expires_at ? fmtPlainDate(q.expires_at) : '' })),
  }
}

export async function loadQuote(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const b = ctx.business
  const [q] = await ctx.db((tx) => tx`select * from public.quotes where id = ${id} and business_id = ${b.id}`)
  if (!q) return null
  const items = await ctx.db((tx) => tx`select product_id, title, description, unit_price, qty, sale_unit, line_total from public.quote_items where quote_id = ${id} order by position`)
  const mapped = items.map((i) => ({ product_id: i.product_id as string | null, title: i.title as string, description: (i.description ?? '') as string, unit_price: String(Number(i.unit_price)), qty: String(Number(i.qty)), sale_unit: i.sale_unit as string, line_total: i.line_total as string }))
  return {
    folio: q.folio as number, client: q.client_name as string | null, editable: q.status !== 'converted' && !q.deleted_at, rate: Number(b.tax_rate), canDelete: canDelete(ctx.role),
    business: { name: b.name as string, logo: storageUrl(b.logo_path), address: b.address as string | null, phone: (b.contact?.whatsapp ?? b.phone) as string | null, accent: b.accent_color as string },
    q: { id: q.id as string, folio: q.folio as number, status: q.status as string, client_name: q.client_name, client_phone: q.client_phone, client_email: q.client_email, issued: fmtPlainDate(q.issued_at), expires: q.expires_at ? fmtPlainDate(q.expires_at) : '',
      valid_days: q.valid_days as number, plus: q.prices_plus_tax as boolean, custom_fields: q.custom_fields ?? [], notes: q.notes, subtotal: q.subtotal, tax: q.tax, total: q.total, sale_id: q.converted_sale_id, deleted: !!q.deleted_at },
    edit: { id: q.id as string, client_name: q.client_name ?? '', client_phone: q.client_phone ?? '', client_email: q.client_email ?? '', status: q.status as string, valid_days: q.valid_days as number,
      prices_plus_tax: q.prices_plus_tax as boolean, custom_fields: q.custom_fields ?? [], notes: q.notes ?? '', items: mapped },
    items: mapped,
  }
}

export async function loadQuoteProducts(ctx: Ctx) {
  return { products: await quoteProducts(ctx), rate: Number(ctx.business.tax_rate) }
}

export async function loadSale(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const b = ctx.business
  const [sale] = await ctx.db((tx) => tx`select s.*, q.folio as quote_folio from public.sales s left join public.quotes q on q.id = s.quote_id where s.id = ${id} and s.business_id = ${b.id}`)
  if (!sale) return null
  const items = await ctx.db((tx) => tx`select title, qty, unit_price, list_price, line_total, sale_unit, options, notes from public.sale_items where sale_id = ${id} order by created_at, id`)
  const pays = await ctx.db((tx) => tx`select id, amount, method, note, received_by, created_at, is_initial from public.payments where sale_id = ${id} order by created_at`)
  const names = await memberNames(b.id)
  const who = (u: string | null) => names.find((n) => n.user_id === u)?.display_name ?? '—'
  const md = modeDefaults(b)
  return {
    title: `Venta ${String(sale.folio).padStart(4, '0')}`, folio: sale.folio as number, sub: (sale.customer_name ?? 'Venta de mostrador') as string,
    sale: { id: sale.id as string, folio: sale.folio as number, status: sale.status as string, source: sale.source as string, quoteFolio: sale.quote_folio as number | null, customer: sale.customer_name as string | null,
      subtotal: sale.subtotal as string, tax: sale.tax as string, total: sale.total as string, paid: sale.paid_total as string, balance: sale.balance as string, date: (sale.created_at as Date).toISOString(),
      delivery_at: sale.delivery_at ? (sale.delivery_at as Date).toISOString() : null, delivered_at: sale.delivered_at ? (sale.delivered_at as Date).toISOString() : null,
      phone: sale.customer_phone as string | null, notes: sale.notes as string | null, fields: (sale.custom_fields ?? []) as { label: string; value: string }[], order_type: sale.order_type as string,
      cash_received: sale.cash_received as string | null, change: sale.change_given as string | null, cashier: who(sale.created_by) },
    items: items.map((i) => ({ title: i.title as string, qty: i.qty as string, unit_price: i.unit_price as string, list_price: i.list_price as string | null, line_total: i.line_total as string, sale_unit: i.sale_unit as string,
      opts: ((i.options ?? []) as { label: string }[]).map((o) => o.label), notes: i.notes as string | null })),
    payments: pays.map((p) => ({ id: p.id as string, amount: p.amount as string, method: p.method as string, note: p.note as string | null, by: who(p.received_by), date: (p.created_at as Date).toISOString(), initial: p.is_initial as boolean })),
    ticket: await ticketData(ctx), canCancel: canDelete(ctx.role), device: ctx.session.deviceLabel,
    orderTypes: md.orderTypes, fieldSuggestions: (b.features?.custom_field_labels ?? md.customFields) as string[],
  }
}

export const ORDER_FILTERS = ['pending', 'confirmed', 'done', 'all']
export async function loadWebOrders(ctx: Ctx, f: string) {
  const b = ctx.business
  const rows = await ctx.db((tx) => tx`select id, folio, customer_name, order_type, address, items, total, status, reject_reason, created_at
    from public.order_requests where business_id = ${b.id}
      and (${f} = 'all' or status = ${f} or (${f} = 'done' and status in ('completed','rejected','cancelled')))
    order by created_at desc limit 200`)
  const [{ n }] = await ctx.db((tx) => tx`select count(*)::int n from public.order_requests where business_id = ${b.id} and status = 'pending'`)
  return {
    f, pending: n as number, service: b.mode === 'service',
    rows: rows.map((r) => ({ id: r.id as string, folio: r.folio as number, name: r.customer_name as string, type: r.order_type as string, address: r.address as string | null, items: r.items, total: r.total as string,
      status: r.status as string, reason: r.reject_reason as string | null, at: fmtDateTime(r.created_at) })),
  }
}

/* ---------- Citas (modo servicios) ---------- */
const staffWithSchedule = (businessId: string) => sql`select m.id, m.display_name from public.memberships m where m.business_id = ${businessId} and m.active
  and exists (select 1 from public.staff_schedules s where s.membership_id = m.id) order by m.display_name`

export async function loadAppointments(ctx: Ctx, d: string | undefined, p: string | undefined) {
  const b = ctx.business
  const today = ymd()
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today
  const manage = canManage(ctx.role)
  const staff = await staffWithSchedule(b.id)
  const person = manage && p && staff.some((s) => s.id === p) ? p : null
  const start = addDays(today, -1)
  const [settings] = await ctx.db((tx) => tx`select reminder_template from public.booking_settings where business_id = ${b.id}`)
  // RLS: el empleado solo recibe sus propias citas
  const rows = await ctx.db((tx) => tx`select a.id, a.status, a.starts_at, a.ends_at, a.price, a.customer_name, a.customer_phone, a.created_at, a.source, a.public_token, a.membership_id,
      p.name as service, p.duration_min, m.display_name as staff, (a.starts_at at time zone 'America/Mexico_City')::date::text as day
    from public.appointments a left join public.products p on p.id = a.product_id join public.memberships m on m.id = a.membership_id
    where a.business_id = ${b.id} and (a.status = 'pending' or (a.starts_at at time zone 'America/Mexico_City')::date between ${start}::date and ${addDays(today, 6)}::date)
    order by a.starts_at`)
  const mine = rows.filter((r) => !person || r.membership_id === person)
  const map = (r: (typeof rows)[number]) => ({
    id: r.id as string, status: r.status as string, time: fmtTime(r.starts_at), startsAt: (r.starts_at as Date).toISOString(), service: (r.service ?? 'Servicio') as string, dur: r.duration_min as number | null,
    price: r.price as string, customer: r.customer_name as string, phone: r.customer_phone as string | null, created: (r.created_at as Date).toISOString(), source: r.source as string, staff: r.staff as string,
    dayLabel: dayParts(r.day).long,
    reminder: fillTemplate(settings?.reminder_template ?? '', { cliente: r.customer_name, 'día': dayParts(r.day).long, hora: fmtTime(r.starts_at), servicio: r.service ?? '', negocio: b.name, link: `${appUrl()}/${b.slug}/cita/${r.public_token}` }),
  })
  return {
    today, day, person, manage, businessName: b.name as string,
    days: Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((x) => ({ d: x, ...dayParts(x), n: rows.filter((r) => r.day === x && ['pending', 'confirmed'].includes(r.status)).length })),
    staff: staff.map((s) => ({ id: s.id as string, name: s.display_name as string })),
    pending: mine.filter((r) => r.status === 'pending').map(map), agenda: mine.filter((r) => r.day === day && r.status !== 'pending').map(map),
  }
}

export async function loadAppointment(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  const b = ctx.business
  const [a] = await ctx.db((tx) => tx`select a.*, p.name as service, p.duration_min, m.display_name as staff from public.appointments a
    left join public.products p on p.id = a.product_id join public.memberships m on m.id = a.membership_id where a.id = ${id} and a.business_id = ${b.id}`)
  if (!a) return null
  const events = await ctx.db((tx) => tx`select type, created_by, created_at from public.appointment_events where appointment_id = ${id} order by created_at`)
  const names = await memberNames(b.id)
  const [bs] = await ctx.db((tx) => tx`select reminder_template, approvers from public.booking_settings where business_id = ${b.id}`)
  const staff = await staffWithSchedule(b.id)
  const day = ymd(a.starts_at)
  const manage = canManage(ctx.role)
  const vars = { cliente: a.customer_name, 'día': dayParts(day).long, hora: fmtTime(a.starts_at), servicio: a.service ?? '', negocio: b.name, link: `${appUrl()}/${b.slug}/cita/${a.public_token}` }
  return {
    day, manage, canDecide: manage || (bs?.approvers === 'owner_admin_assignee' && a.membership_id === ctx.membership?.id), canPos: ctx.role !== 'super',
    a: { id: a.id as string, status: a.status as string, day, dayLabel: dayParts(day).long, time: fmtTime(a.starts_at), service: (a.service ?? 'Servicio') as string, dur: a.duration_min as number | null, price: a.price as string,
      customer: a.customer_name as string, phone: a.customer_phone as string | null, notes: a.notes as string | null, staff: a.staff as string, membershipId: a.membership_id as string, productId: a.product_id as string | null,
      source: a.source as string, rejectReason: a.reject_reason as string | null, saleId: a.sale_id as string | null },
    events: events.map((e) => ({ type: e.type as string, at: fmtDateTime(e.created_at), by: names.find((n) => n.user_id === e.created_by)?.display_name ?? (e.created_by ? '—' : 'Cliente / sistema') })),
    staff: staff.map((s) => ({ id: s.id as string, name: s.display_name as string })),
    messages: {
      confirm: `Hola ${a.customer_name}, tu cita en ${b.name} quedó CONFIRMADA: ${a.service} el ${vars['día']} a las ${vars.hora}. Detalles: ${vars.link}`,
      reject: `Hola ${a.customer_name}, no podemos atender tu solicitud de ${a.service} el ${vars['día']} a las ${vars.hora}. Puedes elegir otro horario: ${appUrl()}/${b.slug}/agendar`,
      remind: fillTemplate(bs?.reminder_template ?? '', vars),
    },
  }
}

export async function loadNewAppointment(ctx: Ctx) {
  const b = ctx.business
  const services = await ctx.db((tx) => tx`select id, name, emoji, duration_min, coalesce(sale_price, price) as price from public.products where business_id = ${b.id} and kind = 'service' and active and deleted_at is null order by position, name`)
  const staff = await staffWithSchedule(b.id)
  return {
    services: services.map((s) => ({ id: s.id as string, name: s.name as string, emoji: s.emoji as string | null, dur: (s.duration_min ?? 30) as number, price: s.price as string })),
    staff: staff.map((s) => ({ id: s.id as string, name: s.display_name as string })),
  }
}

export async function loadBookingSettings(ctx: Ctx) {
  const b = ctx.business
  const [s] = await ctx.db((tx) => tx`select * from public.booking_settings where business_id = ${b.id}`)
  if (!s) return null
  const members = await sql`select id, display_name from public.memberships where business_id = ${b.id} and active order by display_name`
  const sched = await ctx.db((tx) => tx`select membership_id, weekday, start_time::text, end_time::text, break_start::text, break_end::text, enabled from public.staff_schedules where business_id = ${b.id}`)
  const blocks = await ctx.db((tx) => tx`select k.id, k.starts_at, k.reason, m.display_name from public.schedule_blocks k left join public.memberships m on m.id = k.membership_id where k.business_id = ${b.id} and k.ends_at > now() order by k.starts_at`)
  const t = (v: string | null) => (v ? v.slice(0, 5) : null)
  return {
    canDelete: canDelete(ctx.role),
    s: { online_enabled: s.online_enabled, requires_approval: s.requires_approval, approvers: s.approvers, approval_timeout_min: s.approval_timeout_min, slot_interval_min: s.slot_interval_min,
      min_notice_min: s.min_notice_min, max_days_ahead: s.max_days_ahead, cancel_until_min: s.cancel_until_min, buffer_min: s.buffer_min, reminder_24h: s.reminder_24h, reminder_2h: s.reminder_2h, reminder_template: s.reminder_template ?? '' },
    members: members.map((m) => ({ id: m.id as string, name: m.display_name as string, days: sched.filter((x) => x.membership_id === m.id).map((x) => ({ weekday: x.weekday as number, enabled: x.enabled as boolean, start: t(x.start_time)!, end: t(x.end_time)!, breakStart: t(x.break_start), breakEnd: t(x.break_end) })) })),
    blocks: blocks.map((k) => ({ id: k.id as string, label: `${fmtDate(k.starts_at)} · ${k.display_name ?? 'Todo el negocio'} · ${k.reason ?? ''}` })),
  }
}
