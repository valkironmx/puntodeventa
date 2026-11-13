/* eslint-disable @typescript-eslint/no-explicit-any */
// Cambios del panel aplicados al instante en los datos del teléfono (sin esperar al servidor).
// Cada función recibe el paquete de datos (snap) y los mismos argumentos que la acción del servidor.
type Snap = any
const uuid = () => crypto.randomUUID()
const num = (v: unknown) => Number(v ?? 0)
const str2 = (v: unknown) => (v == null ? null : Number(v).toFixed(2))

/** Antes de guardar: las altas reciben su id aquí, para usar el mismo en el teléfono y en el servidor. */
export function prepareArgs(fn: string, args: any[]): any[] {
  const a = structuredClone(args)
  if ((fn === 'saveCategoryAction' || fn === 'savePromotionAction') && a[0] && !a[0].id) a[0].id = uuid()
  if (fn === 'saveProductAction' && a[0]) {
    if (!a[0].id) a[0].id = uuid()
    for (const g of a[0].groups ?? []) { if (!g.id) g.id = uuid(); for (const o of g.options ?? []) if (!o.id) o.id = uuid() }
  }
  return a
}

const pages = (s: Snap) => (s.pages ??= {})
const eachPage = (s: Snap, prefix: string, f: (p: any, key: string) => void) => { for (const k of Object.keys(pages(s))) if (k.startsWith(prefix)) f(s.pages[k], k) }

/* ---------- Categorías ---------- */
function syncCats(s: Snap) {
  const cats = (pages(s).categorias?.cats ?? []).map((c: any) => ({ id: c.id, name: c.name }))
  if (s.pages.catalogo) s.pages.catalogo.cats = cats
  eachPage(s, 'producto:', (p) => { p.cats = cats })
  if (s.pos) s.pos.cats = (s.pages.categorias?.cats ?? []).filter((c: any) => c.visible !== false).map((c: any) => ({ id: c.id, name: c.name }))
}

