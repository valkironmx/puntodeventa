// Diseño de cada sección del panel. Lo usan las páginas web (con datos del servidor) y la app del teléfono
// (con los mismos datos guardados para usarse sin conexión). Cambiar aquí cambia ambas.
import Link from 'next/link'
import { ApptDetail } from '@/components/booking/appt-detail'
import { ApptList } from '@/components/booking/appt-list'
import { BookingSettings } from '@/components/booking/booking-settings'
import { NewAppt } from '@/components/booking/new-appt'
import { Icon } from '@/components/icons'
import { AccountPanel } from '@/components/panel/account-panel'
import { CashCut } from '@/components/panel/cash-cut'
import { CatalogList } from '@/components/panel/catalog-list'
import { CategoryList } from '@/components/panel/category-list'
import { CustomizeForm } from '@/components/panel/customize-form'
import { ModeSettings } from '@/components/panel/mode-settings'
import { NotificationList } from '@/components/panel/notification-list'
import { OrderList } from '@/components/panel/order-list'
import { ProductForm } from '@/components/panel/product-form'
import { PromoManager } from '@/components/panel/promo-manager'
import { QuoteDetail } from '@/components/panel/quote-detail'
import { QuoteEditor } from '@/components/panel/quote-editor'
import { SaleDetail } from '@/components/panel/sale-detail'
import { FieldLabelsForm, TaxForm } from '@/components/panel/small-forms'
import { Staff } from '@/components/panel/staff'
import { PushToggle } from '@/components/push'
import { QrPanel } from '@/components/qr/qr-panel'
import { PrinterSettings } from '@/components/ticket/printer-settings'
import { TicketDesigner } from '@/components/ticket/ticket-designer'
import { AppBar } from '@/components/ui'
import { folio, initials } from '@/lib/format'
import { money } from '@/lib/money'
import { QUOTE_ST } from '@/lib/quote-status'
import type * as S from '@/lib/sections'

type P<F extends (...a: never[]) => unknown> = NonNullable<Awaited<ReturnType<F>>>

export function HomeView(p: P<typeof S.loadHome>) {
  const c = (href: string, icon: string, label: string, badge?: number) => (
    <Link href={href} className="pcat" key={href}><span><Icon name={icon} size={24} />{badge ? <i>{badge}</i> : null}</span>{label}</Link>
  )
  const q = (href: string, icon: string, label: string, badge?: number) => (
    <Link href={href} className="qbtn big" key={href}>
      <span className="qi"><Icon name={icon} size={22} /></span>
      <span>{label}{badge ? <span className="cnt" style={{ marginLeft: 8 }}>{badge}</span> : null}</span>
    </Link>
  )
  return (
    <>
      <AppBar right={<Link href={`/${p.slug}`} target="_blank" className="ibtn" aria-label="Ver mi página pública"><Icon name="eye" /></Link>}>
        <div className="abiz">
          <div className="logo sm" style={p.logo ? { background: `#fff url(${p.logo}) center/cover` } : undefined}>{p.logo ? '' : initials(p.name)}</div>
          <div><b>{p.name}</b><small>{p.domain}/{p.slug}</small></div>
        </div>
      </AppBar>
      <div className="scroll pad">
        <div className="greet"><small>Hola, {p.userName}</small><b>¿Qué quieres hacer hoy?</b></div>
        {!p.isSuper ? (
          <Link href="/app/pos" className={`promo home-hero ${p.hero ? 'has-img' : ''}`}>
            {p.hero ? <img src={p.hero} alt="" /> : null}
            <div className="promo-t">
              <em>Punto de venta</em>
              <b>Cobra en segundos</b>
              <p>Registra la venta, el pago y entrega el ticket.</p>
              <span className="promo-btn">Nueva venta <span><Icon name="chevR" size={13} stroke={3} /></span></span>
            </div>
          </Link>
        ) : null}
        <div className="pcats">
          {c('/app/pedidos', 'bag', 'Pedidos', p.orders)}
          {c('/app/catalogo', 'grid', p.catalogWord)}
          {c('/app/promociones', 'image', 'Promociones')}
          {p.booking ? c('/app/citas', 'calendar', 'Agenda', p.pending) : null}
          {c('/app/ventas', 'receipt', 'Ventas')}
          {c('/app/cotizaciones', 'doc', 'Cotizaciones')}
          {c('/app/corte', 'cash', 'Corte')}
        </div>
        <div className="shead"><b>Tu negocio</b></div>
        <div className="qa">
          {q('/app/personalizar', 'palette', 'Personalizar')}
          {q('/app/qr', 'qr', 'Código QR')}
          {q('/app/empleados', 'users', 'Empleados')}
          {q('/app/ticket', 'receipt', 'Diseño del ticket')}
          {q('/app/impresora', 'printer', 'Impresora')}
          {q('/app/ajustes', 'settings', 'Ajustes')}
        </div>
        <Link href={`/${p.slug}`} target="_blank" className="promo strip home-strip">
          <div className="promo-t"><em>Tu página pública</em><b>{p.domain}/{p.slug}</b><p>Así la ven tus clientes. Compártela o imprime tu QR.</p></div>
          <span className="promo-btn" style={{ marginRight: 18 }}>Ver <span><Icon name="chevR" size={13} stroke={3} /></span></span>
        </Link>
      </div>
    </>
  )
}

