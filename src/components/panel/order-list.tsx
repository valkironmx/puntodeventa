'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { decideOrderAction } from '@/app/actions/orders'
import { Icon } from '@/components/icons'
import { useAction } from '@/components/ui'
import { qtyLabel } from '@/lib/format'
import { ORDER_TYPE_LABELS } from '@/lib/mode-defaults'
import { money } from '@/lib/money'

interface Row { id: string; folio: number; name: string; type: string; address: string | null; items: { title: string; qty: number; sale_unit: string; options: string[]; notes: string | null; line_total: string }[]; total: string; status: string; reason: string | null; at: string }
const ST: Record<string, [string, string]> = { pending: ['espera', 'Pendiente'], confirmed: ['aceptada', 'Confirmada'], completed: ['vencida', 'Entregada'], rejected: ['rechazada', 'No aceptada'], cancelled: ['cancelada', 'Cancelada'] }
const F: [string, string][] = [['pending', 'Pendientes'], ['confirmed', 'Confirmados'], ['done', 'Terminados'], ['all', 'Todos']]

export function OrderList({ rows, filter, pending, service }: { rows: Row[]; filter: string; pending: number; service: boolean }) {
  const router = useRouter()
  const { run, busy } = useAction()
  // Llegan solicitudes nuevas sin recargar
  useEffect(() => { const t = setInterval(() => router.refresh(), 15000); return () => clearInterval(t) }, [router])
  const reject = (r: Row) => { const why = prompt('Motivo (opcional, lo verá el cliente)', ''); if (why !== null) run(decideOrderAction(r.id, 'rejected', why), 'Solicitud no aceptada') }
  return (
    <>
      <div className="chips" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
        {F.map(([k, l]) => <Link key={k} href={`/app/pedidos?t=web&f=${k}`} className={`chip ${filter === k ? 'on' : ''}`}>{l}{k === 'pending' && pending ? ` (${pending})` : ''}</Link>)}
      </div>
      <div className="cards">
        {rows.map((r) => (
          <div className={`qcard ordp ${r.status}`} key={r.id}>
            <div className="t"><span className="f">P-{String(r.folio).padStart(4, '0')} · {r.at}</span><span className={`st ${ST[r.status][0]}`}>{ST[r.status][1]}</span></div>
            <div className="c">{r.name}</div>
            <div className="hint" style={{ marginTop: 0 }}>{ORDER_TYPE_LABELS[r.type] ?? r.type}{r.address ? ` · ${r.address}` : ''}</div>
            <div className="ordp-items">
              {r.items.map((i, k) => <div key={k}><span>{qtyLabel(i.qty, i.sale_unit)} × {i.title}{i.options?.length ? ` (${i.options.join(', ')})` : ''}{i.notes ? ` · ${i.notes}` : ''}</span><b>{money(i.line_total)}</b></div>)}
            </div>
            <div className="b"><span>Total</span><b>{money(r.total)}</b></div>
            {r.reason ? <div className="hint">Motivo: {r.reason}</div> : null}
            {r.status === 'pending' ? (
              <div className="rowbtn" style={{ marginTop: 12 }}>
                <button className="btn ghost rj sm" disabled={busy} onClick={() => reject(r)}><Icon name="x" size={16} /> Rechazar</button>
                <button className="btn sm" disabled={busy} onClick={() => run(decideOrderAction(r.id, 'confirmed'), 'Solicitud confirmada')}><Icon name="check" size={16} /> Confirmar</button>
              </div>
            ) : r.status === 'confirmed' ? (
              <button className="btn ghost sm" style={{ marginTop: 12 }} disabled={busy} onClick={() => run(decideOrderAction(r.id, 'completed'), service ? 'Marcado como atendido' : 'Marcado como entregado')}><Icon name="check" size={16} /> {service ? 'Marcar como atendido' : 'Marcar como entregado'}</button>
            ) : null}
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="cart-empty" style={{ paddingTop: 50 }}>
          <span><Icon name="bag" size={26} /></span><b>{filter === 'pending' ? 'No hay solicitudes pendientes' : 'Sin solicitudes'}</b>
          <small>Cuando un cliente toque "Solicitar {service ? 'servicio' : 'pedido'}" en tu página, aparecerá aquí para que la confirmes.</small>
        </div>
      ) : null}
    </>
  )
}
