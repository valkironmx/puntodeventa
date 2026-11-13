'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { publicOrderAction } from '@/app/actions/orders'
import { Icon } from '@/components/icons'
import { useToast } from '@/components/ui'
import { exportJpg } from '@/lib/export-image'
import { fmtDateTime, qtyLabel, waLink } from '@/lib/format'
import { ORDER_TYPE_LABELS } from '@/lib/mode-defaults'
import { money } from '@/lib/money'

interface Item { title: string; qty: number; sale_unit: string; options: string[]; notes: string | null; line_total: string }
interface Order { folio: number; status: string; customer_name: string; order_type: string; address: string | null; items: Item[]; total: string; reject_reason: string | null; created_at: string }

const ST: Record<string, [string, string, string]> = {
  pending: ['Pendiente', 'Tu solicitud está en espera de que el negocio la confirme.', 'clock'],
  confirmed: ['Confirmada', 'El negocio confirmó tu solicitud.', 'check'],
  completed: ['Entregada', 'Tu pedido fue entregado. ¡Gracias!', 'check'],
  rejected: ['No aceptada', 'El negocio no pudo aceptar tu solicitud.', 'x'],
  cancelled: ['Cancelada', 'Esta solicitud fue cancelada.', 'x'],
}
const folio = (n: number) => `P-${String(n).padStart(4, '0')}`

export function OrderStatus({ token, initial, business }: { token: string; initial: Order; business: { slug: string; name: string; mode: string; logo: string | null; whatsapp: string | null } }) {
  const [o, setO] = useState(initial)
  const card = useRef<HTMLDivElement>(null)
  const toast = useToast()
  // Se actualiza sola mientras está pendiente
  useEffect(() => {
    if (o.status !== 'pending') return
    const t = setInterval(() => { publicOrderAction(token).then((x) => x && setO(x)).catch(() => {}) }, 15000)
    return () => clearInterval(t)
  }, [o.status, token])
  const st = ST[o.status] ?? ST.pending
  const word = business.mode === 'service' ? 'servicio' : 'pedido'
  const waText = [`Hola, soy ${o.customer_name}.`, '', `Mi ${word} (${folio(o.folio)}):`,
    ...o.items.map((i) => `• ${qtyLabel(i.qty, i.sale_unit)} × ${i.title}${i.options?.length ? ` (${i.options.join(', ')})` : ''} — ${money(i.line_total)}`),
    '', `Total: ${money(o.total)}`, `Entrega: ${ORDER_TYPE_LABELS[o.order_type] ?? o.order_type}`, ...(o.address ? [`Dirección: ${o.address}`] : [])].join('\n')
  return (
    <div className="scroll pad" style={{ paddingTop: 26 }}>
      <div ref={card} className="ord-card">
        <div className={`ord-st ${o.status}`}><span><Icon name={st[2]} size={30} stroke={2.6} /></span></div>
        <div className="ord-badge">{st[0]}</div>
        <h1>{o.status === 'pending' ? `Solicitud de ${word} enviada` : `Solicitud ${st[0].toLowerCase()}`}</h1>
        <p className="mut">{st[1]}{o.status === 'rejected' && o.reject_reason ? ` Motivo: ${o.reject_reason}` : ''}</p>
        <div className="ord-meta">
          <div><span>Folio</span><b>{folio(o.folio)}</b></div>
          <div><span>Fecha</span><b>{fmtDateTime(o.created_at)}</b></div>
          <div><span>A nombre de</span><b>{o.customer_name}</b></div>
          <div><span>Entrega</span><b>{ORDER_TYPE_LABELS[o.order_type] ?? o.order_type}</b></div>
          {o.address ? <div className="full"><span>Dirección</span><b>{o.address}</b></div> : null}
        </div>
        <div className="ord-items">
          {o.items.map((i, k) => (
            <div key={k}>
              <span className="q">{qtyLabel(i.qty, i.sale_unit)}</span>
              <span className="n">{i.title}{i.options?.length ? <small>{i.options.join(', ')}</small> : null}{i.notes ? <small>Nota: {i.notes}</small> : null}</span>
              <b>{money(i.line_total)}</b>
            </div>
          ))}
          <div className="tot"><span>Total</span><b>{money(o.total)}</b></div>
        </div>
        <div className="ord-biz">{business.logo ? <img src={business.logo} alt="" /> : null}<span>{business.name}</span></div>
      </div>
      <div className="rowbtn" style={{ marginTop: 16 }}>
        <button className="btn ghost" onClick={() => card.current && exportJpg(card.current, `solicitud-${folio(o.folio)}.jpg`, true).catch(() => toast('No se pudo generar la imagen', true))}><Icon name="download" size={18} /> Descargar imagen</button>
        {business.whatsapp ? <a className="btn wa" href={waLink(business.whatsapp, waText)} target="_blank" rel="noopener noreferrer"><Icon name="wa" size={18} /> WhatsApp</a> : null}
      </div>
      <p className="hint" style={{ textAlign: 'center' }}>Guarda esta página para revisar el estado de tu solicitud.</p>
      <Link href={`/${business.slug}`} className="btn ghost sm" style={{ marginTop: 6 }}>Volver a {business.name}</Link>
    </div>
  )
}
