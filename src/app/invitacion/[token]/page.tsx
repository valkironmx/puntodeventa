import { sql } from '@/lib/db'
import { InviteForm } from './form'

export const metadata = { title: 'Crea tu contraseña' }

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [u] = await sql`select u.email from app_auth.invites i join auth.users u on u.id = i.user_id where i.token = ${token}`
  return (
    <div className="screen card">
      <div className="scroll pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {u ? (
          <>
            <div className="hi">¡Bienvenido!</div>
            <p className="mut" style={{ margin: '6px 0 24px' }}>Crea tu contraseña para <b>{u.email}</b> y entra a tu panel.</p>
            <InviteForm token={token} />
          </>
        ) : (
          <>
            <div className="hi">Invitación no válida</div>
            <p className="mut">Este enlace ya se usó o expiró. Pide uno nuevo.</p>
            <a className="btn ghost" href="/login" style={{ marginTop: 16 }}>Ir a iniciar sesión</a>
          </>
        )}
      </div>
    </div>
  )
}
