'use client'
import { DateField } from '@/components/inputs'
import { useState } from 'react'
import { addBlockAction, deleteBlockAction, saveBookingSettingsAction, saveStaffScheduleAction } from '@/app/actions/booking'
import { Icon } from '@/components/icons'
import { Field, Seg, Sheet, Sw, SwRow, useAction } from '@/components/ui'

interface S { online_enabled: boolean; requires_approval: boolean; approvers: string; approval_timeout_min: number; slot_interval_min: number; min_notice_min: number; max_days_ahead: number; cancel_until_min: number; buffer_min: number; reminder_24h: boolean; reminder_2h: boolean; reminder_template: string }
interface Day { weekday: number; enabled: boolean; start: string; end: string; breakStart: string | null; breakEnd: string | null }
const WD = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const fullWeek = (days: Day[]): Day[] => [1, 2, 3, 4, 5, 6, 0].map((w) => days.find((d) => d.weekday === w) ?? { weekday: w, enabled: false, start: '09:00', end: '19:00', breakStart: null, breakEnd: null })

export function BookingSettings({ s, members, blocks, canDelete }: { s: S; members: { id: string; name: string; days: Day[] }[]; blocks: { id: string; label: string }[]; canDelete: boolean }) {
  const [f, setF] = useState(s)
  const [ed, setEd] = useState<{ id: string; name: string; days: Day[] } | null>(null)
  const [blk, setBlk] = useState({ day: '', membershipId: '', reason: '' })
  const { run, busy } = useAction()
  const set = <K extends keyof S>(k: K, v: S[K]) => setF((x) => ({ ...x, [k]: v }))
  const num = (k: 'approval_timeout_min' | 'min_notice_min' | 'cancel_until_min' | 'buffer_min' | 'max_days_ahead', label: string, hint?: string) => (
    <Field label={label} hint={hint}><input className="inp" inputMode="numeric" value={String(f[k])} onChange={(e) => set(k, Number(e.target.value.replace(/\D/g, '').slice(0, 5)) || 0)} /></Field>
  )
  const upd = (i: number, patch: Partial<Day>) => setEd((e) => e && ({ ...e, days: e.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }))
  return (
    <>
      <div className="scroll pad">
        <div className="cols"><div className="col">
        <div className="box">
          <SwRow title="Citas en línea" hint="Tus clientes reservan desde tu página pública." on={f.online_enabled} onChange={(v) => set('online_enabled', v)} />
          <SwRow title="Requieren aprobación" hint={f.requires_approval ? 'Las solicitudes quedan en espera hasta que las aceptes.' : 'Se aceptan solas al reservar.'} on={f.requires_approval} onChange={(v) => set('requires_approval', v)} />
        </div>
        <Field label="¿Quién aprueba?"><Seg value={f.approvers} options={[['owner_admin_assignee', 'Dueño, admin y quien atiende'], ['owner_admin', 'Solo dueño y admin']]} onChange={(v) => set('approvers', v)} /></Field>
        <Field label="Intervalo entre horarios"><Seg value={String(f.slot_interval_min)} options={[['15', '15 min'], ['30', '30 min'], ['60', '60 min']]} onChange={(v) => set('slot_interval_min', Number(v))} /></Field>
        <div className="g2">
          {num('approval_timeout_min', 'Tiempo para responder (min)', 'Después se libera el horario.')}
          {num('min_notice_min', 'Anticipación mínima (min)')}
          {num('max_days_ahead', 'Días hacia adelante')}
          {num('cancel_until_min', 'Límite para cancelar (min)')}
          {num('buffer_min', 'Tiempo entre citas (min)')}
        </div>
        <div className="sec">Recordatorios por WhatsApp (semiautomáticos)</div>
        <div className="box">
          <SwRow title="Recordar 24 h antes" on={f.reminder_24h} onChange={(v) => set('reminder_24h', v)} />
          <SwRow title="Recordar 2 h antes" on={f.reminder_2h} onChange={(v) => set('reminder_2h', v)} />
        </div>
        <Field label="Plantilla del mensaje" hint="Variables: {cliente} {día} {hora} {servicio} {negocio} {link}"><textarea className="inp" style={{ height: 96 }} value={f.reminder_template} onChange={(e) => set('reminder_template', e.target.value)} maxLength={500} /></Field>
        <button className="btn" disabled={busy} onClick={() => run(saveBookingSettingsAction({ ...f, approvers: f.approvers as 'owner_admin', slot_interval_min: f.slot_interval_min as 30 }), 'Agenda guardada')}><Icon name="check" /> Guardar reglas</button>

        </div><div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Horario por persona</div>
        {members.map((m) => {
          const on = m.days.filter((d) => d.enabled)
          return (
            <button key={m.id} className="lrow" style={{ padding: 12, width: '100%', textAlign: 'left', cursor: 'pointer' }} onClick={() => setEd({ ...m, days: fullWeek(m.days) })}>
              <div className="li"><b>{m.name}</b><div className="meta">{on.length ? `${on.length} días · ${on[0].start}–${on[0].end}` : 'No atiende citas'}</div></div><Icon name="chevR" size={18} />
            </button>
          )
        })}
        <div className="sec">Días bloqueados</div>
        <div className="box">
          {blocks.length === 0 ? <div className="mut">Sin bloqueos próximos.</div> : null}
          {blocks.map((k) => (
            <div className="dev" key={k.id}><span>{k.label}</span>
              {canDelete ? <button className="ibtn sm" style={{ color: '#C53030' }} disabled={busy} onClick={() => run(deleteBlockAction(k.id), 'Bloqueo eliminado')} aria-label="Eliminar bloqueo"><Icon name="trash" size={14} /></button> : null}
            </div>
          ))}
          <div className="g2" style={{ marginTop: 10 }}>
            <DateField value={blk.day} min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} placeholder="Día a bloquear" onChange={(v) => setBlk({ ...blk, day: v })} />
            <select className="inp" value={blk.membershipId} onChange={(e) => setBlk({ ...blk, membershipId: e.target.value })} aria-label="Persona">
              <option value="">Todo el negocio</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <input className="inp" style={{ marginTop: 8 }} placeholder="Motivo (ej. Día festivo)" value={blk.reason} onChange={(e) => setBlk({ ...blk, reason: e.target.value })} maxLength={80} />
          <button className="btn ghost sm" style={{ marginTop: 8 }} disabled={busy || !blk.day} onClick={async () => { if (await run(addBlockAction({ day: blk.day, membershipId: blk.membershipId || null, reason: blk.reason }), 'Día bloqueado')) setBlk({ day: '', membershipId: '', reason: '' }) }}><Icon name="plus" size={15} /> Bloquear día</button>
        </div>
        </div></div>
      </div>
      {ed ? (
        <Sheet title={`Horario de ${ed.name}`} onClose={() => setEd(null)} top={60}>
          {ed.days.map((d, i) => (
            <div key={d.weekday} style={{ borderBottom: '1px solid #EEF2F0', padding: '8px 0' }}>
              <div className="swrow"><b style={{ fontSize: 13.5 }}>{WD[d.weekday]}</b><Sw on={d.enabled} label={WD[d.weekday]} onChange={(v) => upd(i, { enabled: v })} /></div>
              {d.enabled ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  <label className="hint" style={{ margin: 0 }}>Entrada<input type="time" className="inp" style={{ height: 38 }} value={d.start} onChange={(e) => upd(i, { start: e.target.value })} /></label>
                  <label className="hint" style={{ margin: 0 }}>Salida<input type="time" className="inp" style={{ height: 38 }} value={d.end} onChange={(e) => upd(i, { end: e.target.value })} /></label>
                  <label className="hint" style={{ margin: 0 }}>Descanso de<input type="time" className="inp" style={{ height: 38 }} value={d.breakStart ?? ''} onChange={(e) => upd(i, { breakStart: e.target.value || null })} /></label>
                  <label className="hint" style={{ margin: 0 }}>Descanso a<input type="time" className="inp" style={{ height: 38 }} value={d.breakEnd ?? ''} onChange={(e) => upd(i, { breakEnd: e.target.value || null })} /></label>
                </div>
              ) : null}
            </div>
          ))}
          <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={async () => { if (await run(saveStaffScheduleAction(ed.id, ed.days), 'Horario guardado')) setEd(null) }}>Guardar horario</button>
        </Sheet>
      ) : null}
    </>
  )
}
