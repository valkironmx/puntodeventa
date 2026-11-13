/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon } from '@/components/icons'
import { PaymentHistory, PaymentSheet } from '@/components/panel/payments'
import { PreorderList, type PreorderRow } from '@/components/panel/preorder-list'
import { Pos } from '@/components/pos/pos'
import { Ticket, type TicketSale } from '@/components/ticket/ticket'
import { AppBar, DrawerProvider, Field, NotifCtx, ToastProvider, useAction, useToast } from '@/components/ui'
import { exportJpg } from '@/lib/export-image'
import { fmtDateTime, folio, initials, qtyLabel, storageUrl } from '@/lib/format'
import { QUOTE_FILTERS } from '@/lib/quote-status'
import * as V from '@/sections/views'
import { money } from '@/lib/money'
import { convertQuoteAction } from './actions-sales'
import { getRoute, getRouteKey, go, subscribeRoute } from './router'
import { discard, getState, login, logout, subscribe, sync } from './store'

const useStore = () => useSyncExternalStore(subscribe, getState)
const useRoute = () => { useSyncExternalStore(subscribeRoute, getRouteKey); return getRoute() }

export function App() {
  return <ToastProvider><ToastBridge /><Root /></ToastProvider>
}
function ToastBridge() {
  const toast = useToast()
  useEffect(() => { const f = (e: Event) => { const d = (e as CustomEvent).detail; toast(d.msg, d.bad) }; window.addEventListener('app-toast', f); return () => window.removeEventListener('app-toast', f) }, [toast])
  return null
}

function Root() {
  const s = useStore()
  if (!s.ready) return <div className="m-splash"><Icon name="bag" size={40} /></div>
  if (!s.token || !s.snap || s.authError) return <Login />
  return <Shell />
}

/* ---------- Inicio de sesión (la única vez que se necesita internet) ---------- */
function Login() {
  const s = useStore()
  const [server, setServer] = useState(s.server)
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adv, setAdv] = useState(!s.server)
  const submit = async () => { setBusy(true); setErr(await login(server, email, pass)); setBusy(false) }
  return (
    <div className="m-login">
      <div className="m-login-card">
        <div className="m-logo"><Icon name="bag" size={30} /></div>
        <h1>Inicia sesión</h1>
        <p className="mut">Solo necesitas internet esta vez. Después la app funciona sin conexión y sube todo cuando vuelva la señal.</p>
        {s.authError ? <div className="err">Tu sesión terminó. Vuelve a iniciar sesión; lo que no se ha subido se conserva.</div> : null}
        <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <Field label="Correo"><input className="inp" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Contraseña"><input className="inp" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
          {adv ? <Field label="Servidor" hint="La dirección de tu sistema."><input className="inp" inputMode="url" autoCapitalize="none" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://" /></Field> : null}
          {err ? <div className="err">{err}</div> : null}
          <button className="btn" disabled={busy || !email || !pass}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
        {!adv ? <button type="button" className="m-link" onClick={() => setAdv(true)}>Cambiar servidor</button> : null}
      </div>
    </div>
  )
}

