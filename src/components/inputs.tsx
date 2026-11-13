'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icons'

/** Teléfono de México: solo dígitos, máximo 10. */
export function PhoneInput({ value, onChange, placeholder = '10 dígitos', style, className = 'inp' }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties; className?: string }) {
  const n = value.length
  return (
    <div className="ph10" style={style}>
      <input className={className} inputMode="numeric" autoComplete="tel-national" placeholder={placeholder} value={value}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '')
          if (d.length <= 10) onChange(d)
          else if (d.length - value.length > 1) onChange(/^(52|521)\d{10}$/.test(d) ? d.slice(-10) : d.slice(0, 10)) // pegado (quita lada +52)
        }} />
      {n > 0 && n < 10 ? <span className="ph10-n">{n}/10</span> : null}
    </div>
  )
}

export const cleanPhone = (v: string | null | undefined) => { const d = (v ?? '').replace(/\D/g, ''); return /^(52|521)\d{10}$/.test(d) ? d.slice(-10) : d.slice(0, 10) }

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const HEAD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null }

/** "Viernes 15 de noviembre de 2026" */
export function longDate(s: string): string {
  const d = parse(s)
  return d ? `${cap(DAYS[d.getDay()])} ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}` : ''
}
export function longTime(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm)
  if (!m) return ''
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

const QUICK_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00']

/**
 * Selector de fecha propio. `value` usa "YYYY-MM-DD" (date) o "YYYY-MM-DDTHH:MM" (withTime),
 * igual que los inputs nativos, para no cambiar lo que se guarda.
 */
