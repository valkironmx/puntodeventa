/* eslint-disable @typescript-eslint/no-explicit-any */
// App del teléfono: datos guardados en el dispositivo, cola de lo hecho sin conexión y sincronización.
import { calcLine, sumLines, type TaxMode } from '@/lib/tax'
import { fromCents, toCents } from '@/lib/money'
import { applyAction } from './local-actions'

declare const __SERVER__: string

export type OpKind = 'sale' | 'payment' | 'delivered' | 'preorder_update' | 'quote' | 'convert_quote' | 'action'
export interface Op { id: string; kind: OpKind; payload: Record<string, any>; at: string; meta?: Record<string, any> }
export type Snapshot = any

interface State {
  ready: boolean
  server: string; token: string | null
  snap: Snapshot | null
  outbox: Op[]; failed: Record<string, string>
  lastSync: string | null; syncing: boolean; online: boolean; authError: boolean
  imgs: Record<string, string>
}

/* ---------- IndexedDB mínimo ---------- */
const DB = 'tuapp-offline', STORE = 'kv'
let dbp: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((ok, fail) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => fail(r.error)
  }))
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((ok, fail) => { const t = d.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error) })
}
const get = <T>(k: string) => idb<T | undefined>('readonly', (s) => s.get(k) as IDBRequest<T | undefined>)
const put = (k: string, v: unknown) => idb('readwrite', (s) => s.put(v, k))
const del = (k: string) => idb('readwrite', (s) => s.delete(k))
async function allImgs(): Promise<Record<string, string>> {
  const d = await db()
  return new Promise((ok) => {
    const out: Record<string, string> = {}
    const c = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
    c.onsuccess = () => { const cur = c.result; if (!cur) return ok(out); const k = String(cur.key); if (k.startsWith('img:')) out[k.slice(4)] = cur.value as string; cur.continue() }
    c.onerror = () => ok(out)
  })
}

/* ---------- Estado y suscripción (para useSyncExternalStore) ---------- */
let state: State = {
  ready: false, server: (typeof __SERVER__ !== 'undefined' ? __SERVER__ : '').replace(/\/$/, ''), token: null, snap: null,
  outbox: [], failed: {}, lastSync: null, syncing: false, online: typeof navigator === 'undefined' ? true : navigator.onLine, authError: false, imgs: {},
}
// Última copia recibida del servidor; lo que se ve = base + movimientos pendientes
let base: Snapshot | null = null
const subs = new Set<() => void>()
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const getState = () => state
function set(p: Partial<State>) { state = { ...state, ...p }; subs.forEach((f) => f()) }

;(globalThis as any).__storageUrl = (p: string) => state.imgs[p] ?? (state.server ? `${state.server}/storage/${p}` : `/storage/${p}`)

// Las llamadas del panel a /api/... (subir fotos) van al servidor con la sesión de la app
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch
if (typeof window !== 'undefined') {
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === '/api/upload' && init?.method === 'POST' && init.body instanceof FormData) return uploadOrKeep(init.body)
    if (typeof url === 'string' && /^\/(api|storage)\//.test(url)) {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      if (state.token && url.startsWith('/api/')) headers.set('authorization', `Bearer ${state.token}`)
      return nativeFetch(`${state.server}${url}`, { ...init, headers })
    }
    return nativeFetch(input as RequestInfo, init)
  }
}

export const lastResults: Record<string, unknown> = {}

