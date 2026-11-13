'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { decideAppointmentAction, rescheduleAppointmentAction, setAppointmentStatusAction } from '@/app/actions/booking'
import { Icon } from '@/components/icons'
import { Sheet, useAction } from '@/components/ui'
import { APPT_ST } from '@/lib/appt'
import { waLink } from '@/lib/format'
import { money } from '@/lib/money'
import { SlotPicker } from './slot-picker'

interface A { id: string; status: string; day: string; dayLabel: string; time: string; service: string; dur: number | null; price: string; customer: string; phone: string | null; notes: string | null; staff: string
  membershipId: string; productId: string | null; source: string; rejectReason: string | null; saleId: string | null }

export function ApptDetail({ a, events, staff, messages, manage, canDecide, canPos }: {
  a: A; events: { type: string; at: string; by: string }[]; staff: { id: string; name: string }[]; messages: { confirm: string; reject: string; remind: string }; manage: boolean; canDecide: boolean; canPos: boolean
}) {
  const router = useRouter()
  const { run, busy } = useAction()
  const [resched, setResched] = useState(false)
  const [slot, setSlot] = useState<{ at: string; membershipId: string } | null>(null)
  const st = APPT_ST[a.status]
  const wa = (text: string, label: string) => a.phone ? <a className="btn wa sm" target="_blank" rel="noopener noreferrer" href={waLink(a.phone, text)}><Icon name="wa" size={16} /> {label}</a> : null
  const decide = async (ok: boolean) => {
    let reason = ''
    if (!ok) { const r = prompt('Motivo del rechazo (opcional)', ''); if (r === null) return; reason = r }
    await run(decideAppointmentAction(a.id, ok ? 'accept' : 'reject', reason), ok ? 'Cita aceptada' : 'Cita rechazada')
  }
  const status = (s: 'completed' | 'no_show' | 'cancelled', msg: string) => (s !== 'cancelled' || confirm('¿Cancelar esta cita?')) && run(setAppointmentStatusAction(a.id, s), msg)
  return (
    <>
      <div className="scroll pad narrow">
        <div className="apcard">
          {a.status === 'pending' ? <span className="pill"><Icon name="clock" size={13} /> En espera de aprobación</span> : null}
          <small style={{ display: 'block' }}>{a.dayLabel}</small>
          <div className="apt">{a.time}</div>
          <div className="aps"><span>Servicio</span><b>{a.service}{a.dur ? ` · ${a.dur} min` : ''}</b></div>
          <div className="aps"><span>Con</span><b>{a.staff}</b></div>
          <div className="aps"><span>Precio</span><b>{money(a.price)}</b></div>
          <div className="apw"><span className={`st ${st[0]}`}>{st[1]}</span><span style={{ opacity: 0.7, fontWeight: 500 }}>{a.source === 'online' ? 'Reservada en línea' : 'Creada en el panel'}</span></div>
        </div>
        <div className="box">
          <div className="kv"><span>Cliente</span><b>{a.customer}</b></div>
          {a.phone ? <div className="kv"><span>WhatsApp</span><b>{a.phone}</b></div> : null}
          {a.notes ? <div className="kv"><span>Notas</span><b>{a.notes}</b></div> : null}
          {a.rejectReason ? <div className="kv"><span>Motivo de rechazo</span><b>{a.rejectReason}</b></div> : null}
        </div>
        {a.status === 'pending' && canDecide ? (
          <>
            <div className="rowbtn">
              <button className="btn ghost rj" disabled={busy} onClick={() => decide(false)}><Icon name="x" /> Rechazar</button>
              <button className="btn" disabled={busy} onClick={() => decide(true)}><Icon name="check" /> Aceptar</button>
            </div>
            <div style={{ marginTop: 10 }}>{wa(`Hola ${a.customer}, recibimos tu solicitud de cita. En breve te confirmamos.`, 'Escribir por WhatsApp')}</div>
          </>
        ) : null}
        {a.status === 'confirmed' ? (
          <>
            {canPos && !a.saleId ? <Link href={`/app/pos?cita=${a.id}`} className="btn"><Icon name="pos" /> Cobrar en punto de venta</Link> : null}
            <div className="rowbtn" style={{ marginTop: 10 }}>
              <button className="btn ghost sm" disabled={busy} onClick={() => status('completed', 'Marcada como completada')}><Icon name="check" size={16} /> Completada</button>
              <button className="btn ghost sm" disabled={busy} onClick={() => status('no_show', 'Marcada como no asistió')}>No asistió</button>
            </div>
            <div className="rowbtn" style={{ marginTop: 10 }}>
              {manage ? <button className="btn ghost sm" onClick={() => setResched(true)}><Icon name="calendar" size={16} /> Reagendar</button> : null}
              <button className="btn ghost sm rj" disabled={busy} onClick={() => status('cancelled', 'Cita cancelada')}>Cancelar</button>
            </div>
            <div className="sec">Avisar al cliente</div>
            <div className="rowbtn">{wa(messages.confirm, 'Confirmación')}{wa(messages.remind, 'Recordatorio')}</div>
          </>
        ) : null}
        {a.status === 'rejected' ? <div style={{ marginTop: 4 }}>{wa(messages.reject, 'Avisar por WhatsApp')}</div> : null}
        {a.saleId && manage ? <Link href={`/app/ventas/${a.saleId}`} className="btn ghost sm" style={{ marginTop: 10 }}><Icon name="receipt" size={16} /> Ver venta</Link> : null}
        <div className="sec">Historial</div>
        <div className="box">{events.map((e, i) => <div className="kv" key={i}><span>{e.at} · {e.by}</span><b>{e.type}</b></div>)}</div>
      </div>
      {resched && a.productId ? (
        <Sheet title="Reagendar" onClose={() => setResched(false)}>
          <SlotPicker productId={a.productId} staff={staff} initialDay={a.day} initialStaff={a.membershipId} ignoreId={a.id} value={slot} onChange={setSlot} />
          <button className="btn" style={{ marginTop: 16 }} disabled={busy || !slot} onClick={async () => { if (slot && await run(rescheduleAppointmentAction(a.id, slot.at, slot.membershipId), 'Cita reagendada')) { setResched(false); router.refresh() } }}>Guardar nuevo horario</button>
        </Sheet>
      ) : null}
    </>
  )
}
