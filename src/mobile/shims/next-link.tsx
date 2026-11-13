import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { go } from '../router'
import { getState } from '../store'

// Reemplazo de next/link: las rutas /app/... navegan dentro de la app; el resto (página pública, invitaciones)
// se abre en el navegador del teléfono con la dirección del servidor.
export default function Link({ href, children, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean; replace?: boolean; scroll?: boolean }) {
  const { prefetch: _p, replace: _r, scroll: _s, target: _t, ...a } = rest as Record<string, unknown>
  const internal = href.startsWith('/app')
  const external = !internal && href.startsWith('/') ? `${getState().server}${href}` : href
  return (
    <a {...(a as AnchorHTMLAttributes<HTMLAnchorElement>)} href={internal ? href : external} onClick={(e) => {
      onClick?.(e)
      if (e.defaultPrevented) return
      e.preventDefault()
      if (internal) go(href)
      else window.location.href = external
    }}>{children}</a>
  )
}