/* ---------- Fotos sin conexión: se guardan en el teléfono y se suben al sincronizar ---------- */
const toDataUrl = (b: Blob) => new Promise<string>((ok, fail) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.onerror = () => fail(f.error); f.readAsDataURL(b) })
async function uploadOrKeep(fd: FormData): Promise<Response> {
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } })
  try {
    const r = await nativeFetch(`${state.server}/api/upload`, { method: 'POST', body: fd, headers: state.token ? { authorization: `Bearer ${state.token}` } : {} })
    set({ online: true })
    return r
  } catch {
    set({ online: false })
    const file = fd.get('file')
    if (!(file instanceof Blob)) return json({ error: 'Archivo no válido' }, 400)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp'
    const path = `pendiente/${crypto.randomUUID()}.${ext}`
    const dataUrl = await toDataUrl(file)
    await put(`upload:${path}`, { dataUrl, type: file.type, kind: String(fd.get('kind') ?? 'product'), business_id: String(fd.get('business_id') ?? '') })
    await put(`img:${path}`, dataUrl)
    set({ imgs: { ...state.imgs, [path]: dataUrl } })
    return json({ path })
  }
}
async function flushUploads() {
  const d = await db()
  const keys = await new Promise<string[]>((ok) => { const q = d.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys(); q.onsuccess = () => ok((q.result as IDBValidKey[]).map(String).filter((k) => k.startsWith('upload:'))); q.onerror = () => ok([]) })
  for (const key of keys) {
    const temp = key.slice(7)
    const u = await get<{ dataUrl: string; type: string; kind: string; business_id: string }>(key)
    if (!u) continue
    const blob = await (await nativeFetch(u.dataUrl)).blob()
    const fd = new FormData()
    fd.set('file', new File([blob], 'img', { type: u.type })); fd.set('kind', u.kind); fd.set('business_id', u.business_id)
    const r = await nativeFetch(`${state.server}/api/upload`, { method: 'POST', body: fd, headers: { authorization: `Bearer ${state.token}` } })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { const e = new Error(j.error ?? 'No se pudo subir una foto'); (e as any).status = r.status; throw e }
    // La foto ya tiene su ruta real: se reemplaza en todo lo pendiente
    const outbox = JSON.parse(JSON.stringify(state.outbox).split(temp).join(j.path))
    set({ outbox, imgs: { ...state.imgs, [j.path]: u.dataUrl } })
    await Promise.all([put(`img:${j.path}`, u.dataUrl), del(key), put('outbox', outbox)])
  }
}

export async function callNow(payload: { mod: string; fn: string; args: unknown[] }) {
  try {
    const d = await api('/api/mobile/call', { method: 'POST', body: JSON.stringify(payload) }, 20_000)
    set({ online: true })
    return d.data
  } catch (e) {
    if (isNetErr(e)) { set({ online: false }); throw new Error('Necesitas conexión para esto') }
    throw e
  }
}

export async function removeOp(id: string) {
  const failed = { ...state.failed }; delete failed[id]
  set({ outbox: state.outbox.filter((o) => o.id !== id), failed })
  reapply()
  await saveData()
}

export async function boot() {
  const cfg = (await get<{ server: string; token: string | null; lastSync: string | null }>('cfg')) ?? null
  const [snap, outbox, failed, imgs] = await Promise.all([get('snap'), get<Op[]>('outbox'), get<Record<string, string>>('failed'), allImgs()])
  base = snap ?? null
  set({ ready: true, server: (cfg?.token && cfg.server) || state.server, token: cfg?.token ?? null, lastSync: cfg?.lastSync ?? null, snap: snap ?? null, outbox: outbox ?? [], failed: failed ?? {}, imgs })
  reapply()
  window.addEventListener('online', () => { set({ online: true }); void sync() })
  window.addEventListener('offline', () => set({ online: false }))
  setInterval(() => { if (state.token && (state.outbox.length || Date.now() - new Date(state.lastSync ?? 0).getTime() > 5 * 60_000)) void sync() }, 45_000)
  if (state.token) void sync()
}
const saveCfg = () => put('cfg', { server: state.server, token: state.token, lastSync: state.lastSync })
const saveData = () => Promise.all([put('snap', base), put('outbox', state.outbox), put('failed', state.failed)])

/* ---------- Red ---------- */
async function api(path: string, init: RequestInit = {}, timeout = 25_000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout)
  try {
    const r = await nativeFetch(`${state.server}${path}`, { ...init, signal: ctl.signal, headers: { 'content-type': 'application/json', ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...(init.headers ?? {}) } })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) { const e = new Error(data.error ?? 'No se pudo completar'); (e as any).status = r.status; throw e }
    return data
  } finally { clearTimeout(t) }
}
const isNetErr = (e: unknown) => !(e as any)?.status

