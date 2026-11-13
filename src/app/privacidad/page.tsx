import { LegalPage } from '@/components/legal'
import { APP_NAME, LEGAL_ADDRESS, LEGAL_NAME, LEGAL_UPDATED, SUPPORT_EMAIL } from '@/lib/brand'

export const metadata = { title: 'Aviso de privacidad' }

export default function Privacy() {
  return (
    <LegalPage title="Aviso de privacidad" updated={LEGAL_UPDATED}>
      <h2>1. Responsable</h2>
      <p>{LEGAL_NAME}, con domicilio en {LEGAL_ADDRESS}, es responsable del tratamiento de los datos personales recabados a través de {APP_NAME} (sitio web y aplicaciones móviles), conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
      <h2>2. Datos que recabamos</h2>
      <ul>
        <li><b>Negocios y empleados (usuarios con cuenta):</b> nombre, correo electrónico, teléfono, contraseña cifrada, PIN cifrado, rol y registros de actividad (ventas, pagos, cortes de caja y citas atendidas).</li>
        <li><b>Información del negocio:</b> nombre comercial, dirección, horario, redes sociales, fotografías de productos, logotipo y portada.</li>
        <li><b>Clientes del negocio:</b> nombre y teléfono que el cliente escribe al agendar una cita o que el negocio captura en una venta o cotización.</li>
        <li><b>Datos técnicos:</b> cookie de sesión estrictamente necesaria y conteo de escaneos del código QR (sin identificar a la persona).</li>
        <li><b>Permisos del dispositivo (app móvil), solo si los autorizas:</b> cámara y galería para fotos de productos, ubicación para fijar la dirección del negocio, Bluetooth para la impresora de tickets y notificaciones para avisos de citas.</li>
      </ul>
      <p>No recabamos datos financieros de tarjetas: los pagos se registran como referencia y se cobran fuera de la plataforma. No recabamos datos personales sensibles.</p>
      <h2>3. Para qué los usamos</h2>
      <ul>
        <li>Prestar el servicio: catálogo público, punto de venta, cotizaciones, agenda de citas y tickets.</li>
        <li>Identificar al usuario y proteger su cuenta.</li>
        <li>Dar soporte y enviar avisos operativos del servicio.</li>
      </ul>
      <p>No usamos tus datos para publicidad de terceros ni para rastrearte en otras apps o sitios, y no vendemos datos personales.</p>
      <h2>4. Con quién se comparten</h2>
      <p>Con proveedores que nos ayudan a operar (alojamiento web y base de datos) bajo obligaciones de confidencialidad, y con autoridades cuando la ley lo exige. Los datos que un cliente entrega a un negocio (por ejemplo, al agendar una cita) son tratados por ese negocio como responsable; {APP_NAME} actúa como encargado.</p>
      <p>Cuando envías un pedido o un mensaje por WhatsApp, esa conversación ocurre en WhatsApp y se rige por sus propias políticas.</p>
      <h2>5. Conservación y eliminación</h2>
      <p>Conservamos los datos mientras la cuenta esté activa. Puedes eliminar tu cuenta en cualquier momento desde la app (Menú → Mi cuenta → Eliminar mi cuenta) o siguiendo las instrucciones de la página <a href="/eliminar-cuenta">Eliminar mi cuenta</a>. Al eliminarla se borran tus datos personales; si eres el único dueño de un negocio, se borra también el negocio con su catálogo, ventas y citas.</p>
      <h2>6. Derechos ARCO</h2>
      <p>Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos escribiendo a <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Responderemos en un máximo de 20 días hábiles.</p>
      <h2>7. Seguridad</h2>
      <p>Las contraseñas y PIN se guardan cifrados (bcrypt), la conexión viaja por HTTPS y cada negocio solo puede ver su propia información mediante reglas de acceso a nivel de base de datos.</p>
      <h2>8. Menores de edad</h2>
      <p>El servicio está dirigido a negocios y personas mayores de edad. No recabamos conscientemente datos de menores.</p>
      <h2>9. Cambios</h2>
      <p>Publicaremos cualquier cambio a este aviso en esta misma página.</p>
    </LegalPage>
  )
}
