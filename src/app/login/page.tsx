import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { LoginForm } from './form'
import { LegalLinks } from '@/components/legal'

export const metadata = { title: 'Entrar' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams
  const s = await getSession()
  if (s && !e) redirect('/app')
  return (
    <div className="screen card">
      <div className="scroll pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 40 }}>
        <div className="logo" style={{ background: 'var(--g)', color: '#fff', marginBottom: 22 }}>ta</div>
        <div className="hi">Entra a tu negocio</div>
        <p className="mut" style={{ margin: '6px 0 24px' }}>Administra tu catálogo, cobra y revisa tus ventas.</p>
        {e === 'cuenta-eliminada' ? <div className="allok" style={{ marginBottom: 12 }}>Tu cuenta fue eliminada.</div> : null}
        {e === 'sin-negocio' ? <div className="err">Tu usuario no tiene un negocio activo. Contacta al administrador.</div> : null}
        <LoginForm />
        <LegalLinks />
        <p className="foot" style={{ marginTop: 10 }}>¿Dispositivo de caja compartida? Inicia sesión como dueño y activa el <b>modo caja</b> en Empleados.</p>
      </div>
    </div>
  )
}