export async function login(server: string, email: string, password: string): Promise<string | null> {
  const s = server.trim().replace(/\/$/, '')
  if (!/^https?:\/\/\S+$/.test(s)) return 'No se pudo conectar. Revisa tu internet.'
  set({ server: s })
  try {
    const d = await api('/api/mobile/login', { method: 'POST', body: JSON.stringify({ email, password }) }, 40_000)
    // Si había una sesión de otro negocio, se descarta lo que no se subió de esa sesión
    const same = state.snap?.business?.id === d.snapshot.business.id
    base = d.snapshot
    set({ token: d.token, snap: d.snapshot, lastSync: new Date().toISOString(), online: true, authError: false, outbox: same ? state.outbox : [], failed: same ? state.failed : {} })
    reapply()
    await Promise.all([saveCfg(), saveData()])
    void cacheImages()
    if (state.outbox.length) void sync()
    return null
  } catch (e) {
    return isNetErr(e) ? 'Sin conexión con el servidor. Para iniciar sesión necesitas internet (solo esta vez).' : (e as Error).message
  }
}

export async function logout() {
  if (state.outbox.length && !confirm(`Hay ${state.outbox.length} movimiento(s) sin subir. Si cierras sesión se pierden. ¿Cerrar sesión de todos modos?`)) return
  try { await api('/api/mobile/logout', { method: 'POST', body: '{}' }, 8000) } catch { /* sin conexión: igual se cierra aquí */ }
  base = null
  set({ token: null, snap: null, outbox: [], failed: {}, lastSync: null })
  await Promise.all([saveCfg(), del('snap'), del('outbox'), del('failed')])
}

let syncP: Promise<void> | null = null
export function sync(): Promise<void> {
  if (!state.token) return Promise.resolve()
  return (syncP ??= (async () => {
    set({ syncing: true })
    try {
      await flushUploads()
      const sending = state.outbox.map(({ id, kind, payload, at }) => ({ id, kind, payload, at }))
      const d = sending.length
        ? await api('/api/mobile/sync', { method: 'POST', body: JSON.stringify({ ops: sending }) }, 60_000)
        : { results: [], snapshot: await api('/api/mobile/snapshot') }
      const okIds = new Set<string>(d.results.filter((r: any) => r.ok).map((r: any) => r.id))
      for (const r of d.results) if (r.ok) lastResults[r.id] = r.data
      const failed: Record<string, string> = {}
      for (const r of d.results) if (!r.ok) failed[r.id] = r.error
      // Lo que se hizo mientras se sincronizaba se queda en la cola
      const outbox = state.outbox.filter((o) => !okIds.has(o.id))
      base = d.snapshot
      set({ snap: d.snapshot, outbox, failed, lastSync: new Date().toISOString(), online: true, authError: false })
      reapply()
      await Promise.all([saveCfg(), saveData()])
      void cacheImages()
    } catch (e) {
      if ((e as any)?.status === 401) set({ authError: true })
      else if (isNetErr(e)) set({ online: false })
    } finally { set({ syncing: false }); syncP = null }
  })())
}
let debounce: ReturnType<typeof setTimeout> | null = null
const soon = () => { if (debounce) clearTimeout(debounce); debounce = setTimeout(() => void sync(), 1200) }

/* ---------- Imágenes para usarse sin conexión ---------- */
let caching = false
async function cacheImages() {
  if (caching || !state.snap) return
  caching = true
  try {
    const paths = new Set<string>()
    for (const p of state.snap.pos.products) for (const i of p.images ?? []) paths.add(i)
    if (state.snap.business.logo) paths.add(state.snap.business.logo)
    // Fotos de todas las secciones (logo, portada, promociones, catálogo)
    const scan = (v: unknown) => {
      if (typeof v === 'string') { if (/^(product-images|business-assets)\/[\w/-]+\.(webp|jpe?g|png)$/i.test(v)) paths.add(v); else { const m = /^\/storage\/(.+)$/.exec(v); if (m) paths.add(m[1]) } }
      else if (Array.isArray(v)) v.forEach(scan)
      else if (v && typeof v === 'object') Object.values(v).forEach(scan)
    }
    scan(state.snap.pages)
    const imgs = { ...state.imgs }
    for (const p of paths) {
      if (imgs[p]) continue
      try {
        const r = await nativeFetch(`${state.server}/storage/${p}`)
        if (!r.ok) continue
        const blob = await r.blob()
        const url = await new Promise<string>((ok, fail) => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.onerror = () => fail(f.error); f.readAsDataURL(blob) })
        imgs[p] = url
        await put(`img:${p}`, url)
      } catch { break } // sin conexión: se intenta en la próxima sincronización
    }
    set({ imgs })
  } finally { caching = false }
}

