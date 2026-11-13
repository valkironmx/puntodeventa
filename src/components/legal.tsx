import Link from 'next/link'
import type { ReactNode } from 'react'
import { APP_NAME } from '@/lib/brand'

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <main className="legal">
      <Link href="/" className="lk">← {APP_NAME}</Link>
      <h1>{title}</h1>
      {updated ? <p className="mut">Última actualización: {updated}</p> : null}
      {children}
      <nav className="legal-nav">
        <Link href="/privacidad">Aviso de privacidad</Link><Link href="/terminos">Términos y condiciones</Link>
        <Link href="/eliminar-cuenta">Eliminar mi cuenta</Link><Link href="/soporte">Soporte</Link>
      </nav>
    </main>
  )
}

export function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={className ?? 'foot'}>
      <Link href="/privacidad">Privacidad</Link> · <Link href="/terminos">Términos</Link> · <Link href="/soporte">Soporte</Link>
    </p>
  )
}
