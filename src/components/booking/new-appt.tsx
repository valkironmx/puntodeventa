'use client'
import { PhoneInput } from '@/components/inputs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createAppointmentAction } from '@/app/actions/booking'
import { Icon } from '@/components/icons'
import { Field, Ph, useAction } from '@/components/ui'
import { moneyShort } from '@/lib/money'
import { SlotPicker } from './slot-picker'

export function NewAppt({ services, staff, day }: { services: { id: string; name: string; emoji: string | null; dur: number; price: string }[]; staff: { id: string; name: string }[]; day?: string }) {
  const router = useRouter()
  const { run, busy } = useAction()
  const [svc, setSvc] = useState(services[0]?.id ?? '')
  const [slot, setSlot] = useState<{ at: string; membershipId: string } | null>(null)
  const [f, setF] = useState({ name: '', phone: '', notes: '' })
  if (!services.length || !staff.length) {
    return <div className="scroll pad narrow"><div className="vbox">{!services.length ? 'Primero agrega al menos un servicio a tu catálogo.' : 'Primero configura el horario de quienes atienden.'}</div>
      <Link className="btn" href={!services.length ? '/app/catalogo/nuevo' : '/app/citas/ajustes'}>Configurar</Link></div>
  }
  return (
    <>
      <div className="scroll pad">
        <div className="g2">
          <Field label="Cliente"><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></Field>
          <Field label="WhatsApp"><PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></Field>
        </div>
        <div className="bstep" style={{ marginTop: 4 }}>Servicio</div>
        {services.map((s) => (
          <button type="button" key={s.id} className={`svc ${svc === s.id ? 'on' : ''}`} onClick={() => { setSvc(s.id); setSlot(null) }}>
            <Ph name={s.name} /><span style={{ textAlign: 'left', flex: 1 }}><b>{s.name}</b><small><Icon name="clock" size={11} /> {s.dur} min</small></span><b>{moneyShort(s.price)}</b>
          </button>
        ))}
        <SlotPicker key={svc} productId={svc} staff={staff} initialDay={day} value={slot} onChange={setSlot} />
        <div style={{ height: 14 }} />
        <Field label="Notas (opcional)"><input className="inp" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={300} /></Field>
      </div>
      <div className="sticky narrow"><button className="btn" disabled={busy || !slot} onClick={async () => {
        if (!slot) return
        const id = await run(createAppointmentAction({ productId: svc, membershipId: slot.membershipId, startsAt: slot.at, ...f }), 'Cita confirmada')
        if (id && id !== true) router.push(`/app/citas/${id}`)
      }}><Icon name="check" /> Crear cita confirmada</button></div>
    </>
  )
}