export function DateField({ value, onChange, min, withTime, placeholder = 'Elegir fecha', clearable }: { value: string; onChange: (v: string) => void; min?: string; withTime?: boolean; placeholder?: string; clearable?: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const datePart = value.slice(0, 10)
  const timePart = withTime ? value.slice(11, 16) : ''
  const sel = parse(datePart)
  return (
    <>
      <button type="button" className={`dfield ${value ? 'has' : ''}`} onClick={(e) => setOpen(getComputedStyle(e.currentTarget).getPropertyValue('--g').trim() || '#1F8A6B')}>
        <span className="dfield-ic"><Icon name="calendar" size={18} /></span>
        {sel ? (
          <span className="dfield-txt">
            <b>{cap(DAYS[sel.getDay()])}</b>
            <span>{sel.getDate()} de {MONTHS[sel.getMonth()]} de {sel.getFullYear()}{timePart ? ` · ${longTime(timePart)}` : ''}</span>
          </span>
        ) : <span className="dfield-ph">{placeholder}</span>}
        <Icon name="chevR" size={16} />
      </button>
      {open ? <DatePicker accent={open} value={value} min={min} withTime={withTime} clearable={clearable} onClose={() => setOpen(null)} onPick={(v) => { onChange(v); setOpen(null) }} /> : null}
    </>
  )
}

function DatePicker({ accent, value, min, withTime, clearable, onClose, onPick }: { accent: string; value: string; min?: string; withTime?: boolean; clearable?: boolean; onClose: () => void; onPick: (v: string) => void }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const minD = min ? parse(min) : null
  const [day, setDay] = useState<string>(value.slice(0, 10))
  const [time, setTime] = useState<string>(withTime ? value.slice(11, 16) || '12:00' : '')
  const start = parse(day) ?? (minD && minD > today ? minD : today)
  const [view, setView] = useState(new Date(start.getFullYear(), start.getMonth(), 1))
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const first = (view.getDay() + 6) % 7 // lunes = 0
  const total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))]
  while (cells.length % 7) cells.push(null)
  const disabled = (d: Date) => !!minD && d < minD
  const prevOff = !!minD && new Date(view.getFullYear(), view.getMonth(), 0) < minD
  const move = (n: number) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1))
  const jump = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); if (!disabled(d)) { setDay(ymd(d)); setView(new Date(d.getFullYear(), d.getMonth(), 1)) } }
  const [hh, mm] = (time || '12:00').split(':')
  const setHM = (h: string, m: string) => setTime(`${h}:${m}`)
  const ok = !!day && (!withTime || /^\d{2}:\d{2}$/.test(time))
  const nowTooEarly = withTime && min && day && `${day}T${time}` < min.slice(0, 16)

  const body = (
    <div className="dp-back" style={{ ['--g' as string]: accent, ['--g2' as string]: `color-mix(in srgb, ${accent} 12%, #fff)` }} onClick={onClose}>
      <div className="dp" role="dialog" aria-label="Elegir fecha" onClick={(e) => e.stopPropagation()}>
        <div className="dp-sum">
          <small>{withTime ? 'Fecha y hora' : 'Fecha'}</small>
          {day ? (
            <>
              <b>{cap(DAYS[parse(day)!.getDay()])}</b>
              <span>{parse(day)!.getDate()} de {MONTHS[parse(day)!.getMonth()]} de {parse(day)!.getFullYear()}{withTime ? ` · ${longTime(time)}` : ''}</span>
            </>
          ) : <b className="dp-none">Toca un día</b>}
        </div>
        <div className="dp-quick">
          <button type="button" className="chip" onClick={() => jump(0)} disabled={disabled(today)}>Hoy</button>
          <button type="button" className="chip" onClick={() => jump(1)}>Mañana</button>
          <button type="button" className="chip" onClick={() => jump(7)}>En una semana</button>
        </div>
        <div className="dp-head">
          <button type="button" className="dp-nav" aria-label="Mes anterior" disabled={prevOff} onClick={() => move(-1)}><Icon name="back" size={18} /></button>
          <b>{cap(MONTHS[view.getMonth()])} <span>{view.getFullYear()}</span></b>
          <button type="button" className="dp-nav" aria-label="Mes siguiente" onClick={() => move(1)}><Icon name="chevR" size={18} /></button>
        </div>
        <div className="dp-grid">
          {HEAD.map((h, i) => <span key={h} className={`dp-wd ${i >= 5 ? 'we' : ''}`}>{h}</span>)}
          {cells.map((d, i) => d ? (
            <button type="button" key={i} disabled={disabled(d)}
              className={`dp-d ${ymd(d) === day ? 'sel' : ''} ${ymd(d) === ymd(today) ? 'today' : ''} ${i % 7 >= 5 ? 'we' : ''}`}
              aria-label={longDate(ymd(d))} onClick={() => setDay(ymd(d))}>{d.getDate()}</button>
          ) : <span key={i} />)}
        </div>
        {withTime ? (
          <div className="dp-time">
            <div className="dp-tl"><Icon name="clock" size={16} /> Hora</div>
            <div className="dp-tsel">
              <select className="inp" value={hh} onChange={(e) => setHM(e.target.value, mm)} aria-label="Hora">
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={pad(h)}>{longTime(`${pad(h)}:00`).replace(':00', '')}</option>)}
              </select>
              <span>:</span>
              <select className="inp" value={mm} onChange={(e) => setHM(hh, e.target.value)} aria-label="Minutos">
                {['00', '15', '30', '45'].concat(['00', '15', '30', '45'].includes(mm) ? [] : [mm]).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="dp-quick">
              {QUICK_TIMES.map((t) => <button type="button" key={t} className={`chip ${time === t ? 'on' : ''}`} onClick={() => setTime(t)}>{longTime(t)}</button>)}
            </div>
          </div>
        ) : null}
        {nowTooEarly ? <div className="hint" style={{ color: 'var(--red)' }}>Esa hora ya pasó. Elige una más tarde.</div> : null}
        <div className="dp-foot">
          {clearable && value ? <button type="button" className="btn ghost sm" onClick={() => onPick('')}>Quitar fecha</button> : <button type="button" className="btn ghost sm" onClick={onClose}>Cancelar</button>}
          <button type="button" className="btn sm" disabled={!ok || !!nowTooEarly} onClick={() => onPick(withTime ? `${day}T${time}` : day)}>Listo</button>
        </div>
      </div>
    </div>
  )
  return mounted ? createPortal(body, document.body) : null
}

export function FieldsEditor({ fields, setFields, suggestions }: { fields: { label: string; value: string }[]; setFields: (f: (a: { label: string; value: string }[]) => { label: string; value: string }[]) => void; suggestions: string[] }) {
  return (
    <>
      {fields.map((f, i) => (
        <div className="cf" key={i}>
          <input className="inp" list="pos-fields" value={f.label} placeholder="Dato" maxLength={40} onChange={(e) => setFields((a) => a.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
          <input className="inp" value={f.value} placeholder="Valor" maxLength={200} onChange={(e) => setFields((a) => a.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
          <button type="button" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--mut)' }} onClick={() => setFields((a) => a.filter((_, j) => j !== i))} aria-label="Quitar dato"><Icon name="x" size={16} /></button>
        </div>
      ))}
      <datalist id="pos-fields">{suggestions.map((x) => <option key={x} value={x} />)}</datalist>
      <button type="button" className="addl" style={{ border: 0, background: 'none' }} onClick={() => setFields((a) => [...a, { label: '', value: '' }])}><Icon name="plus" size={16} /> Agregar dato adicional</button>
    </>
  )
}
