'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { decideAppointmentAction } from '@/app/actions/booking'
import { Icon } from '@/components/icons'
import { useAction } from '@/components/ui'
import { APPT_ST } from '@/lib/appt'
import { ago, waLink } from '@/lib/format'
import { moneyShort } from '@/lib/money'

export interface Appt { id: string; status: string; time: string; startsAt: string; service: string; dur: number | null; price: string; customer: string; phone: string | null; created: string; source: string; staff: string; dayLabel: string; reminder: string }

export function ApptList({ pending, agenda, isToday, businessName }: { pending: Appt[]; agenda: Appt[]; isToday: boolean; businessName: string }) {
  const router = useRouter()
  const { run, busy } = useAction()
  const [notify, setNotify] = useState<{ a: Appt; ok: boolean } | null>(null)
  // "Tiempo real": refresca la lista cada 10 s (en Supabase se cambia por Realtime)
  useEffect(() => { const t = setInterval(() => router.refresh(), 10000); return () => clearInterval(t) }, [router])
  const decide = async (a: Appt, ok: boolean) => {
    let reason = ''
    if (!ok) { const r = prompt('Motivo del rechazo (opcional)', ''); if (r === null) return; reason = r }
    if (await run(decideAppointmentAction(a.id, ok ? 'accept' : 'reject', reason), ok ? 'Cita aceptada' : 'Cita rechazada')) setNotify({ a, ok })
  }
  const now = Date.now()
  const nowIdx = agenda.findIndex((a) => new Date(a.startsAt).getTime() > now)
  const reminders = agenda.filter((a) => a.status === 'confirmed' && a.phone && new Date(a.startsAt).getTime() > now)
  return (
    <>
      {notify ? (
        <div className="allok" style={{ marginBottom: 12 }}>
          <Icon name="check" /> <span style={{ flex: 1 }}>{notify.ok ? 'Aceptada' : 'Rechazada'}: {notify.a.customer}</span>
          {notify.a.phone ? <a className="btn wa sm" style={{ width: 'auto', padding: '0 12px' }} target="_blank" rel="noopener noreferrer"
            href={waLink(notify.a.phone, notify.ok ? `Hola ${notify.a.customer}, tu cita en ${businessName} quedó CONFIRMADA: ${notify.a.service} el ${notify.a.dayLabel} a las ${notify.a.time}. ¡Te esperamos!`
              : `Hola ${notify.a.customer}, lamentamos avisarte que no podemos atender tu solicitud de ${notify.a.service} el ${notify.a.dayLabel} a las ${notify.a.time}. Puedes elegir otro horario.`)}><Icon name="wa" size={15} /> Avisar por WhatsApp</a> : null}
        </div>
      ) : null}
      <div className="appt-cols"><div>
      <div className="shead" style={{ justifyContent: 'flex-start' }}><b>Por aprobar</b>{pending.length ? <span className="cnt">{pending.length}</span> : null}</div>
      {pending.length === 0 ? <div className="allok" style={{ marginBottom: 18 }}><Icon name="check" /> No hay solicitudes pendientes</div> : null}
      {pending.map((a) => (
        <div className="rq" key={a.id}>
          <Link href={`/app/citas/${a.id}`} className="rq-t">
            <div><div className="rq-h">{a.time}</div><div className="rq-s">{a.dayLabel}</div><div className="rq-s">{a.service}{a.dur ? ` · ${a.dur} min` : ''} · {moneyShort(a.price)}</div></div>
            <em style={{ background: 'var(--g2)', color: 'var(--g)' }}>{a.staff}</em>
          </Link>
          <div className="rq-c"><b>{a.customer}</b><small><Icon name="clock" size={13} /> Solicitada {a.source === 'online' ? 'en línea ' : ''}{ago(a.created)}</small></div>
          <div className="rowbtn">
            <button className="btn ghost rj" disabled={busy} onClick={() => decide(a, false)}><Icon name="x" /> Rechazar</button>
            <button className="btn" disabled={busy} onClick={() => decide(a, true)}><Icon name="check" /> Aceptar</button>
          </div>
        </div>
      ))}
      </div><div>
      <div className="shead agenda-h"><b>Agenda del día</b><small className="mut">{agenda.length} citas</small></div>
      {agenda.length === 0 ? <div className="empty">Sin citas este día.</div> : null}
      {agenda.map((a, i) => (
        <div key={a.id}>
          {isToday && i === nowIdx ? <div className="nowline">Ahora</div> : null}
          <Link href={`/app/citas/${a.id}`} className="arow" style={{ borderLeftColor: APPT_ST[a.status][2], opacity: ['cancelled', 'rejected', 'expired', 'no_show'].includes(a.status) ? 0.6 : 1 }}>
            <div className="at"><b>{a.time.replace(/ (am|pm)/, '')}</b><small>{a.time.slice(-2)}</small></div>
            <div className="ai"><b>{a.customer}</b><span>{a.service} · {a.staff}</span><em className={`st ${APPT_ST[a.status][0]}`} style={{ padding: '3px 9px' }}>{APPT_ST[a.status][1]}</em></div>
            <Icon name="chevR" size={18} />
          </Link>
        </div>
      ))}
      {isToday && nowIdx === -1 && agenda.length ? <div className="nowline">Ahora</div> : null}
      {reminders.length ? (
        <>
          <div className="shead" style={{ marginTop: 18 }}><b>Recordatorios de hoy</b></div>
          {reminders.map((a) => (
            <div className="lrow" key={a.id} style={{ padding: 12 }}>
              <div className="li"><b>{a.customer}</b><div className="meta">{a.time} · {a.service}</div></div>
              <a className="btn wa sm" style={{ width: 'auto', padding: '0 12px' }} target="_blank" rel="noopener noreferrer" href={waLink(a.phone, a.reminder)}><Icon name="wa" size={15} /> Recordar</a>
            </div>
          ))}
        </>
      ) : null}
      </div></div>
    </>
  )
}