/* ---------- Productos ---------- */
function productJson(d: any) {
  const groups = (d.groups ?? []).map((g: any) => ({ id: g.id, name: g.name, type: g.type, options: (g.options ?? []).map((o: any) => ({ id: o.id, label: o.label, price_delta: num(o.price_delta), track_stock: !!o.track_stock, stock: num(o.stock) })) }))
  const varTrack = groups.some((g: any) => g.options.some((o: any) => o.track_stock))
  const soldOut = varTrack ? groups.flatMap((g: any) => g.options).filter((o: any) => o.track_stock).every((o: any) => o.stock <= 0) : !!d.track_stock && num(d.stock) <= 0
  return {
    id: d.id, category_id: d.category_id, name: d.name, description: d.description, emoji: d.emoji, kind: d.kind, sale_unit: d.sale_unit, price: num(d.price), sale_price: d.sale_price == null ? null : num(d.sale_price),
    price_from: !!d.price_from, duration_min: d.duration_min, tax_mode: d.tax_mode, track_stock: !!d.track_stock, stock: num(d.stock), featured: !!d.featured, custom_fields: d.custom_fields ?? [],
    images: d.images ?? [], groups, sold_out: soldOut, show_in_catalog: !!d.show_in_catalog, active: !!d.active,
  }
}
function listItem(d: any) {
  const varStock = (d.groups ?? []).flatMap((g: any) => g.options ?? []).filter((o: any) => o.track_stock)
  return { id: d.id, name: d.name, emoji: d.emoji, price: str2(d.price), sale_price: str2(d.sale_price), unit: d.sale_unit, cat: d.category_id, track: !!d.track_stock,
    stock: varStock.length ? String(varStock.reduce((a: number, o: any) => a + num(o.stock), 0)) : String(d.stock ?? 0), pub: !!d.show_in_catalog, active: !!d.active, img: d.images?.[0] ?? null }
}
function upsert<T extends { id: string }>(list: T[] | undefined, item: T, atStart = false): T[] {
  const l = [...(list ?? [])]
  const i = l.findIndex((x) => x.id === item.id)
  if (i >= 0) l[i] = { ...l[i], ...item }; else if (atStart) l.unshift(item); else l.push(item)
  return l
}
function saveProduct(s: Snap, d: any) {
  const pj = productJson(d)
  const pg = pages(s)
  if (pg.catalogo) pg.catalogo.products = upsert(pg.catalogo.products, listItem(d))
  const base = pg['producto:nuevo']
  const prev = pg[`producto:${d.id}`] ?? base
  if (prev) pg[`producto:${d.id}`] = { ...prev, product: { ...pj, tax_mode: d.tax_mode } }
  if (s.pos) s.pos.products = d.active ? upsert(s.pos.products, pj) : (s.pos.products ?? []).filter((p: any) => p.id !== d.id)
  if (pg['cotizacion-productos'] && d.active) pg['cotizacion-productos'].products = upsert(pg['cotizacion-productos'].products, { id: d.id, name: d.name, description: d.description ?? '', price: String(num(d.sale_price ?? d.price)), unit: d.sale_unit })
  if (pg.promociones) pg.promociones.products = d.active && d.show_in_catalog ? upsert(pg.promociones.products, { id: d.id, name: d.name }) : pg.promociones.products.filter((p: any) => p.id !== d.id)
  if (pg.categorias) pg.categorias.cats = pg.categorias.cats.map((c: any) => ({ ...c, n: (pg.catalogo?.products ?? []).filter((p: any) => p.cat === c.id).length }))
}
function removeProduct(s: Snap, id: string) {
  const pg = pages(s)
  if (pg.catalogo) pg.catalogo.products = pg.catalogo.products.filter((p: any) => p.id !== id)
  delete pg[`producto:${id}`]
  if (s.pos) s.pos.products = s.pos.products.filter((p: any) => p.id !== id)
  if (pg['cotizacion-productos']) pg['cotizacion-productos'].products = pg['cotizacion-productos'].products.filter((p: any) => p.id !== id)
}