/* ---------- Cambios locales (se aplican al guardar y se vuelven a aplicar tras sincronizar) ---------- */
const uid = () => crypto.randomUUID()
const money = (c: number) => fromCents(c)
const nowIso = () => new Date().toISOString()

function findRecords(snap: Snapshot, ref: { sale_id?: string; sale_client_id?: string }) {
  const id = ref.sale_id ?? `local:${ref.sale_client_id}`
  return [snap.preorders?.find((r: any) => r.id === id), snap.sales?.find((r: any) => r.id === id)].filter(Boolean)
}
// Detalle de venta (mismo diseño del panel): también refleja abonos y entregas hechos sin conexión
function salePage(snap: Snapshot, ref: { sale_id?: string }) {
  return ref.sale_id ? snap.pages?.[`venta:${ref.sale_id}`] : null
}

function applyLocal(snap: Snapshot, op: Op) {
  const m = op.meta ?? {}
  switch (op.kind) {
    case 'sale': {
      const p = op.payload
      const paid = p.payments.reduce((a: number, x: any) => a + toCents(x.amount), 0)
      const total = toCents(m.total)
      const pays = p.payments.map((x: any, i: number) => ({ id: `${op.id}-${i}`, amount: x.amount, method: x.method, note: null, date: op.at, initial: true, by: m.user }))
      const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending'
      const id = `local:${op.id}`
      if (p.extra?.preorder) {
        snap.preorders = [{ id, folio: 0, customer: p.customer_name ?? 'Cliente', phone: p.extra.phone || null, orderType: p.order_type, deliveryAt: p.extra.delivery_at, deliveredAt: null, status,
          total: m.total, paid: money(paid), balance: money(Math.max(0, total - paid)), notes: p.extra.notes || null, fields: p.extra.custom_fields ?? [],
          items: m.items.map((i: any) => ({ title: i.title, qty: i.qty, sale_unit: i.sale_unit, notes: i.notes })), payments: pays, pending: true }, ...(snap.preorders ?? [])]
      }
      snap.sales = [{ id, folio: 0, source: p.extra?.preorder ? 'encargo' : 'pos', customer: p.customer_name, status, subtotal: m.subtotal, tax: m.tax, total: m.total, paid: money(Math.min(paid, total)),
        balance: money(Math.max(0, total - paid)), date: op.at, deliveryAt: p.extra?.delivery_at ?? null, cashReceived: p.cash_received, change: m.change, items: m.items, payments: pays, pending: true }, ...(snap.sales ?? [])]
      break
    }
    case 'payment': {
      for (const r of findRecords(snap, op.payload)) {
        const bal = Math.max(0, toCents(r.balance) - toCents(op.payload.amount))
        r.paid = money(toCents(r.paid) + toCents(op.payload.amount)); r.balance = money(bal); r.status = bal === 0 ? 'paid' : 'partial'
        r.payments = [...(r.payments ?? []), { id: op.id, amount: op.payload.amount, method: op.payload.method, note: op.payload.note || null, date: op.at, initial: false, by: m.user }]
        r.pending = true
      }
      const sp = salePage(snap, op.payload)
      if (sp) {
        const bal = Math.max(0, toCents(sp.sale.balance) - toCents(op.payload.amount))
        sp.sale = { ...sp.sale, paid: money(toCents(sp.sale.paid) + toCents(op.payload.amount)), balance: money(bal), status: bal === 0 ? 'paid' : 'partial' }
        sp.payments = [...sp.payments, { id: op.id, amount: op.payload.amount, method: op.payload.method, note: op.payload.note || null, by: m.user ?? '', date: op.at, initial: false }]
      }
      break
    }
    case 'delivered':
      for (const r of findRecords(snap, op.payload)) { r.deliveredAt = op.payload.delivered ? op.at : null; r.pending = true }
      { const sp = salePage(snap, op.payload); if (sp) sp.sale = { ...sp.sale, delivered_at: op.payload.delivered ? op.at : null } }
      break
    case 'preorder_update':
      for (const r of findRecords(snap, op.payload)) {
        const d = op.payload.data
        Object.assign(r, { customer: d.customer_name, phone: d.phone || null, deliveryAt: d.delivery_at, orderType: d.order_type ?? r.orderType, notes: d.notes || null, fields: d.custom_fields, pending: true })
      }
      break
    case 'quote': {
      const q = op.payload
      snap.quotes = [{ id: `local:${op.id}`, folio: 0, client: q.client_name || null, phone: q.client_phone || null, status: 'pending', subtotal: m.subtotal, tax: m.tax, total: m.total,
        validDays: q.valid_days, expires: null, date: op.at, notes: q.notes || null, items: m.items, pending: true }, ...(snap.quotes ?? [])]
      break
    }
    case 'action':
      applyAction(snap, op.payload.fn, op.payload.args ?? [], { id: op.id, at: op.at, user: m.user })
      break
    case 'convert_quote': {
      const id = op.payload.quote_id ?? `local:${op.payload.quote_client_id}`
      const q = snap.quotes?.find((x: any) => x.id === id)
      if (!q) break
      q.status = 'converted'; q.pending = true
      snap.sales = [{ id: `local:${op.id}`, folio: 0, source: 'quote', customer: q.client, status: 'pending', subtotal: q.subtotal, tax: q.tax, total: q.total, paid: '0.00', balance: q.total,
        date: op.at, deliveryAt: null, cashReceived: null, change: null, items: q.items.map((i: any) => ({ ...i, opts: [], list_price: null })), payments: [], pending: true }, ...(snap.sales ?? [])]
      break
    }
  }
}
function reapply() {
  if (!base) return
  const snap = structuredClone(base)
  for (const op of state.outbox) { try { applyLocal(snap, op) } catch { /* dato viejo */ } }
  set({ snap })
}

