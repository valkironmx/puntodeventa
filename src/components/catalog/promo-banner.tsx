import type { ReactNode } from 'react'
import { Icon } from '@/components/icons'

/** Banner de promoción: imagen + título + descripción + botón. Mismo componente en la página pública y en el panel. */
export function PromoBanner({ title, description, image, button, onClick, onOpen, viewLabel, dim, children, tag, strip }: {
  viewLabel?: string | null; onOpen?: (() => void) | null; tag?: string | null; strip?: boolean; title: string; description?: string | null; image?: string | null; button?: string | null; onClick?: (() => void) | null; dim?: boolean; children?: ReactNode
}) {
  return (
    <article className={`promo ${image ? 'has-img' : ''} ${dim ? 'off' : ''} ${strip ? 'strip' : ''} ${onOpen ? 'clickable' : ''}`}
      onClick={onOpen ?? undefined} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} aria-label={onOpen ? `Ver promoción: ${title}` : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } } : undefined}>
      {image ? <img src={image} alt="" /> : null}
      <div className="promo-t">
        {tag ? <em>{tag}</em> : null}
        <b>{title}</b>
        {description ? <p>{description}</p> : null}
        {button || (viewLabel && onOpen) ? (
          <div className="promo-acts">
            {button ? (
              <button type="button" className="promo-btn" onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined} disabled={!onClick}>
                {button} <span><Icon name="plus" size={12} stroke={3} /></span>
              </button>
            ) : null}
            {viewLabel && onOpen ? <button type="button" className="promo-view" onClick={(e) => { e.stopPropagation(); onOpen() }}>{viewLabel}</button> : null}
          </div>
        ) : null}
      </div>
      {children}
    </article>
  )
}