export function NotificationsView(p: P<typeof S.loadNotifications>) {
  return (
    <>
      <AppBar back={p.back} title="Notificaciones" sub="Avisos de la plataforma y novedades de tu negocio" />
      <div className="scroll pad narrow"><PushToggle /><NotificationList items={p.items} /></div>
    </>
  )
}

export function CashCutView(p: P<typeof S.loadCashCut>) {
  return (
    <>
      <AppBar back="/app" title="Corte de caja" />
      <div className="scroll pad narrow">
        <CashCut session={p.session} summary={p.summary} moves={p.moves} canClose={p.canClose} businessName={p.businessName} />
        <div className="sec">Historial de cortes</div>
        {p.history.map((h) => (
          <div className="qcard" key={h.id}>
            <div className="t"><span className="f">{h.closed} · cerró {h.by}</span>
              <span className={`st ${h.diff === 0 ? 'aceptada' : h.diff > 0 ? 'espera' : 'cancelada'}`}>{h.diff === 0 ? 'Cuadra' : h.diff > 0 ? `Sobran ${money(h.diff)}` : `Faltan ${money(-h.diff)}`}</span></div>
            <div className="b"><span>Esperado {money(h.expected)}</span><b>{money(h.counted)}</b></div>
          </div>
        ))}
        {p.history.length === 0 ? <div className="mut">Aún no hay cortes cerrados.</div> : null}
      </div>
    </>
  )
}

export function CatalogView(p: P<typeof S.loadCatalog>) {
  return (
    <>
      <AppBar back="/app" title={p.terms.editCatalog} sub={`${p.products.length} ${p.terms.items}`}
        right={<Link href="/app/categorias" className="ibtn" aria-label="Categorías"><Icon name="list" /></Link>} />
      <div className="scroll pad">
        <CatalogList cats={p.cats} terms={p.terms} products={p.products} />
      </div>
      <Link href="/app/catalogo/nuevo" className="fab" aria-label={p.terms.newItem}><Icon name="plus" size={26} /></Link>
    </>
  )
}

export function ProductView(p: P<typeof S.loadProduct>) {
  return (
    <>
      <AppBar back="/app/catalogo" title={p.product ? `Editar ${p.terms.item}` : p.terms.newItem} />
      <ProductForm product={p.product} cats={p.cats} terms={p.terms} features={p.features} mode={p.mode} businessId={p.businessId} units={p.units} suggested={p.suggested} tax={p.tax} canDelete={p.canDelete} />
    </>
  )
}