/* ---------- Menú y pantallas ---------- */
const ROLE_LABEL: Record<string, string> = { owner: 'Dueño', admin: 'Administrador', cashier: 'Cajero', super: 'Super Admin' }
function Shell() {
  const s = useStore()
  const route = useRoute()
  const snap = s.snap
  const cashier = snap.user.role === 'cashier'
  const pending = s.outbox.length
  const failed = Object.keys(s.failed).length
  const orders = (snap.pages?.['pedidos-web:pending'] as any)?.pending ?? 0
  const appts = (snap.pages?.home as any)?.pending ?? 0
  const unread = snap.unread ?? 0
  const item = (close: () => void, href: string, icon: string, label: string, badge?: ReactNode, also: string[] = []) => (
    <a href={href} title={label} className={`ditem ${route.path === href || (href !== '/app' && route.path.startsWith(`${href}/`)) || also.some((a) => route.path.startsWith(a)) ? 'on' : ''}`} onClick={(e) => { e.preventDefault(); close(); go(href) }}>
      <Icon name={icon} size={19} /> {label} {badge}
    </a>
  )
  const bd = (n: number) => (n ? <span className="bd">{n}</span> : null)
  const logo = storageUrl(snap.business.logo)
  return (
    <div className="screen panel wide" style={{ ['--g' as string]: snap.business.accent }}>
      <NotifCtx.Provider value={{ count: unread, clear: () => {} }}>
      <DrawerProvider drawer={(close) => (
        <>
          <div className="dh">
            <div className="logo sm" style={logo ? { background: `#fff url(${logo}) center/cover` } : undefined}>{logo ? '' : initials(snap.business.name)}</div>
            <div style={{ minWidth: 0 }}><b>{snap.business.name}</b><small>{snap.user.name} · {ROLE_LABEL[snap.user.role] ?? ''}</small></div>
            <button className="ibtn sm" onClick={close} aria-label="Cerrar menú"><Icon name="x" size={16} /></button>
          </div>
          <div className="dscroll">
            {cashier ? (
              <>
                {item(close, '/app/pos', 'pos', 'Punto de venta')}
                {item(close, '/app/pedidos', 'bag', 'Pedidos', bd(orders))}
                {snap.booking ? item(close, '/app/citas', 'calendar', 'Mis citas', bd(appts)) : null}
                {item(close, '/app/cuenta', 'user', 'Mi cuenta')}
              </>
            ) : (
              <>
                {item(close, '/app', 'grid', 'Inicio')}
                {item(close, '/app/pos', 'pos', 'Punto de venta')}
                {item(close, '/app/pedidos', 'bag', 'Pedidos', bd(orders))}
                {item(close, '/app/ventas', 'receipt', 'Ventas y pagos')}
                {item(close, '/app/cotizaciones', 'doc', 'Cotizaciones')}
                {item(close, '/app/corte', 'cash', 'Corte de caja')}
                {snap.booking ? item(close, '/app/citas', 'calendar', 'Citas', bd(appts)) : null}
                {item(close, '/app/catalogo', 'tag', snap.business.catalogWord)}
                {item(close, '/app/negocio', 'store', 'Mi negocio', null, ['/app/personalizar', '/app/promociones', '/app/categorias', '/app/qr', '/app/ticket', '/app/impresora', '/app/empleados', '/app/cuenta'])}
                {item(close, '/app/ajustes', 'settings', 'Ajustes')}
              </>
            )}
          </div>
          <div className="dfoot m-dfoot">
            <a href="/app/sync" className={`ditem ${route.path === '/app/sync' ? 'on' : ''}`} onClick={(e) => { e.preventDefault(); close(); go('/app/sync') }}><Icon name="refresh" size={18} /> Respaldo {bd(pending)}</a>
            <button className="ditem" style={{ background: 'none', border: 0 }} onClick={() => { close(); void logout() }}><Icon name="logout" size={18} /> Salir</button>
          </div>
        </>
      )}>
        {!s.online || pending || failed ? (
          <button type="button" className={`m-strip ${failed ? 'bad' : !s.online ? 'off' : ''}`} onClick={() => go('/app/sync')}>
            <Icon name={failed ? 'x' : 'refresh'} size={14} />
            {failed ? `${failed} movimiento(s) no se pudieron subir · Revisar` : !s.online ? `Sin conexión · trabajando en el teléfono${pending ? ` · ${pending} por subir` : ''}` : s.syncing ? 'Subiendo…' : `${pending} por subir`}
          </button>
        ) : null}
        <View key={getRouteKey()} path={route.path} query={route.query} />
      </DrawerProvider>
      </NotifCtx.Provider>
    </div>
  )
}

function NoData({ title, back }: { title: string; back?: string }) {
  return (
    <>
      <AppBar back={back} title={title} />
      <div className="scroll pad narrow">
        <div className="cart-empty" style={{ paddingTop: 50 }}>
          <span><Icon name="refresh" size={26} /></span><b>Esta información aún no está en el teléfono</b>
          <small>Se descarga en la próxima sincronización con conexión.</small>
          <button className="btn sm" style={{ marginTop: 14, width: 'auto', padding: '0 18px' }} onClick={() => void sync()}>Sincronizar ahora</button>
        </div>
      </div>
    </>
  )
}

