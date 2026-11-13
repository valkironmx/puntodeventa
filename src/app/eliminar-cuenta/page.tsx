import Link from 'next/link'
import { LegalPage } from '@/components/legal'
import { APP_NAME, SUPPORT_EMAIL } from '@/lib/brand'

export const metadata = { title: 'Eliminar mi cuenta' }

// URL pública que piden Google Play (Data safety → Account deletion) y App Store.
export default function DeleteAccountInfo() {
  return (
    <LegalPage title={`Eliminar mi cuenta de ${APP_NAME}`}>
      <h2>Desde la app o el sitio</h2>
      <ol>
        <li>Inicia sesión.</li>
        <li>Abre el menú y entra a <b>Mi cuenta</b>.</li>
        <li>Toca <b>Eliminar mi cuenta</b>, escribe ELIMINAR y confirma.</li>
      </ol>
      <p><Link className="btn" style={{ width: 'auto', display: 'inline-flex', padding: '0 24px' }} href="/app/cuenta">Ir a Mi cuenta</Link></p>
      <h2>Si no puedes entrar</h2>
      <p>Escribe a <a href={`mailto:${SUPPORT_EMAIL}?subject=Eliminar%20mi%20cuenta`}>{SUPPORT_EMAIL}</a> desde el correo registrado y la eliminamos en un máximo de 30 días.</p>
      <h2>Qué se elimina</h2>
      <ul>
        <li>Tu usuario: nombre, correo, teléfono, contraseña, PIN y sesiones.</li>
        <li>Si eres el <b>único dueño</b> de un negocio: el negocio completo, con su catálogo, fotos, promociones, cotizaciones, ventas, cortes de caja, citas, empleados y código QR. Su página pública deja de existir.</li>
      </ul>
      <h2>Qué se conserva</h2>
      <ul>
        <li>Si eres empleado o administrador, las ventas que registraste permanecen en el negocio sin tu nombre, porque son registros contables del negocio.</li>
        <li>Lo que la ley nos obligue a conservar, por el tiempo que indique.</li>
      </ul>
      <p>La eliminación es inmediata y no se puede deshacer.</p>
    </LegalPage>
  )
}
