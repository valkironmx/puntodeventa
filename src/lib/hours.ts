import { TZ, fmtTime } from './format'

export interface ScheduleRow { days: string; dow: number[]; open: string; close: string; enabled: boolean }
export const DEFAULT_SCHEDULE: ScheduleRow[] = [
  { days: 'Lun-Vie', dow: [1, 2, 3, 4, 5], open: '09:00', close: '19:00', enabled: true },
  { days: 'Sábado', dow: [6], open: '09:00', close: '15:00', enabled: true },
  { days: 'Domingo', dow: [0], open: '09:00', close: '15:00', enabled: false },
]
const hm = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const label = (t: string) => { const [h, m] = t.split(':').map(Number); return fmtTime(new Date(Date.UTC(2020, 0, 1, h + 6, m))) }

/** "Abierto · cierra 9:00 pm" o "Cerrado · abre 8:00 am" en la zona del negocio */
export function openStatus(schedule: ScheduleRow[] | null | undefined, now = new Date()): { open: boolean; text: string } | null {
  if (!schedule || schedule.length === 0) return null
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now)
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')!.value)
  const mins = (Number(parts.find((p) => p.type === 'hour')!.value) % 24) * 60 + Number(parts.find((p) => p.type === 'minute')!.value)
  const rowFor = (dow: number) => schedule.find((r) => r.enabled && r.dow?.includes(dow))
  const today = rowFor(wd)
  if (today && mins >= hm(today.open) && mins < hm(today.close)) return { open: true, text: `Abierto · cierra ${label(today.close)}` }
  if (today && mins < hm(today.open)) return { open: false, text: `Cerrado · abre ${label(today.open)}` }
  for (let i = 1; i <= 7; i++) {
    const r = rowFor((wd + i) % 7)
    if (r) return { open: false, text: `Cerrado · abre ${i === 1 ? 'mañana ' : ''}${label(r.open)}` }
  }
  return { open: false, text: 'Cerrado' }
}