function View({ path, query }: { path: string; query: URLSearchParams }) {
  const snap = useStore().snap
  const pg = (snap.pages ?? {}) as Record<string, any>
  const manager = snap.user.role !== 'cashier'
  const show = (data: any, el: (d: any) => ReactNode, title: string, back = '/app') => (data ? <>{el(data)}</> : <NoData title={title} back={back} />)
  const seg = (base: string) => decodeURIComponent(path.slice(base.length))
  if (path === '/app/pos') return <PosView />
  if (path === '/app/sync') return <SyncView />
  if (path === '/app/pedidos') return query.get('t') === 'web' ? <WebOrdersView f={query.get('f') ?? 'pending'} /> : <PedidosView filter={query.get('f') ?? 'proximos'} />
  if (path === '/app/notificaciones') return show(pg.notificaciones, (d) => <V.NotificationsView {...d} />, 'Notificaciones')
  if (path === '/app/cuenta') return show(pg.cuenta, (d) => <V.AccountView {...d} />, 'Mi cuenta')
  if (path === '/app/citas') {
    const d = query.get('d')
    const key = d && pg[`citas:${d}`] ? `citas:${d}` : Object.keys(pg).find((k) => k.startsWith('citas:') && pg[k].day === pg[k].today)
    return show(key ? pg[key] : null, (x) => <V.AppointmentsView {...x} />, 'Citas')
  }
  if (path === '/app/citas/nueva') return show(pg['cita-nueva'], (x) => <V.NewAppointmentView {...x} day={query.get('d') ?? undefined} />, 'Nueva cita', '/app/citas')
  if (path === '/app/citas/ajustes') return show(pg['citas-ajustes'], (x) => <V.BookingSettingsView {...x} />, 'Configurar agenda', '/app/citas')
  if (path.startsWith('/app/citas/')) return show(pg[`cita:${seg('/app/citas/')}`], (x) => <V.AppointmentView {...x} />, 'Detalle de cita', '/app/citas')
  if (!manager) return path === '/app' ? <PosView /> : <NoData title="Sin acceso" back="/app/pos" />
  if (path === '/app' || path === '/') return show(pg.home, (d) => <V.HomeView {...d} />, 'Inicio')
  if (path === '/app/corte') return show(pg.corte, (d) => <V.CashCutView {...d} />, 'Corte de caja')
  if (path === '/app/catalogo') return show(pg.catalogo, (d) => <V.CatalogView {...d} />, snap.business.catalogWord)
  if (path.startsWith('/app/catalogo/')) return show(pg[`producto:${seg('/app/catalogo/')}`], (d) => <V.ProductView {...d} />, snap.business.catalogWord, '/app/catalogo')
  if (path === '/app/categorias') return show(pg.categorias, (d) => <V.CategoriesView {...d} />, 'Categorías', '/app/catalogo')
  if (path === '/app/promociones') return show(pg.promociones, (d) => <V.PromotionsView {...d} />, 'Promociones')
  if (path === '/app/personalizar') return show(pg.personalizar, (d) => <V.CustomizeView {...d} />, 'Personalizar')
  if (path === '/app/qr') return show(pg.qr, (d) => <V.QrView {...d} />, 'Mi código QR')
  if (path === '/app/ticket') return show(pg.ticket, (d) => <V.TicketView {...d} />, 'Diseño del ticket')
  if (path === '/app/impresora') return show(pg.ticket, (d) => <V.PrinterView {...d} />, 'Impresora')
  if (path === '/app/empleados') return show(pg.empleados, (d) => <V.StaffView {...d} />, 'Empleados')
  if (path === '/app/negocio') return <V.BusinessHubView />
  if (path === '/app/ajustes') return show(pg.ajustes, (d) => <V.SettingsView {...d} />, 'Ajustes')
  if (path === '/app/ajustes/impuestos') return show(pg.ajustes, (d) => <V.TaxView {...d} />, 'Impuestos', '/app/ajustes')
  if (path === '/app/ajustes/campos') return show(pg.ajustes, (d) => <V.FieldsView {...d} />, 'Campos personalizados', '/app/ajustes')
  if (path === '/app/ventas') return <VentasView filter={query.get('f') ?? 'todas'} />
  if (path.startsWith('/app/ventas/')) {
    const id = seg('/app/ventas/')
    return pg[`venta:${id}`] ? <V.SaleView {...pg[`venta:${id}`]} /> : <VentaDetail id={id} />
  }
  if (path === '/app/cotizaciones') {
    const f = query.get('f') ?? 'todas'
    const data = pg[`cotizaciones:${f}`]
    const locals = f === 'todas' || f === 'pending' ? (snap.quotes ?? []).filter((q: any) => q.pending).map((q: any) => ({ id: q.id, folio: 0, client: q.client, status: 'local', total: q.total, expires: '' })) : []
    return show(data, (d) => <V.QuotesView {...d} rows={[...locals, ...d.rows.filter((r: any) => !locals.some((l: any) => l.id === r.id))]} filters={QUOTE_FILTERS} />, 'Cotizaciones')
  }
  if (path === '/app/cotizaciones/nueva') return show(pg['cotizacion-productos'], (d) => <V.NewQuoteView {...d} />, 'Nueva cotización', '/app/cotizaciones')
  if (path.startsWith('/app/cotizaciones/')) {
    const id = seg('/app/cotizaciones/')
    if (id.startsWith('local:')) return <CotizacionDetail id={id} />
    const q = pg[`cotizacion:${id}`]
    if (q && query.get('editar') && q.editable) return <V.QuoteEditView {...q} products={pg['cotizacion-productos']?.products ?? []} />
    return show(q, (d) => <V.QuoteView {...d} />, 'Cotización', '/app/cotizaciones')
  }
  return <NoData title="Sección" />
}

