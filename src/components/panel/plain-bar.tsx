import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/icons'

/** Barra superior sin menú lateral (super admin y páginas públicas) */
export function PlainBar({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="appbar">
      {back ? <Link href={back} className="ibtn" aria-label="Regresar"><Icon name="back" /></Link> : null}
      <div className="ttl" style={{ minWidth: 0 }}>{title}{sub ? <small>{sub}</small> : null}</div>
      {right ? <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>{right}</div> : null}
    </header>
  )
}
