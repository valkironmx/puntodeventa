import { logoutAction } from '@/app/actions/auth'
import { Icon } from '@/components/icons'
import { SUPPORT_EMAIL } from '@/lib/brand'

export const metadata = { title: 'Cuenta suspendida' }

export default function Suspended() {
  return (
    <div className="screen card">
      <div className="scroll pad" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="state-ic"><Icon name="lock" size={32} /></div>
          <div className="hi">Tu negocio está suspendido</div>
          <p className="mut">Por ahora no puedes usar el panel y tu página pública no está disponible. Para reactivarlo, escríbenos a <a className="lk" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
          <form action={logoutAction}><button className="btn ghost" style={{ marginTop: 14 }}>Cerrar sesión</button></form>
        </div>
      </div>
    </div>
  )
}
