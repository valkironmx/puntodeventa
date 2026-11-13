// Dinero: en TS se opera en centavos (enteros). En BD es numeric(12,2).
export function toCents(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const s = typeof v === 'number' ? v.toFixed(2) : String(v).replace(/[^0-9.\-]/g, '')
  if (s === '' || s === '-' || s === '.') return 0
  const neg = s.startsWith('-')
  const [i, d = ''] = s.replace('-', '').split('.')
  const cents = parseInt(i || '0', 10) * 100 + parseInt((d + '00').slice(0, 2), 10)
  // tercer decimal: redondeo
  const third = parseInt((d + '000').slice(2, 3), 10)
  return (neg ? -1 : 1) * (cents + (third >= 5 ? 1 : 0))
}
export function fromCents(c: number): string {
  const neg = c < 0
  const a = Math.abs(Math.round(c))
  return `${neg ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`
}
const f2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const f0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 })
/** $1,250.00 */
export function money(v: string | number | null | undefined): string {
  return f2.format(toCents(v) / 100)
}
/** $55 si es entero, $55.50 si no (catálogo y POS, como la maqueta) */
export function moneyShort(v: string | number | null | undefined): string {
  const c = toCents(v)
  return c % 100 === 0 ? f0.format(c / 100) : f2.format(c / 100)
}
export function centsMoney(c: number, short = false): string {
  return short && c % 100 === 0 ? f0.format(c / 100) : f2.format(c / 100)
}