function WebOrdersView({ f }: { f: string }) {
  const snap = useStore().snap
  const d = snap.pages?.[`pedidos-web:${f}`]
  return (
    <>
      <AppBar back={snap.user.role === 'cashier' ? '/app/pos' : '/app'} title="Pedidos" sub="Solicitudes que llegan desde tu página" />
      <div className="scroll pad">
        {snap.business.mode !== 'service' ? <PedidosTabs tab="web" pending={(snap.pages?.['pedidos-web:pending'] as any)?.pending ?? 0} /> : null}
        {d ? <V.WebOrdersBody {...d} /> : <div className="empty">Se descarga al tener conexión.</div>}
      </div>
    </>
  )
}

function PedidosTabs({ tab, pending }: { tab: 'pos' | 'web'; pending: number }) {
  return (
    <div className="pos-mode ped-tabs" role="tablist" aria-label="Tipo de pedido">
      <a role="tab" aria-selected={tab === 'pos'} className={tab === 'pos' ? 'on' : ''} href="/app/pedidos?t=pos" onClick={(e) => { e.preventDefault(); go('/app/pedidos?t=pos', true) }}>Pedidos del punto de venta</a>
      <a role="tab" aria-selected={tab === 'web'} className={tab === 'web' ? 'on' : ''} href="/app/pedidos?t=web" onClick={(e) => { e.preventDefault(); go('/app/pedidos?t=web', true) }}>Solicitudes en línea{pending ? <i className="ped-n">{pending}</i> : null}</a>
    </div>
  )
}

function PosView() {
  const snap = useStore().snap
  const p = snap.pos
  const ticket = useMemo(() => ({ ...snap.ticket, business: { name: snap.business.name, logo: storageUrl(snap.business.logo) } }), [snap])
  return (
    <Pos products={p.products} cats={p.cats} hasSession rate={p.rate} orderTypes={p.orderTypes} mode={p.mode} cashier={snap.user.name} device={snap.device}
      searchPh={p.searchPh} ticket={ticket} autoPrint={false} appointment={null} whatsapp={null} globalMode={p.globalMode} fieldSuggestions={p.fieldSuggestions} canQuote={snap.canQuote} />
  )
}

function PedidosView({ filter }: { filter: string }) {
  const snap = useStore().snap
  const all: PreorderRow[] = snap.preorders ?? []
  const f = ['proximos', 'saldo', 'entregados', 'todos'].includes(filter) ? filter : 'proximos'
  const live = (r: PreorderRow) => r.status !== 'cancelled'
  const rows = all.filter((r) => f === 'todos' || (f === 'proximos' && !r.deliveredAt && live(r)) || (f === 'saldo' && Number(r.balance) > 0 && live(r)) || (f === 'entregados' && !!r.deliveredAt))
    .sort((a, b) => (f === 'proximos' || f === 'saldo' ? 1 : -1) * (new Date(a.deliveryAt).getTime() - new Date(b.deliveryAt).getTime()))
  return (
    <>
      <AppBar back={snap.user.role === 'cashier' ? '/app/pos' : '/app'} title="Pedidos" sub="Pedidos a futuro con su entrega y sus pagos"
        right={<button className="btn sm" style={{ width: 'auto', padding: '0 14px' }} onClick={() => go('/app/pos')}>Nuevo pedido</button>} />
      <div className="scroll pad">
        <PedidosTabs tab="pos" pending={(snap.pages?.['pedidos-web:pending'] as any)?.pending ?? 0} />
        <PreorderList rows={rows} filter={f} canManage={snap.user.role !== 'cashier'}
          counts={{ proximos: all.filter((r) => !r.deliveredAt && live(r)).length, saldo: all.filter((r) => Number(r.balance) > 0 && live(r)).length }} />
      </div>
    </>
  )
}

