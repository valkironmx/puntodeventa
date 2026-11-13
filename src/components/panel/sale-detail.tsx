'use client'
import { useRef, useState } from 'react'
import { cancelSaleAction, setDeliveredAction, updatePreorderAction } from '@/app/actions/sales'
import { DateField, FieldsEditor, PhoneInput } from '@/components/inputs'
import { PaymentHistory, PaymentSheet } from '@/components/panel/payments'
import { ORDER_TYPE_LABELS } from '@/lib/mode-defaults'
import { Icon } from '@/components/icons'
import { METHOD, Ticket, type TicketSettings } from '@/components/ticket/ticket'
import { Field, Seg, Sheet, useAction, useToast } from '@/components/ui'
import { exportJpg } from '@/lib/export-image'
import { fmtDateTime, folio, qtyLabel } from '@/lib/format'
import { money } from '@/lib/money'

interface Sale { delivered_at: string | null; order_type: string; delivery_at: string | null; phone: string | null; notes: string | null; fields: { label: string; value: string }[]; id: string; folio: number; status: string; source: string; quoteFolio: number | null; customer: string | null; subtotal: string; tax: string; total: string; paid: string; balance: string; date: string; cash_received: string | null; change: string | null; cashier: string }
interface Item { list_price: string | null; title: string; qty: string; unit_price: string; line_total: string; sale_unit: string; opts: string[]; notes: string | null }
interface Pay { id: string; amount: string; method: string; note: string | null; by: string; date: string; initial: boolean }

