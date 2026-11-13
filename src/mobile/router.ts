// Navegación de la app del teléfono (usa el hash para que funcione el botón "atrás" de Android)
type Route = { path: string; query: URLSearchParams }
const subs = new Set<() => void>()
const parse = (): Route => {
  const h = location.hash.replace(/^#/, '') || '/app/pos'
  const [path, q = ''] = h.split('?')
  return { path, query: new URLSearchParams(q) }
}
let current = parse()
let key = location.hash
window.addEventListener('hashchange', () => { current = parse(); key = location.hash; subs.forEach((f) => f()) })
export const subscribeRoute = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const getRoute = () => current
export const getRouteKey = () => key
export function go(href: string, replace = false) {
  const h = `#${href.startsWith('/') ? href : `/${href}`}`
  if (replace) { history.replaceState(null, '', h); current = parse(); key = h; subs.forEach((f) => f()) } else location.hash = h
  window.scrollTo(0, 0)
}