const ST: Record<string, [string, string]> = { paid: ['pagada', 'Liquidada'], partial: ['parcial', 'Pago parcial'], pending: ['pendiente', 'Pendiente'], cancelled: ['cancelada', 'Cancelada'] }
function VentasView({ filter }: { filter: string }) {
  const snap = useStore().snap
  const all: any[] = snap.sales ?? []
  const F: [string, string][] = [['todas', 'Todas'], ['saldo', 'Con saldo'], ['subir', 'Por subir']]
  const rows = all.filter((s) => filter === 'todas' || (filter === 'saldo' && Number(s.balance) > 0 && s.status !== 'cancelled') || (filter === 'subir' && s.pending))
  return (
    <>
      <AppBar title="Ventas y pagos" sub="Últimos 60 días" />
      <div className="scroll">
        <div className="chips">{F.map(([k, l]) => <a key={k} href="#" className={`chip ${filter === k ? 'on' : ''}`} onClick={(e) => { e.preventDefault(); go(`/app/ventas?f=${k}`, true) }}>{l}</a>)}</div>
        <div className="pad cards">
          {rows.map((s) => (
            <a href="#" key={s.id} className="qcard" style={{ display: 'block' }} onClick={(e) => { e.preventDefault(); go(`/app/ventas/${encodeURIComponent(s.id)}`) }}>
              <div className="t"><span className="f">{folio('V', s.folio)} · {s.source === 'quote' ? 'De cotización' : s.source === 'encargo' ? 'Pedido' : 'Punto de venta'}</span>
                {s.pending ? <span className="st espera">Por subir</span> : <span className={`st ${ST[s.status]?.[0] ?? ''}`}>{ST[s.status]?.[1] ?? s.status}</span>}</div>
              <div className="c">{s.customer || 'Venta de mostrador'}</div>
              <div className="b"><span>{s.deliveryAt ? `Entrega ${fmtDateTime(s.deliveryAt)}` : fmtDateTime(s.date)}{Number(s.balance) > 0 && s.status !== 'cancelled' ? ` · falta ${money(s.balance)}` : ''}</span><b>{money(s.total)}</b></div>
            </a>
          ))}
          {rows.length === 0 ? <div className="empty">No hay ventas con este filtro.</div> : null}
        </div>
      </div>
    </>
  )
}