export function SaleDetail({ sale, items, payments, ticket, canCancel, device, orderTypes, fieldSuggestions }: {
  sale: Sale; items: Item[]; payments: Pay[]; canCancel: boolean; device: string; orderTypes: string[]; fieldSuggestions: string[]
  ticket: { settings: TicketSettings; business: { name: string; logo: string | null }; qrUrl: string; qrLabel: string; taxRate: number }
}) {
  const [pay, setPay] = useState(false)
  const [edit, setEdit] = useState(false)
  const tkRef = useRef<HTMLDivElement>(null)
  const { run, busy } = useAction()
  const toast = useToast()
  const pct = Number(sale.total) > 0 ? Math.min(100, Math.round((Number(sale.paid) / Number(sale.total)) * 100)) : 0
  const cancelled = sale.status === 'cancelled'
  const balance = Number(sale.balance)
  return (
    <>
      <div className="scroll pad narrow">
        {sale.source === 'encargo' ? (
          <div className="box preorder-box">
            <div className="kv"><span>Pedido para</span><b>{sale.delivery_at ? fmtDateTime(sale.delivery_at) : '—'}</b></div>
            <div className="kv"><span>Cliente</span><b>{sale.customer ?? '—'}</b></div>
            {sale.phone ? <div className="kv"><span>Teléfono</span><b><a className="lk" href={`tel:${sale.phone.replace(/\s/g, '')}`}>{sale.phone}</a></b></div> : null}
            {sale.fields.map((f, i) => <div className="kv" key={i}><span>{f.label}</span><b>{f.value}</b></div>)}
            {sale.notes ? <p className="mut" style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{sale.notes}</p> : null}
            {sale.delivered_at ? <div className="kv"><span>Entregado</span><b>{fmtDateTime(sale.delivered_at)}</b></div> : null}
            {sale.status !== 'cancelled' ? (
              <div className="rowbtn" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn ghost sm" onClick={() => setEdit(true)}><Icon name="edit" size={15} /> Editar pedido</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => (sale.delivered_at || Number(sale.balance) <= 0 || confirm(`Aún debe ${money(sale.balance)}. ¿Marcar como entregado de todos modos?`)) && run(setDeliveredAction(sale.id, !sale.delivered_at), sale.delivered_at ? 'Pedido marcado como pendiente' : 'Pedido entregado')}>
                  <Icon name={sale.delivered_at ? 'refresh' : 'check'} size={15} /> {sale.delivered_at ? 'Deshacer entrega' : 'Marcar como entregado'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {sale.source === 'quote' && sale.quoteFolio ? <div className="from"><Icon name="doc" size={14} /> Convertida de la cotización {folio('COT', sale.quoteFolio)}</div> : null}
        <div className="bal">
          <small>{cancelled ? 'Venta cancelada' : balance > 0 ? 'Falta por liquidar' : 'Venta liquidada'}</small>
          <div className="big">{money(cancelled ? 0 : sale.balance)}</div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="row2"><div>Total<b>{money(sale.total)}</b></div><div>Pagado<b>{money(sale.paid)}</b></div><div>Avance<b>{pct}%</b></div></div>
        </div>
        {!cancelled && balance > 0 ? <button className="btn" onClick={() => setPay(true)}><Icon name="plus" /> Registrar pago</button> : null}
        <div className="sec">Partidas</div>
        <div className="box">
          {items.map((i, k) => (
            <div className="qline" key={k}>
              <div className="n"><b>{i.title}{i.list_price != null ? <span className="special">Precio especial · antes {money(i.list_price)}</span> : null}</b><small>{[qtyLabel(i.qty, i.sale_unit) + ' × ' + money(i.unit_price), ...i.opts, i.notes].filter(Boolean).join(' · ')}</small></div>
              <div className="r"><b>{money(i.line_total)}</b></div>
            </div>
          ))}
          <div className="kv"><span>Subtotal</span><b>{money(sale.subtotal)}</b></div>
          <div className="kv"><span>IVA {ticket.taxRate}%</span><b>{money(sale.tax)}</b></div>
          <div className="kv big"><span>Total</span><b>{money(sale.total)}</b></div>
        </div>
        <div className="sec">Historial de pagos</div>
        <div className="box">
          <PaymentHistory total={sale.total} payments={payments} preorder={sale.source === 'encargo'} />
        </div>
        <div className="rowbtn">
          <button className="btn ghost sm" onClick={() => tkRef.current && exportJpg(tkRef.current, `ticket-${folio('V', sale.folio)}.jpg`).catch(() => toast('No se pudo generar la imagen', true))}><Icon name="download" size={16} /> Descargar ticket JPG</button>
          <button className="btn ghost sm" onClick={() => window.print()}><Icon name="printer" size={16} /> Imprimir ticket</button>
        </div>
        {canCancel && !cancelled ? (
          <div className="danger"><button className="del" disabled={busy} onClick={() => confirm('¿Cancelar esta venta? Se regresan las existencias al inventario.') && run(cancelSaleAction(sale.id), 'Venta cancelada')}><Icon name="x" size={15} /> Cancelar venta</button></div>
        ) : null}

        {/* Render dedicado para exportar / imprimir */}
        <div style={{ position: 'absolute', left: -9999, top: 0 }}>
          <Ticket s={ticket.settings} business={ticket.business} qrUrl={ticket.qrUrl} qrLabel={ticket.qrLabel} taxRate={ticket.taxRate} cashier={sale.cashier} device={device} printable
            sale={{ folio: sale.folio, date: sale.date, items, subtotal: sale.subtotal, tax: sale.tax, total: sale.total, payments: payments.map((p) => ({ method: p.method, amount: p.amount })), cash_received: sale.cash_received, change: sale.change,
              balance: sale.balance, preorder: sale.source === 'encargo' && sale.delivery_at ? { customer: sale.customer ?? '', phone: sale.phone, deliveryAt: sale.delivery_at, notes: sale.notes, fields: sale.fields } : null }} />
          <div ref={tkRef} className="tk-export">
            <Ticket s={ticket.settings} business={ticket.business} qrUrl={ticket.qrUrl} qrLabel={ticket.qrLabel} taxRate={ticket.taxRate} cashier={sale.cashier} device={device}
            sale={{ folio: sale.folio, date: sale.date, items, subtotal: sale.subtotal, tax: sale.tax, total: sale.total, payments: payments.map((p) => ({ method: p.method, amount: p.amount })), cash_received: sale.cash_received, change: sale.change,
              balance: sale.balance, preorder: sale.source === 'encargo' && sale.delivery_at ? { customer: sale.customer ?? '', phone: sale.phone, deliveryAt: sale.delivery_at, notes: sale.notes, fields: sale.fields } : null }} />
          </div>
        </div>
      </div>
      {edit ? <EditPreorder sale={sale} orderTypes={orderTypes} suggestions={fieldSuggestions} onClose={() => setEdit(false)} /> : null}
      {pay ? <PaymentSheet saleId={sale.id} balance={sale.balance} onClose={() => setPay(false)} /> : null}
    </>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function EditPreorder({ sale, orderTypes, suggestions, onClose }: { sale: Sale; orderTypes: string[]; suggestions: string[]; onClose: () => void }) {
  const { run, busy } = useAction()
  const [name, setName] = useState(sale.customer ?? '')
  const [phone, setPhone] = useState((sale.phone ?? '').replace(/\D/g, '').slice(-10))
  const [deliveryAt, setDeliveryAt] = useState(toLocalInput(sale.delivery_at))
  const [orderType, setOrderType] = useState(sale.order_type)
  const [notes, setNotes] = useState(sale.notes ?? '')
  const [fields, setFields] = useState(sale.fields)
  const types = orderTypes.includes(sale.order_type) ? orderTypes : [sale.order_type, ...orderTypes]
  const ok = name.trim().length >= 2 && (phone === '' || phone.length === 10) && !!deliveryAt
  const save = async () => {
    const r = await run(updatePreorderAction(sale.id, { customer_name: name, phone, delivery_at: new Date(deliveryAt).toISOString(), order_type: orderType as 'mostrador',
      notes, custom_fields: fields.filter((f) => f.label.trim()).map((f) => ({ label: f.label.trim(), value: f.value.trim() })) }), 'Pedido actualizado')
    if (r) onClose()
  }
  return (
    <Sheet title="Editar pedido" onClose={onClose} top={40}>
      <div className="sec" style={{ marginTop: 0 }}>Cliente</div>
      <Field label="Nombre del cliente"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
      <Field label="Teléfono (10 dígitos)"><PhoneInput value={phone} onChange={setPhone} /></Field>
      <div className="sec">Entrega</div>
      <Field label="Día y hora de entrega"><DateField withTime value={deliveryAt} onChange={setDeliveryAt} /></Field>
      {types.length > 1 ? (
        <Field label="Cómo se entrega">
          <select className="inp" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{ORDER_TYPE_LABELS[t] ?? t}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Características"><textarea className="inp" value={notes} maxLength={600} onChange={(e) => setNotes(e.target.value)} /></Field>
      <FieldsEditor fields={fields} setFields={setFields} suggestions={suggestions} />
      <div className="hint">Los productos y los pagos no se cambian aquí. Para cobrar el resto usa Registrar pago.</div>
      <div className="wnav">
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn" disabled={busy || !ok} onClick={save}><Icon name="check" /> {busy ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </Sheet>
  )
}
