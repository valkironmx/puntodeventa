'use client'
import { useState } from 'react'
import { addPaymentAction } from '@/app/actions/sales'
import { Icon } from '@/components/icons'
import { Field, Seg, Sheet, useAction } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'
import { centsMoney, money, toCents } from '@/lib/money'

export interface PayRow { id: string; amount: string; method: string; note: string | null; by?: string; date: string; initial?: boolean }
const METHOD: Record<string, [string, string]> = { cash: ['Efectivo', 'cash'], card: ['Tarjeta', 'card'], transfer: ['Transferencia', 'swap'] }

/** Historial con lo que resta después de cada pago, hasta liquidar. */
export function PaymentHistory({ total, payments, preorder }: { total: string; payments: PayRow[]; preorder?: boolean }) {
  const t = toCents(total)
  let acc = 0
  if (payments.length === 0) return <div className="mut" style={{ padding: '6px 0' }}>Aún no hay pagos.</div>
  return (
    <ol className="phist">
      {payments.map((p, i) => {
        acc += toCents(p.amount)
        const left = Math.max(0, t - acc)
        const label = p.initial ? (preorder ? 'Anticipo' : 'Pago en caja') : `Abono ${payments.slice(0, i + 1).filter((x) => !x.initial).length}`
        return (
          <li key={p.id} className={left === 0 ? 'paid' : ''}>
            <span className="phist-dot"><Icon name={left === 0 ? 'check' : METHOD[p.method]?.[1] ?? 'cash'} size={14} stroke={left === 0 ? 3 : 2} /></span>
            <div className="phist-main">
              <div className="phist-top"><b>{label}</b><b>{money(p.amount)}</b></div>
              <small>{fmtDateTime(p.date)} · {METHOD[p.method]?.[0] ?? p.method}{p.by ? ` · ${p.by}` : ''}{p.note ? ` · ${p.note}` : ''}</small>
              <div className="phist-left">{left === 0 ? 'Liquidado' : `Resta ${centsMoney(left)}`}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Ventana para registrar un abono. */
export function PaymentSheet({ saleId, balance, title = 'Registrar pago', onClose, onDone }: { saleId: string; balance: string; title?: string; onClose: () => void; onDone?: () => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const { run, busy } = useAction()
  const over = toCents(amount) > toCents(balance)
  const left = Math.max(0, toCents(balance) - toCents(amount))
  return (
    <Sheet title={title} onClose={onClose} top={160}>
      <div className="pay-due"><span>Saldo pendiente</span><b>{money(balance)}</b></div>
      <Field label="Monto que paga hoy"><div className="money"><input className="inp" inputMode="decimal" autoFocus value={amount} placeholder="0.00" onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setAmount(e.target.value)} /></div></Field>
      <div className="rowbtn" style={{ marginBottom: 12 }}>
        <button className="chip" onClick={() => setAmount(String(Number(balance)))}>Liquidar todo</button>
        <button className="chip" onClick={() => setAmount((Math.round(Number(balance) * 50) / 100).toFixed(2))}>La mitad</button>
      </div>
      <Field label="Método"><Seg value={method} options={[['cash', 'Efectivo'], ['card', 'Tarjeta'], ['transfer', 'Transferencia']]} onChange={setMethod} /></Field>
      <Field label="Nota (opcional)"><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} /></Field>
      {over ? <div className="hint" style={{ color: '#C53030' }}>No puede ser mayor al saldo.</div>
        : toCents(amount) > 0 ? <div className="hint">{left === 0 ? 'Con este pago queda liquidado.' : `Después de este pago restan ${centsMoney(left)}.`}</div> : null}
      <button className="btn" disabled={busy || !(Number(amount) > 0) || over} onClick={async () => { if (await run(addPaymentAction(saleId, amount, method, note), left === 0 ? 'Pago registrado · liquidado' : 'Pago registrado')) { onDone?.(); onClose() } }}>
        <Icon name="check" /> Guardar pago
      </button>
    </Sheet>
  )
}