export function CategoriesView(p: P<typeof S.loadCategories>) {
  return (
    <>
      <AppBar back="/app/catalogo" title="Categorías" />
      <div className="scroll pad narrow"><CategoryList cats={p.cats} canDelete={p.canDelete} items={p.items} /></div>
    </>
  )
}

export function PromotionsView(p: P<typeof S.loadPromotions>) {
  return (
    <>
      <AppBar back="/app/negocio" title="Promociones" sub="Banners en tu página pública" />
      <div className="scroll pad narrow">
        <PromoManager businessId={p.businessId} canDelete={p.canDelete} item={p.item} promos={p.promos} products={p.products} />
      </div>
    </>
  )
}

export function CustomizeView(p: P<typeof S.loadCustomize>) {
  return (
    <>
      <AppBar back="/app/negocio" title="Personalizar" />
      <CustomizeForm availableTypes={p.availableTypes} booking={p.booking} catalogWord={p.catalogWord} b={p.b} />
    </>
  )
}

export function QrView(p: P<typeof S.loadQr>) {
  return (
    <>
      <AppBar back="/app/negocio" title="Mi código QR" />
      <div className="scroll pad narrow">
        {p.qr ? <QrPanel qr={p.qr} base={p.base} domain={p.domain} slug={p.slug} hasWhatsapp={p.hasWhatsapp} catalogWord={p.catalogWord} />
          : <div className="empty">Tu código QR no está activo. Contacta a soporte para generar uno nuevo.</div>}
      </div>
    </>
  )
}

export function TicketView(p: P<typeof S.loadTicket>) {
  return (
    <>
      <AppBar back="/app/negocio" title="Diseño del ticket" />
      <TicketDesigner t={p.t} cashier={p.cashier || 'Ana'} device={p.device} />
    </>
  )
}

export function PrinterView(p: P<typeof S.loadTicket>) {
  return (
    <>
      <AppBar back="/app/negocio" title="Impresora" />
      <div className="scroll pad narrow"><PrinterSettings t={p.t} cashier={p.cashier} device={p.device} /></div>
    </>
  )
}

export function StaffView(p: P<typeof S.loadStaff>) {
  return (
    <>
      <AppBar back="/app/negocio" title="Empleados" sub={p.sub} />
      <div className="scroll pad narrow"><Staff canEdit={p.canEdit} cashDevice={p.cashDevice} staff={p.staff} /></div>
    </>
  )
}

export function SettingsView(p: P<typeof S.loadSettings>) {
  const row = (href: string, icon: string, title: string, sub: string) => (
    <Link href={href} className="lrow" style={{ padding: 12 }}>
      <span className="av"><Icon name={icon} size={19} /></span>
      <div className="li"><b>{title}</b><div className="meta">{sub}</div></div><Icon name="chevR" size={18} />
    </Link>
  )
  return (
    <>
      <AppBar back="/app" title="Ajustes" />
      <div className="scroll pad narrow">
        {row('/app/ajustes/impuestos', 'percent', 'Impuestos', p.taxSub)}
        {row('/app/ajustes/campos', 'list', 'Campos personalizados', 'Etiquetas sugeridas al editar el catálogo')}
        {p.booking ? row('/app/citas/ajustes', 'calendar', 'Agenda de citas', 'Reglas, horarios y bloqueos') : null}
        <ModeSettings mode={p.mode} features={p.features} />
      </div>
    </>
  )
}

export function TaxView(p: P<typeof S.loadSettings>) {
  return (
    <>
      <AppBar back="/app/ajustes" title="Impuestos" />
      <div className="scroll pad narrow"><TaxForm mode={p.tax.mode} rate={p.tax.rate} /></div>
    </>
  )
}

export function FieldsView(p: P<typeof S.loadSettings>) {
  return (
    <>
      <AppBar back="/app/ajustes" title="Campos personalizados" />
      <div className="scroll pad narrow"><FieldLabelsForm labels={p.labels} item={p.item} /></div>
    </>
  )
}