export async function enqueue(kind: OpKind, payload: Record<string, any>, meta?: Record<string, any>): Promise<Op> {
  const op: Op = { id: uid(), kind, payload, at: nowIso(), meta: { user: state.snap?.user?.name, ...meta } }
  const snap = structuredClone(state.snap)
  applyLocal(snap, op)
  set({ snap, outbox: [...state.outbox, op] })
  await saveData()
  soon()
  return op
}

export async function discard(id: string) {
  if (!confirm('¿Descartar este movimiento? No se subirá al sistema.')) return
  const failed = { ...state.failed }; delete failed[id]
  set({ outbox: state.outbox.filter((o) => o.id !== id), failed })
  await saveData()
  void sync()
}

/* ---------- Cálculos locales (los mismos del servidor) ---------- */
export function saleTotals(items: { product_id: string | null; unit_price?: string; unit_override?: string; qty: string; title?: string; notes?: string; option_ids?: string[] }[]) {
  const snap = state.snap
  const rate = Number(snap.pos.rate)
  const lines = items.map((it) => {
    const p = snap.pos.products.find((x: any) => x.id === it.product_id)
    const mode: TaxMode = p?.tax_mode ?? snap.pos.globalMode
    const unit = toCents(it.unit_override ?? it.unit_price ?? '0')
    const opts = p ? p.groups.flatMap((g: any) => g.options.filter((o: any) => it.option_ids?.includes(o.id)).map((o: any) => o.label)) : []
    const listCents = it.unit_override !== undefined && p ? toCents(p.sale_price ?? p.price) + p.groups.flatMap((g: any) => g.options.filter((o: any) => it.option_ids?.includes(o.id))).reduce((a: number, o: any) => a + toCents(o.price_delta), 0) : null
    const c = calcLine(unit, Number(it.qty), mode, rate)
    return { c, item: { title: it.title ?? p?.name ?? 'Producto', qty: it.qty, unit_price: money(unit), list_price: listCents != null && listCents !== unit ? money(listCents) : null, line_total: money(c.total), sale_unit: p?.sale_unit ?? 'pieza', opts, notes: it.notes || null } }
  })
  const doc = sumLines(lines.map((l) => l.c))
  return { subtotal: money(doc.subtotal), tax: money(doc.iva), total: money(doc.total), items: lines.map((l) => l.item) }
}
