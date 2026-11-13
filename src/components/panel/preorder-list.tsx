'use client'
import Link from 'next/link'
import { useState } from 'react'
import { setDeliveredAction } from '@/app/actions/sales'
import { Icon } from '@/components/icons'
import { longDate, longTime } from '@/components/inputs'
import { PaymentHistory, PaymentSheet, type PayRow } from '@/components/panel/payments'
import { useAction } from '@/components/ui'
import { folio, qtyLabel } from '@/lib/format'
import { ORDER_TYPE_LABELS } from '@/lib/mode-defaults'
import { money } from '@/lib/money'

export interface PreorderRow {
  id: string; folio: number; customer: string; phone: string | null; orderType: string; deliveryAt: string; deliveredAt: string | null; status: string
  total: string; paid: string; balance: string; notes: string | null; fields: { label: string; value: string }[]
  items: { title: string; qty: string; sale_unit: string; notes: string | null }[]; payments: PayRow[]
}

const F: [string, string][] = [['proximos', 'Por entregar'], ['saldo', 'Con saldo'], ['entregados', 'Entregados'], ['todos', 'Todos']]
const pad = (n: number) => String(n).padStart(2, '0')
const localYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function when(iso: string): { day: string; time: string; tag: string | null; late: boolean } {
  const d = new Date(iso)
  const ymd = localYmd(d)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const tag = ymd === localYmd(today) ? 'Hoy' : ymd === localYmd(tomorrow) ? 'Mañana' : null
  return { day: longDate(ymd), time: longTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`), tag, late: d.getTime() < Date.now() }
}

export function PreorderList({ rows, filter, canManage, counts }: { rows: PreorderRow[]; filter: string; canManage: boolean; counts: { proximos: number; saldo: number } }) {
  const { run, busy } = useAction()
  const [pay, setPay] = useState<PreorderRow | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const deliver = (r: PreorderRow) => {
    if (Number(r.balance) > 0 && !confirm(`Aún debe ${money(r.balance)}. ¿Marcar como entregado de todos modos?`)) return
    run(setDeliveredAction(r.id, true), 'Pedido entregado')
  }
  return (
    <>
      <div className="chips" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
        {F.map(([k, l]) => (
          <Link key={k} href={`/app/pedidos?t=pos&f=${k}`} className={`chip ${filter === k ? 'on' : ''}`}>
            {l}{k === 'proximos' && counts.proximos ? ` (${counts.proximos})` : k === 'saldo' && counts.saldo ? ` (${counts.saldo})` : ''}
          </Link>
        ))}
      </div>
      <div className="cards">
        {rows.map((r) => {
          const w = when(r.deliveryAt)
          const cancelled = r.status === 'cancelled'
          const delivered = !!r.deliveredAt
          const pct = Number(r.total) > 0 ? Math.min(100, Math.round((Number(r.paid) / Number(r.total)) * 100)) : 0
          const st: [string, string] = cancelled ? ['cancelada', 'Cancelado'] : delivered ? ['aceptada', 'Entregado'] : w.late ? ['rechazada', 'Atrasado'] : ['espera', 'Por entregar']
          return (
            <div className={`qcard pre-card ${cancelled ? 'off' : ''}`} key={r.id}>
              <div className="t"><span className="f">{folio('V', r.folio)}</span><span className={`st ${st[0]}`}>{st[1]}</span></div>
              <div className="pre-when">
                <span className="pre-cal"><Icon name="calendar" size={18} /></span>
                <div><b>{w.tag ? <em>{w.tag}</em> : null}{w.day}</b><small>{w.time} · {ORDER_TYPE_LABELS[r.orderType] ?? r.orderType}</small></div>
              </div>
              <div className="c" style={{ marginTop: 10 }}>{r.customer}</div>
              {r.phone ? <a className="lk" href={`tel:${r.phone}`} style={{ fontSize: 13 }}>{r.phone.replace(/(\d{2,3})(\d{3,4})(\d{4})$/, '$1 $2 $3')}</a> : null}
              <div className="ordp-items">
                {r.items.map((i, k) => <div key={k}><span>{qtyLabel(i.qty, i.sale_unit)} × {i.title}{i.notes ? ` · ${i.notes}` : ''}</span></div>)}
              </div>
              {r.notes ? <p className="mut" style={{ margin: '6px 0 0', fontSize: 13, whiteSpace: 'pre-wrap' }}>{r.notes}</p> : null}
              {r.fields.map((f, i) => <div className="hint" style={{ margin: '2px 0 0' }} key={i}>{f.label}: <b>{f.value}</b></div>)}

              <div className="pre-pay">
                <div className="pre-pay-top"><span>Pagado {money(r.paid)} de {money(r.total)}</span><b className={Number(r.balance) > 0 ? '' : 'ok'}>{Number(r.balance) > 0 ? `Resta ${money(r.balance)}` : 'Liquidado'}</b></div>
                <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                <button type="button" className="pre-hist-t" onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))} aria-expanded={!!open[r.id]}>
                  Historial de pagos ({r.payments.length}) <Icon name="chevR" size={14} style={{ transform: open[r.id] ? 'rotate(90deg)' : undefined }} />
                </button>
                {open[r.id] ? <PaymentHistory total={r.total} payments={r.payments} preorder /> : null}
              </div>

              {!cancelled ? (
                <div className="rowbtn" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                  {Number(r.balance) > 0 ? <button className="btn sm" disabled={busy} onClick={() => setPay(r)}><Icon name="plus" size={16} /> Registrar pago</button> : null}
                  {delivered
                    ? <button className="btn ghost sm" disabled={busy} onClick={() => run(setDeliveredAction(r.id, false), 'Pedido marcado como pendiente')}><Icon name="refresh" size={16} /> Deshacer entrega</button>
                    : <button className="btn ghost sm" disabled={busy} onClick={() => deliver(r)}><Icon name="check" size={16} /> Marcar como entregado</button>}
                  {canManage ? <Link className="btn ghost sm" href={`/app/ventas/${r.id}`}><Icon name="doc" size={16} /> Detalle</Link> : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {rows.length === 0 ? (
        <div className="cart-empty" style={{ paddingTop: 50 }}>
          <span><Icon name="calendar" size={26} /></span><b>{filter === 'proximos' ? 'No hay pedidos por entregar' : 'Sin pedidos'}</b>
          <small>Los pedidos que registres en el punto de venta con la pestaña Pedido aparecen aquí con su fecha de entrega y sus pagos.</small>
          <Link className="btn sm" href="/app/pos" style={{ marginTop: 14, width: 'auto', padding: '0 18px' }}><Icon name="plus" size={16} /> Nuevo pedido</Link>
        </div>
      ) : null}
      {pay ? <PaymentSheet saleId={pay.id} balance={pay.balance} title={`Pago de ${pay.customer}`} onClose={() => setPay(null)} /> : null}
    </>
  )
}
