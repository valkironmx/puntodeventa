'use client'
import { PhoneInput } from '@/components/inputs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { publicSlotsAction, requestAppointmentAction } from '@/app/actions/booking'
import { Icon } from '@/components/icons'
import { Field, Ph, useToast } from '@/components/ui'
import { fmtTime, initials } from '@/lib/format'
import { moneyShort } from '@/lib/money'

interface Svc { id: string; name: string; emoji: string | null; duration_min: number; price: string; price_from: boolean }

export function PublicBooking({ slug, businessId, services, staff, days, approval, initialService }: {
  slug: string; businessId: string; services: Svc[]; staff: { id: string; name: string }[]; days: { d: string; wd: string; num: number; long: string; today: boolean }[]; approval: boolean; initialService: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [svc, setSvc] = useState<string | null>(initialService ?? (services.length === 1 ? services[0].id : null))
  const [who, setWho] = useState<string | null>(null)   // null = cualquiera
  const [day, setDay] = useState(days[0].d)
  const [slots, setSlots] = useState<string[] | null>(null)
  const [at, setAt] = useState<string | null>(null)
  const [f, setF] = useState({ name: '', phone: '', notes: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!svc) return
    let live = true
    setSlots(null); setAt(null)
    publicSlotsAction(businessId, svc, who, day).then((r) => live && setSlots(r)).catch(() => live && setSlots([]))
    return () => { live = false }
  }, [businessId, svc, who, day])
  const s = services.find((x) => x.id === svc)
  const send = async () => {
    if (!svc || !at) return
    setBusy(true)
    const r = await requestAppointmentAction({ slug, productId: svc, membershipId: who, startsAt: at, ...f })
    setBusy(false)
    if (!r.ok) { toast(r.error, true); publicSlotsAction(businessId, svc, who, day).then(setSlots); setAt(null); return }
    router.push(`/${slug}/cita/${r.data}?nueva=1`)
  }
  if (services.length === 0) return <div className="scroll pad"><div className="empty">Aún no hay servicios para agendar.</div></div>
  return (
    <>
      <div className="scroll pad">
        <div className="bstep" style={{ marginTop: 4 }}><span>1</span> Servicio</div>
        {services.map((x) => (
          <button type="button" key={x.id} className={`svc ${svc === x.id ? 'on' : ''}`} onClick={() => setSvc(x.id)}>
            <Ph name={x.name} /><span style={{ textAlign: 'left', flex: 1 }}><b>{x.name}</b><small><Icon name="clock" size={11} /> {x.duration_min} min</small></span>
            <b>{x.price_from ? 'Desde ' : ''}{moneyShort(x.price)}</b>
          </button>
        ))}
        {svc ? (
          <>
            <div className="bstep"><span>2</span> ¿Con quién?</div>
            <div className="who" style={{ overflowX: 'auto' }}>
              <button type="button" className={`whoi ${who === null ? 'on' : ''}`} style={{ background: 'none', border: 0 }} onClick={() => setWho(null)}><span className="av"><Icon name="users" /></span>Cualquiera</button>
              {staff.map((m) => <button type="button" key={m.id} className={`whoi ${who === m.id ? 'on' : ''}`} style={{ background: 'none', border: 0 }} onClick={() => setWho(m.id)}><span className="av">{initials(m.name)}</span>{m.name}</button>)}
            </div>
            <div className="bstep"><span>3</span> Día</div>
            <div className="days">
              {days.map((x) => <button type="button" key={x.d} className={`day ${day === x.d ? 'on' : ''}`} style={{ minWidth: 48 }} onClick={() => setDay(x.d)}><small>{x.today ? 'Hoy' : x.wd}</small><b>{x.num}</b></button>)}
            </div>
            <div className="bstep"><span>4</span> Hora</div>
            {slots === null ? <div className="mut">Buscando horarios libres…</div> : slots.length === 0 ? <div className="vbox">No hay horarios libres este día. Prueba con otro.</div> : (
              <div className="slots2">{slots.map((t) => <button type="button" key={t} className={`slot2 ${at === t ? 'on' : ''}`} onClick={() => setAt(t)}>{fmtTime(t).replace(' ', '')}</button>)}</div>
            )}
            {at ? (
              <>
                <div className="bstep"><span>5</span> Tus datos</div>
                <Field label="Nombre"><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} autoComplete="name" /></Field>
                <Field label="WhatsApp (10 dígitos)"><PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></Field>
                <p className="hint" style={{ marginTop: -4, marginBottom: 12 }}>Tu nombre y WhatsApp se comparten con el negocio para gestionar tu cita. Consulta el <a href="/privacidad" target="_blank" style={{ textDecoration: 'underline' }}>aviso de privacidad</a>.</p>
                <Field label="Nota (opcional)"><input className="inp" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={300} /></Field>
              </>
            ) : null}
          </>
        ) : null}
      </div>
      {s && at ? (
        <div className="sticky">
          <div className="apsum"><b>{s.name}</b> · {days.find((x) => x.d === day)?.long} · {fmtTime(at)}<br />{approval ? 'El negocio confirmará tu cita.' : 'Tu cita queda confirmada al enviar.'}</div>
          <button className="btn" disabled={busy || f.name.trim().length < 2 || f.phone.length !== 10} onClick={send}>{busy ? 'Enviando…' : approval ? 'Enviar solicitud' : 'Confirmar cita'}</button>
        </div>
      ) : null}
    </>
  )
}
