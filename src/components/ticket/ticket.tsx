import { QrSvg } from '@/components/qr/qr-tools'
import { fmtDateShort, fmtTime, folio, initials, qtyLabel } from '@/lib/format'
import { money, moneyShort } from '@/lib/money'

export interface TicketSettings {
  show_logo: boolean; header_name: string | null; show_address: boolean; address_text: string | null; show_phone: boolean; phone_text: string | null
  show_tax_breakdown: boolean; show_payment: boolean; show_cashier: boolean; thanks_message: string | null; show_qr: boolean; qr_text: string | null
  footer_text: string | null; paper_width: number
}
export interface TicketSale {
  folio: number; date: string | Date
  items: { title: string; qty: string | number; unit_price: string | number; list_price?: string | number | null; line_total: string | number; sale_unit: string; opts?: string[]; notes?: string | null }[]
  subtotal: string | number; tax: string | number; total: string | number
  payments: { method: string; amount: string | number }[]; cash_received?: string | number | null; change?: string | number | null
  balance?: string | number | null
  preorder?: { customer: string; phone?: string | null; deliveryAt: string; notes?: string | null; fields?: { label: string; value: string }[] } | null
}
export const METHOD: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

/** Ticket en blanco y negro (PLAN §8.12). 58 mm = 384 dots, 80 mm = 576 dots. */
export function Ticket({ s, sale, business, cashier, device, qrUrl, qrLabel, taxRate, printable }: {
  s: TicketSettings; sale: TicketSale; business: { name: string; logo: string | null }; cashier?: string | null; device?: string | null
  qrUrl: string; qrLabel: string; taxRate: number; printable?: boolean
}) {
  const w80 = s.paper_width === 80
  const sub = [s.show_address ? s.address_text : null, s.show_phone ? s.phone_text : null].filter(Boolean)
  // Descuento por precios especiales (en centavos)
  const discount = sale.items.reduce((a, it) => a + (it.list_price != null ? Math.max(0, Math.round((Number(it.list_price) - Number(it.unit_price)) * Number(it.qty) * 100)) : 0), 0)
  return (
    <div className={`tk ${w80 ? 'w80' : ''} ${printable ? 'printable' : ''}`} style={{ width: w80 ? 302 : 219 }}>
      {s.show_logo ? (business.logo
        ? <div className="tk-logo" style={{ background: `#fff url(${business.logo}) center/contain no-repeat`, filter: 'grayscale(1) contrast(1.4)' }} />
        : <div className="tk-logo">{initials(business.name)}</div>) : null}
      <div className="tk-name">{s.header_name || business.name}</div>
      {sub.map((t, i) => <div className="tk-sub" key={i}>{t}</div>)}
      <div className="tk-meta">
        <div><span>Folio</span><b>{folio('V', sale.folio)}</b></div>
        <div><span>Fecha</span><b>{fmtDateShort(sale.date)} · {fmtTime(sale.date)}</b></div>
      </div>
      {sale.preorder ? (
        <div className="tk-pre">
          <b>PEDIDO · ENTREGA {fmtDateShort(sale.preorder.deliveryAt)} {fmtTime(sale.preorder.deliveryAt)}</b>
          <div><span>Cliente</span><span>{sale.preorder.customer}</span></div>
          {sale.preorder.phone ? <div><span>Teléfono</span><span>{sale.preorder.phone}</span></div> : null}
          {(sale.preorder.fields ?? []).map((f, i) => <div key={i}><span>{f.label}</span><span>{f.value}</span></div>)}
          {sale.preorder.notes ? <p>{sale.preorder.notes}</p> : null}
        </div>
      ) : null}
      {sale.items.map((it, i) => (
        <div className="tk-it" key={i}>
          <span className="q">{qtyLabel(it.qty, it.sale_unit)}</span>
          <span className="n">{it.title}<small>{moneyShort(it.unit_price)}{it.sale_unit === 'pieza' ? ' c/u' : ` /${it.sale_unit}`}{it.opts?.length ? ` · ${it.opts.join(', ')}` : ''}</small>{it.list_price != null && Number(it.list_price) !== Number(it.unit_price) ? <small>Precio especial · antes <s>{moneyShort(it.list_price)}</s></small> : null}{it.notes ? <small>{it.notes}</small> : null}</span>
          <b>{moneyShort(it.line_total)}</b>
        </div>
      ))}
      {s.show_tax_breakdown ? (
        <div className="tk-sum">
          <div><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
          <div><span>IVA {taxRate}%</span><span>{money(sale.tax)}</span></div>
          {discount > 0 ? <div><span>Descuento</span><span>-{money(discount / 100)}</span></div> : null}
        </div>
      ) : <div style={{ height: 6 }} />}
      <div className="tk-total"><span>TOTAL</span><b>{money(sale.total)}</b></div>
      {s.show_payment && sale.payments.length ? (
        <div className="tk-pay">
          {sale.payments.map((p, i) => <div key={i}><span>{METHOD[p.method] ?? p.method}</span><span>{money(p.method === 'cash' && sale.payments.length === 1 && sale.cash_received ? sale.cash_received : p.amount)}</span></div>)}
          {Number(sale.change ?? 0) > 0 ? <div><span>Cambio</span><span>{money(sale.change)}</span></div> : null}
          {Number(sale.balance ?? 0) > 0 ? <div><b>Resta por pagar</b><b>{money(sale.balance)}</b></div> : null}
        </div>
      ) : null}
      <div className={`tk-foot ${s.show_qr ? '' : 'noqr'}`}>
        {s.show_qr ? <span className="tk-qr"><QrSvg url={qrUrl} px={w80 ? 78 : 62} /></span> : null}
        <div>
          {s.thanks_message ? <b>{s.thanks_message}</b> : null}
          {s.show_qr ? <><span>{s.qr_text}</span><span className="u">{qrLabel}</span></> : null}
        </div>
      </div>
      {s.footer_text ? <div className="tk-extra">{s.footer_text}</div> : null}
      {s.show_cashier && cashier ? <div className="tk-by">Le atendió {cashier}{device ? ` · ${device}` : ''}</div> : null}
    </div>
  )
}