function VentaDetail({ id }: { id: string }) {
  const snap = useStore().snap
  const toast = useToast()
  const [pay, setPay] = useState(false)
  const tk = useRef<HTMLDivElement>(null)
  const s = (snap.sales ?? []).find((x: any) => x.id === id)
  const pre = (snap.preorders ?? []).find((x: any) => x.id === id)
  if (!s && !pre) return <><AppBar back="/app/ventas" title="Venta" /><div className="scroll pad"><div className="empty">Esta venta ya no está en el teléfono.</div></div></>
  const rec = s ?? { ...pre, date: pre.deliveryAt, subtotal: pre.total, tax: '0', items: pre.items.map((i: any) => ({ ...i, unit_price: '0', line_total: '0' })) }
  const pct = Number(rec.total) > 0 ? Math.min(100, Math.round((Number(rec.paid) / Number(rec.total)) * 100)) : 0
  const ticketSale: TicketSale = {
    folio: rec.folio, date: rec.date, items: rec.items, subtotal: rec.subtotal, tax: rec.tax, total: rec.total, payments: (rec.payments ?? []).map((p: any) => ({ method: p.method, amount: p.amount })),
    cash_received: rec.cashReceived ?? null, change: rec.change ?? null, balance: rec.balance,
    preorder: pre ? { customer: pre.customer, phone: pre.phone, deliveryAt: pre.deliveryAt, notes: pre.notes, fields: pre.fields } : null,
  }
  return (
    <>
      <AppBar back="/app/ventas" title={`Venta ${folio('V', rec.folio)}`} sub={rec.customer ?? 'Venta de mostrador'} />
      <div className="scroll pad narrow">
        {rec.pending ? <div className="vbox"><Icon name="refresh" /> Guardada en el teléfono. Se sube sola cuando haya conexión.</div> : null}
        <div className="bal">
          <small>{rec.status === 'cancelled' ? 'Venta cancelada' : Number(rec.balance) > 0 ? 'Falta por liquidar' : 'Venta liquidada'}</small>
          <div className="big">{money(rec.balance)}</div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="row2"><div>Total<b>{money(rec.total)}</b></div><div>Pagado<b>{money(rec.paid)}</b></div><div>Avance<b>{pct}%</b></div></div>
        </div>
        {rec.status !== 'cancelled' && Number(rec.balance) > 0 ? <button className="btn" onClick={() => setPay(true)}><Icon name="plus" /> Registrar pago</button> : null}
        <div className="sec">Partidas</div>
        <div className="box">
          {rec.items.map((i: any, k: number) => (
            <div className="qline" key={k}>
              <div className="n"><b>{i.title}</b><small>{[`${qtyLabel(i.qty, i.sale_unit)}${Number(i.unit_price) ? ` × ${money(i.unit_price)}` : ''}`, ...(i.opts ?? []), i.notes].filter(Boolean).join(' · ')}</small></div>
              {Number(i.line_total) ? <div className="r"><b>{money(i.line_total)}</b></div> : null}
            </div>
          ))}
          <div className="kv big"><span>Total</span><b>{money(rec.total)}</b></div>
        </div>
        <div className="sec">Historial de pagos</div>
        <div className="box"><PaymentHistory total={rec.total} payments={rec.payments ?? []} preorder={!!pre} /></div>
        {s ? <button className="btn ghost sm" onClick={() => tk.current && exportJpg(tk.current, `ticket-${folio('V', rec.folio)}.jpg`, true).catch(() => toast('No se pudo generar la imagen', true))}><Icon name="download" size={16} /> Ticket JPG</button> : null}
        <div style={{ position: 'absolute', left: -9999, top: 0 }}>
          <div ref={tk} className="tk-export"><Ticket s={snap.ticket.settings} sale={ticketSale} business={{ name: snap.business.name, logo: storageUrl(snap.business.logo) }} qrUrl={snap.ticket.qrUrl} qrLabel={snap.ticket.qrLabel} taxRate={snap.ticket.taxRate} cashier={snap.user.name} device={snap.device} /></div>
        </div>
      </div>
      {pay ? <PaymentSheet saleId={rec.id} balance={rec.balance} onClose={() => setPay(false)} /> : null}
    </>
  )
}

