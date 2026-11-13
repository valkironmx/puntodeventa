import { LegalPage } from '@/components/legal'
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand'

export const metadata = { title: 'Soporte' }

export default function Support() {
  return (
    <LegalPage title="Soporte">
      <p>¿Necesitas ayuda con {APP_NAME}? Escríbenos y te respondemos lo antes posible.</p>
      <p><a className="btn" style={{ width: 'auto', display: 'inline-flex', padding: '0 24px' }} href={`mailto:${SUPPORT_EMAIL}`}>Escribir a {SUPPORT_EMAIL}</a></p>
      <h2>Preguntas frecuentes</h2>
      <h3>¿Cómo entro a mi negocio?</h3>
      <p>Con el correo y contraseña que creaste desde tu invitación, en la pantalla de inicio de sesión.</p>
      <h3>Olvidé mi contraseña</h3>
      <p>Pide al dueño de tu negocio que te reenvíe el acceso, o escríbenos desde el correo registrado.</p>
      <h3>¿Cómo elimino mi cuenta?</h3>
      <p>Desde la app: Menú → Mi cuenta → Eliminar mi cuenta. Más detalles en <a href="/eliminar-cuenta">Eliminar mi cuenta</a>.</p>
      <h3>Quiero reportar un negocio o contenido</h3>
      <p>Envíanos el enlace de la página y el motivo a {SUPPORT_EMAIL}.</p>
    </LegalPage>
  )
}