/* ---------- Reductores por acción ---------- */
const R: Record<string, (s: Snap, a: any[], op: { id: string; at: string; user?: string }) => void> = {
  saveCategoryAction(s, [d]) {
    const pg = pages(s)
    if (!pg.categorias) return
    const prev = pg.categorias.cats.find((c: any) => c.id === d.id)
    pg.categorias.cats = upsert(pg.categorias.cats, { id: d.id, name: d.name.trim(), visible: d.visible, n: prev?.n ?? 0 })
    syncCats(s)
  },
  moveCategoryAction(s, [id, dir]) {
    const l = pages(s).categorias?.cats
    if (!l) return
    const i = l.findIndex((c: any) => c.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    syncCats(s)
  },
  deleteCategoryAction(s, [id]) {
    const pg = pages(s)
    if (pg.categorias) pg.categorias.cats = pg.categorias.cats.filter((c: any) => c.id !== id)
    if (pg.catalogo) pg.catalogo.products = pg.catalogo.products.map((p: any) => (p.cat === id ? { ...p, cat: null } : p))
    syncCats(s)
  },
  saveProductAction(s, [d]) { saveProduct(s, d) },
  toggleProductAction(s, [id, field, value]) {
    const pg = pages(s)
    const p = pg[`producto:${id}`]?.product
    if (p) {
      p[field] = value
      const d = { ...p, groups: p.groups }
      saveProduct(s, d)
    } else if (pg.catalogo) {
      const key = field === 'show_in_catalog' ? 'pub' : field
      pg.catalogo.products = pg.catalogo.products.map((x: any) => (x.id === id ? { ...x, [key]: value } : x))
    }
  },
  deleteProductAction(s, [id]) { removeProduct(s, id) },

  saveBusinessAction(s, [d]) {
    const pg = pages(s)
    if (pg.personalizar) pg.personalizar.b = { ...pg.personalizar.b, ...d, contact: d.contact ?? pg.personalizar.b.contact }
    if (d.name) { s.business.name = d.name; if (pg.home) pg.home.name = d.name; if (s.ticket?.business) s.ticket.business.name = d.name }
    if (d.accent_color) s.business.accent = d.accent_color
    if ('logo_path' in d) { s.business.logo = d.logo_path; if (pg.home) pg.home.logo = d.logo_path ? `/storage/${d.logo_path}` : null }
    if ('hero_path' in d && pg.home) pg.home.hero = d.hero_path ? `/storage/${d.hero_path}` : null
    if (d.order_types && s.pos) s.pos.orderTypes = d.order_types
  },
  setModeAction(s, [mode]) { if (pages(s).ajustes) s.pages.ajustes.mode = mode },
  setFeaturesAction(s, [f]) {
    const pg = pages(s)
    if (pg.ajustes) pg.ajustes.features = { ...pg.ajustes.features, ...f }
    eachPage(s, 'producto:', (p) => { p.features = { ...p.features, ...f } })
    if ('booking' in f) { s.booking = !!f.booking; if (pg.home) pg.home.booking = !!f.booking }
  },
  saveTaxAction(s, [mode, rate]) {
    const pg = pages(s)
    if (pg.ajustes) { pg.ajustes.tax = { mode, rate }; pg.ajustes.taxSub = `IVA ${rate}% · ${mode === 'included' ? 'incluido en precios' : 'se suma al precio'}` }
    if (s.pos) { s.pos.rate = rate; s.pos.globalMode = mode }
    if (s.ticket) s.ticket.taxRate = rate
    if (pg.ticket) pg.ticket.t.taxRate = rate
    eachPage(s, 'producto:', (p) => { p.tax = { mode, rate } })
    if (pg['cotizacion-productos']) pg['cotizacion-productos'].rate = rate
  },
  saveCustomFieldLabelsAction(s, [labels]) {
    const pg = pages(s)
    if (pg.ajustes) pg.ajustes.labels = labels
    if (s.pos) s.pos.fieldSuggestions = labels
    eachPage(s, 'producto:', (p) => { p.suggested = labels })
  },
  saveTicketAction(s, [d]) {
    const pg = pages(s)
    if (pg.ticket) pg.ticket.t.settings = { ...pg.ticket.t.settings, ...d }
    if (s.ticket) s.ticket.settings = { ...s.ticket.settings, ...d }
    eachPage(s, 'venta:', (p) => { p.ticket.settings = { ...p.ticket.settings, ...d } })
  },
  setQrDestinationAction(s, [, type, url]) { const q = pages(s).qr?.qr; if (q) { q.type = type; q.url = url } },
  savePromotionAction(s, [d]) { const p = pages(s).promociones; if (p) p.promos = upsert(p.promos, { ...d }) },
  togglePromotionAction(s, [id, active]) { const p = pages(s).promociones; if (p) p.promos = p.promos.map((x: any) => (x.id === id ? { ...x, active } : x)) },
  deletePromotionAction(s, [id]) { const p = pages(s).promociones; if (p) p.promos = p.promos.filter((x: any) => x.id !== id) },

  cashMovementAction(s, [, type, amt, reason]) {
    const c = pages(s).corte
    if (!c?.session) return
    c.moves = [...c.moves, { type, amount: amt, reason }]
    if (c.summary) {
      const k = type === 'in' ? 'cash_in' : 'cash_out'
      c.summary = { ...c.summary, [k]: num(c.summary[k]) + num(amt), expected: num(c.summary.expected) + (type === 'in' ? num(amt) : -num(amt)) }
    }
  },
  closeCashAction(s, [, counted], op) {
    const c = pages(s).corte
    if (!c?.session) return
    const expected = num(c.summary?.expected)
    c.history = [{ id: op.id, closed: new Date(op.at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }), by: op.user ?? '', diff: num(counted) - expected, expected: String(expected), counted: String(counted) }, ...c.history]
    c.session = null; c.summary = null; c.moves = []
  },
  setQuoteStatusAction(s, [id, status]) {
    const q = pages(s)[`cotizacion:${id}`]; if (q) { q.q.status = status; q.edit.status = status }
    eachPage(s, 'cotizaciones:', (p) => { p.rows = p.rows.map((r: any) => (r.id === id ? { ...r, status } : r)) })
  },
  trashQuoteAction(s, [id, restore]) {
    const q = pages(s)[`cotizacion:${id}`]; if (q) { q.q.deleted = !restore; q.editable = !!restore && q.q.status !== 'converted' }
    eachPage(s, 'cotizaciones:', (p, k) => { if (k !== 'cotizaciones:papelera' && !restore) p.rows = p.rows.filter((r: any) => r.id !== id) })
  },
  cancelSaleAction(s, [id]) {
    const v = pages(s)[`venta:${id}`]; if (v) v.sale = { ...v.sale, status: 'cancelled' }
    for (const r of [...(s.sales ?? []), ...(s.preorders ?? [])]) if (r.id === id) r.status = 'cancelled'
  },
  updateEmployeeAction(s, [d]) {
    const e = pages(s).empleados
    if (e) e.staff = e.staff.map((x: any) => (x.id === d.id ? { ...x, ...(d.role ? { role: d.role } : {}), ...(d.active !== undefined ? { active: d.active } : {}), ...(d.name ? { name: d.name } : {}), ...(d.pin ? { hasPin: true } : {}) } : x))
  },
  inviteEmployeeAction(s, [d], op) {
    const e = pages(s).empleados
    if (e) e.staff = [...e.staff, { id: `local:${op.id}`, name: d.name, role: d.role, active: true, hasPin: !!d.pin, email: d.email, invite: null }]
  },
  decideOrderAction(s, [id, status, reason]) {
    let row: any = null
    eachPage(s, 'pedidos-web:', (p) => { const r = p.rows.find((x: any) => x.id === id); if (r) row = { ...r, status, reason: reason || r.reason } })
    if (!row) return
    eachPage(s, 'pedidos-web:', (p, k) => {
      const f = k.split(':')[1]
      const fits = f === 'all' || f === status || (f === 'done' && ['completed', 'rejected', 'cancelled'].includes(status))
      p.rows = p.rows.filter((x: any) => x.id !== id)
      if (fits) p.rows = [row, ...p.rows]
      if (status !== 'pending') p.pending = Math.max(0, p.pending - (row ? 1 : 0))
    })
  },
  markNotificationsReadAction(s) { s.unread = 0 },
  decideAppointmentAction(s, [id, decision]) { apptStatus(s, id, decision === 'accept' ? 'confirmed' : 'rejected') },
  setAppointmentStatusAction(s, [id, status]) { apptStatus(s, id, status) },
}

function apptStatus(s: Snap, id: string, status: string) {
  const a = pages(s)[`cita:${id}`]; if (a) a.a.status = status
  eachPage(s, 'citas:', (p) => {
    const all = [...p.pending, ...p.agenda]
    const r = all.find((x: any) => x.id === id)
    if (!r) return
    r.status = status
    p.pending = all.filter((x: any) => x.status === 'pending')
    p.agenda = all.filter((x: any) => x.status !== 'pending' && x.startsAt && p.day && x.startsAt.slice(0, 10) <= p.day)
  })
}

/** Aplica el cambio en el teléfono. Devuelve false si esa acción no tiene cambio local (se verá al sincronizar). */
export function applyAction(s: Snap, fn: string, args: any[], op: { id: string; at: string; user?: string }): boolean {
  const r = R[fn]
  if (!r) return false
  r(s, args, op)
  return true
}