const QST: Record<string, [string, string]> = { pending: ['espera', 'En espera'], draft: ['espera', 'Borrador'], accepted: ['aceptada', 'Aceptada'], rejected: ['rechazada', 'Rechazada'], cancelled: ['cancelada', 'Cancelada'], expired: ['vencida', 'Vencida'], converted: ['aceptada', 'Convertida'] }
function CotizacionDetail({ id }: { id: string }) {
  const snap = useStore().snap
  const { run, busy } = useAction()
  const q = (snap.quotes ?? []).find((x: any) => x.id === id)
  if (!q) return <><AppBar back="/app/cotizaciones" title="Cotización" /><div className="scroll pad"><div className="empty">Esta cotización ya no está en el teléfono.</div></div></>
  const canConvert = !['converted', 'cancelled', 'rejected', 'expired'].includes(q.status)
  return (
    <>
      <AppBar back="/app/cotizaciones" title={folio('COT', q.folio)} sub={q.client ?? 'Sin nombre'} />
      <div className="scroll pad narrow">
        {q.pending ? <div className="vbox"><Icon name="refresh" /> Guardada en el teléfono. Se sube sola cuando haya conexión.</div> : null}
        <div className="box">
          <div className="kv"><span>Estatus</span><span className={`st ${QST[q.status]?.[0] ?? ''}`}>{QST[q.status]?.[1] ?? q.status}</span></div>
          {q.phone ? <div className="kv"><span>Teléfono</span><b>{q.phone}</b></div> : null}
          <div className="kv"><span>Fecha</span><b>{fmtDateTime(q.date)}</b></div>
        </div>
        <div className="box">
          {q.items.map((i: any, k: number) => (
            <div className="qline" key={k}><div className="n"><b>{i.title}</b><small>{qtyLabel(i.qty, i.sale_unit)} × {money(i.unit_price)}{i.description ? ` · ${i.description}` : ''}</small></div><div className="r"><b>{money(i.line_total)}</b></div></div>
          ))}
          <div className="kv"><span>Subtotal</span><b>{money(q.subtotal)}</b></div>
          <div className="kv"><span>IVA</span><b>{money(q.tax)}</b></div>
          <div className="kv big"><span>Total</span><b>{money(q.total)}</b></div>
        </div>
        {q.notes ? <p className="mut" style={{ whiteSpace: 'pre-wrap' }}>{q.notes}</p> : null}
        {canConvert ? (
          <button className="btn" disabled={busy} onClick={async () => { if (confirm(`¿Convertir en venta por ${money(q.total)}? El cobro se registra después como abono.`) && await run(convertQuoteAction(q.id), 'Convertida en venta')) go('/app/ventas') }}>
            <Icon name="swap" /> Convertir en venta
          </button>
        ) : null}
      </div>
    </>
  )
}

const KIND: Record<string, string> = { sale: 'Venta', payment: 'Abono', delivered: 'Entrega', preorder_update: 'Cambio en pedido', quote: 'Cotización', convert_quote: 'Cotización a venta' }
function SyncView() {
  const s = useStore()
  const toast = useToast()
  return (
    <>
      <AppBar title="Respaldo" sub="Tus datos viven en el teléfono; aquí se respaldan" />
      <div className="scroll pad narrow">
        <div className="box">
          <div className="kv"><span>Estado</span><b style={{ color: s.online ? 'var(--g)' : 'var(--red)' }}>{s.online ? 'Con conexión' : 'Sin conexión'}</b></div>
          <div className="kv"><span>Última sincronización</span><b>{s.lastSync ? fmtDateTime(s.lastSync) : '—'}</b></div>
          <div className="kv"><span>Por subir</span><b>{s.outbox.length}</b></div>
          <div className="kv"><span>Cuenta</span><b>{s.snap.user.name} · {s.snap.business.name}</b></div>
        </div>
        <p className="mut" style={{ fontSize: 13 }}>Todo lo que registras se guarda en este teléfono y se sube solo cuando hay conexión. No borres los datos de la app mientras haya movimientos por subir.</p>
        <button className="btn" disabled={s.syncing} onClick={async () => { await sync(); toast(getState().online ? 'Sincronizado' : 'Sin conexión: se intentará más tarde', !getState().online) }}>
          <Icon name="refresh" /> {s.syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
        {s.outbox.length ? <div className="sec">Movimientos por subir</div> : null}
        {s.outbox.map((o) => (
          <div className="box" key={o.id} style={{ padding: 12 }}>
            <div className="kv"><span>{KIND[o.kind] ?? o.kind} · {fmtDateTime(o.at)}</span>{o.meta?.total ? <b>{money(o.meta.total)}</b> : o.payload.amount ? <b>{money(o.payload.amount)}</b> : null}</div>
            {s.failed[o.id] ? (
              <>
                <div className="hint" style={{ color: '#C53030' }}>No se pudo subir: {s.failed[o.id]}</div>
                <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => void discard(o.id)}><Icon name="trash" size={15} /> Descartar</button>
              </>
            ) : <div className="hint">Esperando conexión</div>}
          </div>
        ))}
        <div className="sec">Más opciones</div>
        <div className="box">
          <p className="mut" style={{ marginTop: 0, fontSize: 13 }}>Todas las secciones del panel se guardan en el teléfono. Los cambios hechos sin conexión se aplican en el sistema al sincronizar. Subir fotos sí necesita conexión.</p>
          <div className="hint" style={{ marginTop: 0 }}>Servidor: {s.server}</div>
        </div>
      </div>
    </>
  )
}
