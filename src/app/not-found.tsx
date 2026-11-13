import Link from 'next/link'
import { Icon } from '@/components/icons'

export default function NotFound() {
  return (
    <div className="screen card">
      <div className="scroll pad" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="state-ic"><Icon name="search" size={32} /></div>
          <div className="hi">No encontramos esta página</div>
          <p className="mut">El enlace puede estar mal escrito o el negocio ya no está disponible.</p>
          <Link href="/" className="btn" style={{ marginTop: 14 }}>Ir al inicio</Link>
        </div>
      </div>
    </div>
  )
}
