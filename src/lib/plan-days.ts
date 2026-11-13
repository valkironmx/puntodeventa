/** Días que faltan para el vencimiento (negativo = ya venció). Fecha YYYY-MM-DD. */
export function daysLeft(expires: string | Date | null | undefined): number | null {
  if (!expires) return null
  const iso = expires instanceof Date ? expires.toISOString().slice(0, 10) : String(expires).slice(0, 10)
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(now + 'T00:00:00Z')) / 86400000)
}
export function daysLabel(n: number | null): { text: string; cls: string } {
  if (n === null) return { text: 'Sin vencimiento', cls: 'aceptada' }
  if (n < 0) return { text: `Venció hace ${-n} ${-n === 1 ? 'día' : 'días'}`, cls: 'cancelada' }
  if (n === 0) return { text: 'Vence hoy', cls: 'cancelada' }
  if (n <= 5) return { text: `Quedan ${n} ${n === 1 ? 'día' : 'días'}`, cls: 'espera' }
  return { text: `Quedan ${n} días`, cls: 'aceptada' }
}
