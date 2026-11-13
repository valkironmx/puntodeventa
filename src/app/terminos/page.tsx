import { LegalPage } from '@/components/legal'
import { APP_NAME, LEGAL_NAME, LEGAL_UPDATED, SUPPORT_EMAIL } from '@/lib/brand'

export const metadata = { title: 'Términos y condiciones' }

export default function Terms() {
  return (
    <LegalPage title="Términos y condiciones" updated={LEGAL_UPDATED}>
      <h2>1. El servicio</h2>
      <p>{APP_NAME}, operado por {LEGAL_NAME}, es una herramienta para que los negocios publiquen su catálogo o menú, registren ventas, cotizaciones y citas. {APP_NAME} no vende los productos o servicios que aparecen en los catálogos: cada negocio es el único responsable de sus precios, existencias, entregas, promociones y de la atención a sus clientes.</p>
      <h2>2. Cuentas</h2>
      <p>Las cuentas de negocio se crean por invitación. Eres responsable de mantener la confidencialidad de tu contraseña y PIN, y de la actividad de los empleados a quienes des acceso.</p>
      <h2>3. Uso permitido</h2>
      <p>No está permitido publicar contenido ilegal, engañoso, ofensivo o que infrinja derechos de terceros, ni ofrecer productos o servicios prohibidos por la ley. Podemos suspender cuentas que incumplan estas reglas.</p>
      <h2>4. Contenido del negocio</h2>
      <p>El negocio conserva los derechos sobre sus fotografías, textos y marcas, y nos autoriza a mostrarlos para prestar el servicio.</p>
      <h2>5. Pedidos, pagos y citas</h2>
      <p>Los pedidos se envían al negocio por WhatsApp y se acuerdan directamente con él. Los pagos registrados en el punto de venta son un registro administrativo: {APP_NAME} no procesa cobros con tarjeta ni resguarda dinero. Las citas quedan sujetas a la confirmación y políticas de cancelación de cada negocio.</p>
      <h2>6. Disponibilidad</h2>
      <p>Trabajamos para mantener el servicio disponible, pero puede haber interrupciones por mantenimiento o causas ajenas. El servicio se ofrece "tal cual", en la medida que la ley lo permita.</p>
      <h2>7. Cancelación</h2>
      <p>Puedes dejar de usar el servicio y eliminar tu cuenta en cualquier momento desde la app.</p>
      <h2>8. Contacto</h2>
      <p>Dudas o reportes de contenido: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
      <h2>9. Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de los Estados Unidos Mexicanos.</p>
    </LegalPage>
  )
}