export function AccountView(p: P<typeof S.loadAccount>) {
  return (
    <>
      <AppBar back={p.back} title="Mi cuenta" />
      <div className="scroll pad narrow">
        <AccountPanel email={p.email} name={p.name} role={p.role} preview={p.preview} cashMode={p.cashMode} />
      </div>
    </>
  )
}

export function QuotesView(p: P<typeof S.loadQuotes> & { filters: [string, string][] }) {
  return (
    <>
      <AppBar back="/app" title="Cotizaciones" sub={p.hint} />
      <div className="scroll">
        <div className="chips">{p.filters.map(([k, l]) => <Link key={k} href={`/app/cotizaciones?f=${k}`} className={`chip ${p.f === k ? 'on' : ''}`}>{l}</Link>)}</div>
        <div className="pad cards">
          {p.f === 'papelera' ? <div className="vbox"><Icon name="trash" size={18} /> Las cotizaciones en la papelera se borran definitivamente a los 30 días.</div> : null}
          {p.rows.map((q) => (
            <Link href={`/app/cotizaciones/${q.id}`} className="qcard" key={q.id} style={{ display: 'block' }}>
              <div className="t"><span className="f">{folio('COT', q.folio)}</span><span className={`st ${QUOTE_ST[q.status]?.[0] ?? 'espera'}`}>{QUOTE_ST[q.status]?.[1] ?? 'Por subir'}</span></div>
              <div className="c">{q.client || 'Sin cliente'}</div>
              <div className="b"><span className="vig"><Icon name="clock" size={13} /> {q.expires ? `Vigente hasta ${q.expires}` : ''}</span><b>{money(q.total)}</b></div>
            </Link>
          ))}
          {p.rows.length === 0 ? <div className="empty">No hay cotizaciones aquí.</div> : null}
        </div>
      </div>
      <Link href="/app/cotizaciones/nueva" className="fab" aria-label="Nueva cotización"><Icon name="plus" size={26} /></Link>
    </>
  )
}

export function QuoteView(p: P<typeof S.loadQuote>) {
  return (
    <>
      <AppBar back="/app/cotizaciones" title={folio('COT', p.folio)} sub={p.client ?? 'Sin cliente'} />
      <QuoteDetail canDelete={p.canDelete} rate={p.rate} business={p.business} q={p.q} items={p.items} />
    </>
  )
}

export function QuoteEditView(p: P<typeof S.loadQuote> & { products: P<typeof S.loadQuoteProducts>['products'] }) {
  return (
    <>
      <AppBar back={`/app/cotizaciones/${p.q.id}`} title={`Editar ${folio('COT', p.folio)}`} />
      <QuoteEditor products={p.products} rate={p.rate} quote={p.edit} />
    </>
  )
}

export function NewQuoteView(p: P<typeof S.loadQuoteProducts>) {
  return (
    <>
      <AppBar back="/app/cotizaciones" title="Nueva cotización" />
      <QuoteEditor quote={null} products={p.products} rate={p.rate} />
    </>
  )
}

export function SaleView(p: P<typeof S.loadSale>) {
  return (
    <>
      <AppBar back="/app/ventas" title={`Venta ${folio('V', p.folio)}`} sub={p.sub} />
      <SaleDetail sale={p.sale} items={p.items} payments={p.payments} ticket={p.ticket} canCancel={p.canCancel} device={p.device} orderTypes={p.orderTypes} fieldSuggestions={p.fieldSuggestions} />
    </>
  )
}

export function WebOrdersBody(p: P<typeof S.loadWebOrders>) {
  return <OrderList filter={p.f} pending={p.pending} service={p.service} rows={p.rows} />
}

