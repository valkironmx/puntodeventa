export const TZ = 'America/Mexico_City'
type D = Date | string

const d = (v: D) => (v instanceof Date ? v : new Date(v))
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, ...o })

export const fmtDate = (v: D) => fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(d(v))
export const fmtDateLong = (v: D) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d(v))
export const fmtDateShort = (v: D) => fmt({ day: '2-digit', month: '2-digit', year: '2-digit' }).format(d(v))
export function fmtTime(v: D): string {
  return fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(d(v)).replace(/\s?a\.?\s?m\.?/i, ' am').replace(/\s?p\.?\s?m\.?/i, ' pm')
}
export const fmtDateTime = (v: D) => `${fmtDateShort(v)} · ${fmtTime(v)}`
/** Fecha tipo date (YYYY-MM-DD) sin corrimiento de zona */
export function fmtPlainDate(v: D): string {
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)
  const [y, m, day] = s.split('-').map(Number)
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, day)))
}
/** YYYY-MM-DD en la zona del negocio */
export function ymd(v: D = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d(v))
}
export function addDays(ymdStr: string, n: number): string {
  const [y, m, day] = ymdStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10)
}
export function dayParts(ymdStr: string) {
  const [y, m, day] = ymdStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day, 12))
  const wd = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' }).format(dt).replace('.', '')
  return { wd: wd.charAt(0).toUpperCase() + wd.slice(1, 3), num: day, long: new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dt) }
}
export function ago(v: D): string {
  const min = Math.max(0, Math.round((Date.now() - d(v).getTime()) / 60000))
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}
// Folio 0 = registrado en la app sin conexión; el número real llega al sincronizar
export const folio = (prefix: 'V' | 'COT', n: number) => (n > 0 ? `${prefix}-${String(n).padStart(4, '0')}` : `${prefix} por asignar`)
export function qtyLabel(qty: string | number, unit: string): string {
  const n = Number(qty)
  const s = Number.isInteger(n) ? String(n) : String(+n.toFixed(3))
  return unit === 'pieza' ? s : `${s} ${unit === 'l' ? 'L' : unit}`
}
export const unitSuffix = (unit: string) => (unit === 'pieza' ? '' : ` /${unit === 'l' ? 'L' : unit}`)
export function initials(name: string): string {
  const w = name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter((x) => x.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(x))
  const pick = w.length >= 3 ? [w[w.length - 2], w[w.length - 1]] : w.slice(0, 2)
  return pick.map((x) => x[0]).join('').toUpperCase().slice(0, 2) || name.slice(0, 2).toUpperCase()
}
/** wa.me con lada 52 */
export function waLink(phone: string | null | undefined, text?: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  const full = digits.length === 10 ? `52${digits}` : digits
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
export const appDomain = () => process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'tuapp.com'
export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? `https://${appDomain()}`
// La app del teléfono registra su propio resolvedor (imágenes guardadas para usarse sin conexión)
export const storageUrl = (path: string | null | undefined): string | null => {
  if (!path) return null
  const r = (globalThis as { __storageUrl?: (p: string) => string }).__storageUrl
  return r ? r(path) : `/storage/${path}`
}
