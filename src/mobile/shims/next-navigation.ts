import { useSyncExternalStore } from 'react'
import { getRoute, getRouteKey, go, subscribeRoute } from '../router'
import { sync } from '../store'

// Reemplazo de next/navigation dentro de la app del teléfono
export function useRouter() {
  return { push: (h: string) => go(h), replace: (h: string) => go(h, true), refresh: () => { void sync() }, back: () => history.back(), prefetch: () => {} }
}
export function usePathname() { useSyncExternalStore(subscribeRoute, getRouteKey); return getRoute().path }
export function useSearchParams() { useSyncExternalStore(subscribeRoute, getRouteKey); return getRoute().query }
export function redirect(h: string): never { go(h, true); throw new Error('redirect') }
export function notFound(): never { throw new Error('No encontrado') }