export function AppointmentsView(p: P<typeof S.loadAppointments>) {
  const qs = (d: string, person: string | null) => `/app/citas?d=${d}${person ? `&p=${person}` : ''}`
  const dl = p.days.find((x) => x.d === p.day)
  return (
    <>
      <AppBar title="Citas" sub={p.day === p.today ? `Hoy, ${dl?.long ?? ''}` : dl?.long ?? p.day}
        right={p.manage ? <Link href="/app/citas/ajustes" className="ibtn" aria-label="Configurar agenda"><Icon name="sliders" /></Link> : null} />
      <div className="scroll pad">
        <div className="days">
          {p.days.map((x) => (
            <Link key={x.d} href={qs(x.d, p.person)} className={`day ${x.d === p.day ? 'on' : ''} ${x.d < p.today ? 'past' : ''}`}>
              <small>{x.d === p.today ? 'Hoy' : x.wd}</small><b>{x.num}</b><i>{'•'.repeat(Math.min(3, x.n))}</i>
            </Link>
          ))}
        </div>
        {p.manage && p.staff.length > 1 ? (
          <div className="chips" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <Link href={qs(p.day, null)} className={`chip ${!p.person ? 'on' : ''}`}>Todos</Link>
            {p.staff.map((s) => <Link key={s.id} href={qs(p.day, s.id)} className={`chip ${p.person === s.id ? 'on' : ''}`}>{s.name}</Link>)}
          </div>
        ) : <div style={{ height: 14 }} />}
        <ApptList pending={p.pending} agenda={p.agenda} isToday={p.day === p.today} businessName={p.businessName} />
      </div>
      {p.manage ? <Link href={`/app/citas/nueva?d=${p.day}`} className="fab" aria-label="Nueva cita"><Icon name="plus" size={26} /></Link> : null}
    </>
  )
}

export function AppointmentView(p: P<typeof S.loadAppointment>) {
  return (
    <>
      <AppBar back={`/app/citas?d=${p.day}`} title="Detalle de cita" />
      <ApptDetail manage={p.manage} canDecide={p.canDecide} canPos={p.canPos} a={p.a} events={p.events} staff={p.staff} messages={p.messages} />
    </>
  )
}

export function NewAppointmentView(p: P<typeof S.loadNewAppointment> & { day?: string }) {
  return (
    <>
      <AppBar back="/app/citas" title="Nueva cita" />
      <NewAppt day={p.day} services={p.services} staff={p.staff} />
    </>
  )
}

export function BookingSettingsView(p: P<typeof S.loadBookingSettings>) {
  return (
    <>
      <AppBar back="/app/citas" title="Configurar agenda" />
      <BookingSettings canDelete={p.canDelete} s={p.s} members={p.members} blocks={p.blocks} />
    </>
  )
}

/** Mi negocio: agrupa la configuración para que el menú lateral sea corto */
export function BusinessHubView() {
  const row = (href: string, icon: string, title: string, sub: string) => (
    <Link href={href} className="lrow" style={{ padding: 12 }} key={href}>
      <span className="av"><Icon name={icon} size={19} /></span>
      <div className="li"><b>{title}</b><div className="meta">{sub}</div></div><Icon name="chevR" size={18} />
    </Link>
  )
  return (
    <>
      <AppBar back="/app" title="Mi negocio" />
      <div className="scroll pad narrow">
        <div className="sec" style={{ marginTop: 0 }}>Tu página</div>
        {row('/app/personalizar', 'palette', 'Personalizar', 'Logo, colores, portada, horario y contacto')}
        {row('/app/promociones', 'image', 'Promociones', 'Banners en tu página pública')}
        {row('/app/categorias', 'list', 'Categorías', 'Ordena y agrupa lo que vendes')}
        {row('/app/qr', 'qr', 'Código QR', 'Imprímelo para tus clientes')}
        <div className="sec">Caja y equipo</div>
        {row('/app/ticket', 'receipt', 'Diseño del ticket', 'Lo que se imprime en cada venta')}
        {row('/app/impresora', 'printer', 'Impresora', 'Conecta tu impresora de tickets')}
        {row('/app/empleados', 'users', 'Empleados', 'Cajeros, permisos y PIN')}
        {row('/app/cuenta', 'user', 'Mi cuenta', 'Tu correo, contraseña y sesión')}
      </div>
    </>
  )
}
