'use client'
import { Icon } from '@/components/icons'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="screen card">
      <div className="scroll pad" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="state-ic"><Icon name="refresh" size={32} /></div>
          <div className="hi">Algo salió mal</div>
          <p className="mut">No pudimos cargar esta pantalla. Revisa tu conexión e inténtalo de nuevo.</p>
          <button className="btn" style={{ marginTop: 14 }} onClick={reset}>Reintentar</button>
        </div>
      </div>
    </div>
  )
}
