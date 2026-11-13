'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { cashMovementAction, closeCashAction, openCashAction } from '@/app/actions/sales'
import { Icon } from '@/components/icons'
import { Field, Seg, Sheet, useAction } from '@/components/ui'
import { centsMoney, money, toCents } from '@/lib/money'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function CashCut({ session, summary, moves, canClose, businessName }: {
  session: { id: string; device: string; by: string; at: string } | null; summary: any; moves: { type: string; amount: string; reason: string | null }[]; canClose: boolean; businessName: string
}) {
  const router = useRouter()
  const { run, busy } = useAction()
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [mv, setMv] = useState(false)
  const [mvType, setMvType] = useState<'in' | 'out'>('out')
  const [mvAmt, setMvAmt] = useState('')
  const [mvReason, setMvReason] = useState('')
  if (!session) {
    return (
      <div className="box">
        <b style={{ fontSize: 14 }}>La caja está cerrada</b>
        <div className="hint" style={{ marginBottom: 12 }}>Ábrela con el fondo inicial para empezar a cobrar.</div>
        <Field label="Fondo inicial"><div className="money"><input className="inp" inputMode="decimal" value={opening} placeholder="0.00" onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setOpening(e.target.value)} /></div></Field>
        <button className="btn" disabled={busy || !canClose} onClick={async () => { if (await run(openCashAction(opening || '0'), 'Caja abierta')) router.refresh() }}>Abrir caja</button>
      </div>
    )
  }
  const s = summary
  const diff = counted === '' ? null : toCents(counted) - toCents(s.expected)
  return (
    <>
      <div className="box printable-cut">
        <div className="prn"><span className="qi"><Icon name="cash" /></span><div><b>{session.device} · turno abierto</b><small>Abrió {session.by} · {session.at}</small></div></div>
      </div>
      <div className="sec">Ventas del turno ({s.sales_count})</div>
      <div className="box">
        <div className="kv"><span>Efectivo</span><b>{money(s.sales_cash)}</b></div>
        <div className="kv"><span>Tarjeta</span><b>{money(s.sales_card)}</b></div>
        <div className="kv"><span>Transferencia</span><b>{money(s.sales_transfer)}</b></div>
        <div className="kv big"><span>Total vendido</span><b>{money(s.sales_total)}</b></div>
      </div>
      <div className="sec">Efectivo en caja</div>
      <div className="box">
        <div className="kv"><span>Fondo inicial</span><b>{money(s.opening)}</b></div>
        <div className="kv"><span>Efectivo de ventas</span><b>{money(s.sales_cash)}</b></div>
        <div className="kv"><span>Abonos en efectivo</span><b>{money(s.abonos_cash)}</b></div>
        <div className="kv"><span>Entradas</span><b>{money(s.cash_in)}</b></div>
        <div className="kv"><span>Retiros</span><b className="neg">−{money(s.cash_out)}</b></div>
        {moves.map((m, i) => <div className="kv" key={i} style={{ fontSize: 12 }}><span>· {m.type === 'in' ? 'Entrada' : 'Retiro'}: {m.reason}</span><span>{money(m.amount)}</span></div>)}
        <div className="kv big"><span>Efectivo esperado</span><b>{money(s.expected)}</b></div>
        <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setMv(true)}><Icon name="swap" size={16} /> Registrar entrada o retiro</button>
      </div>
      {Number(s.abonos_other) > 0 ? <div className="hint">Abonos por tarjeta/transferencia en el turno: {money(s.abonos_other)}</div> : null}
      <div className="sec">Cerrar caja</div>
      <div className="box">
        <Field label="Efectivo contado"><div className="money"><input className="inp" inputMode="decimal" value={counted} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setCounted(e.target.value)} /></div></Field>
        {diff !== null ? (
          <div className={`diff ${diff === 0 ? 'ok' : 'bad'}`} style={diff > 0 ? { background: '#FFF3D6', color: '#A26700' } : undefined}>
            <span>{diff === 0 ? 'La caja cuadra' : diff > 0 ? 'Sobrante' : 'Faltante'}</span><b>{centsMoney(Math.abs(diff))}</b>
          </div>
        ) : null}
        <div style={{ height: 12 }} />
        <Field label="Notas (opcional)"><input className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field>
        <button className="btn dark" disabled={busy || counted === '' || !canClose}
          onClick={async () => { if (!confirm('¿Cerrar la caja con este conteo?')) return; if (await run(closeCashAction(session.id, counted, notes), 'Caja cerrada')) { window.print(); router.refresh() } }}>
          <Icon name="lock" /> Cerrar caja e imprimir corte
        </button>
      </div>
      {/* Ticket de corte (variante del ticket) */}
      <div style={{ position: 'absolute', left: -9999, top: 0 }}>
        <div className="tk printable" style={{ width: 219 }}>
          <div className="tk-name">{businessName}</div>
          <div className="tk-sub">Corte de caja · {session.device}</div>
          <div className="tk-meta"><div><span>Abrió</span><b>{session.by}</b></div><div><span>Apertura</span><b>{session.at}</b></div></div>
          <div className="tk-sum">
            <div><span>Ventas efectivo</span><span>{money(s.sales_cash)}</span></div><div><span>Ventas tarjeta</span><span>{money(s.sales_card)}</span></div>
            <div><span>Ventas transferencia</span><span>{money(s.sales_transfer)}</span></div><div><span>Abonos efectivo</span><span>{money(s.abonos_cash)}</span></div>
            <div><span>Fondo</span><span>{money(s.opening)}</span></div><div><span>Entradas</span><span>{money(s.cash_in)}</span></div><div><span>Retiros</span><span>-{money(s.cash_out)}</span></div>
          </div>
          <div className="tk-total"><span>ESPERADO</span><b>{money(s.expected)}</b></div>
          <div className="tk-pay"><div><span>Contado</span><span>{money(counted || 0)}</span></div><div><span>Diferencia</span><span>{centsMoney(diff ?? 0)}</span></div></div>
        </div>
      </div>
      {mv ? (
        <Sheet title="Entrada o retiro" onClose={() => setMv(false)} top={220}>
          <Seg value={mvType} options={[['out', 'Retiro'], ['in', 'Entrada']]} onChange={setMvType} />
          <div style={{ height: 12 }} />
          <Field label="Monto"><div className="money"><input className="inp" inputMode="decimal" value={mvAmt} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setMvAmt(e.target.value)} /></div></Field>
          <Field label="Motivo"><input className="inp" value={mvReason} onChange={(e) => setMvReason(e.target.value)} placeholder="Ej. Pago a proveedor" maxLength={120} /></Field>
          <button className="btn" disabled={busy} onClick={async () => { if (await run(cashMovementAction(session.id, mvType, mvAmt, mvReason), 'Movimiento registrado')) { setMv(false); setMvAmt(''); setMvReason('') } }}>Guardar</button>
        </Sheet>
      ) : null}
    </>
  )
}
