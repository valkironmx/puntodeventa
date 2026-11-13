'use client'
import { useEffect, useState } from 'react'
import { panelSlotsAction } from '@/app/actions/booking'
import { addDays, dayParts, fmtTime, ymd } from '@/lib/format'

/** Panel: persona + día + horarios (los ocupados aparecen tachados) */
export function SlotPicker({ productId, staff, initialDay, initialStaff, ignoreId, value, onChange }: {
  productId: string; staff: { id: string; name: string }[]; initialDay?: string; initialStaff?: string; ignoreId?: string
  value: { at: string; membershipId: string } | null; onChange: (v: { at: string; membershipId: string } | null) => void
}) {
  const today = ymd()
  const [who, setWho] = useState(initialStaff ?? staff[0]?.id ?? '')
  const [day, setDay] = useState(initialDay && initialDay >= today ? initialDay : today)
  const [slots, setSlots] = useState<{ at: string; free: boolean }[] | null>(null)
  useEffect(() => {
    if (!who || !productId) return
    let live = true
    setSlots(null)
    panelSlotsAction(productId, who, day, ignoreId ?? null).then((r) => { if (live) setSlots(r.ok ? (r.data ?? []) : []) })
    return () => { live = false }
  }, [productId, who, day, ignoreId])
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
  return (
    <>
      <div className="bstep" style={{ marginTop: 6 }}>¿Con quién?</div>
      <div className="chips" style={{ padding: 0 }}>
        {staff.map((s) => <button key={s.id} type="button" className={`chip ${who === s.id ? 'on' : ''}`} onClick={() => { setWho(s.id); onChange(null) }}>{s.name}</button>)}
      </div>
      <div className="bstep">Día</div>
      <div className="days">
        {days.map((d) => { const p = dayParts(d); return <button type="button" key={d} className={`day ${d === day ? 'on' : ''}`} style={{ minWidth: 48 }} onClick={() => { setDay(d); onChange(null) }}><small>{d === today ? 'Hoy' : p.wd}</small><b>{p.num}</b></button> })}
      </div>
      <div className="bstep">Hora</div>
      {slots === null ? <div className="mut">Cargando horarios…</div> : slots.length === 0 ? <div className="mut">Esta persona no trabaja ese día.</div> : (
        <div className="slots2">
          {slots.map((s) => <button type="button" key={s.at} disabled={!s.free} className={`slot2 ${!s.free ? 'x' : ''} ${value?.at === s.at && value.membershipId === who ? 'on' : ''}`} onClick={() => onChange({ at: s.at, membershipId: who })}>{fmtTime(s.at).replace(' ', '')}</button>)}
        </div>
      )}
    </>
  )
}
