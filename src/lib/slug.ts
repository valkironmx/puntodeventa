export const RESERVED_SLUGS = ['app', 'super', 'q', 'login', 'api', 'admin', 'www', 'static', '_next', 'assets', 'ayuda', 'soporte', 'terminos', 'privacidad', 'precios', 'planes', 'storage', 'invitacion', 'favicon.ico', 'suspendido', 'eliminar-cuenta']

/** "Café La Luna" → "cafelaluna". Sin espacios ni guiones (PLAN §6.3). */
export function slugify(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
export function isReserved(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug)
}
/** Si está ocupado sugiere {slug}2, {slug}3… */
export function suggestSlug(slug: string, taken: (s: string) => boolean): string {
  if (!taken(slug) && !isReserved(slug)) return slug
  for (let i = 2; i < 1000; i++) if (!taken(`${slug}${i}`) && !isReserved(`${slug}${i}`)) return `${slug}${i}`
  return `${slug}${Date.now()}`
}
