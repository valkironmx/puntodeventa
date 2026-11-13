import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CancelButton } from '@/components/booking/cancel-button'
import { Icon } from '@/components/icons'
import { asUser } from '@/lib/db'
import { dayParts, fmtTime, waLink, ymd } from '@/lib/format'
import { money } from '@/lib/money'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tu cita', robots: { index: false } }

const TXT: Record<string, [string, string]> = {
  pending: ['¡Solicitud enviada!', 'En espera de aprobación'], confirmed: ['¡Cita confirmada!', 'Confirmada'], rejected: ['Solicitud rechazada', 'Rechazada'],
  cancelled: ['Cita cancelada', 'Cancelada'], completed: ['Cita completada', 'Completada'], no_show: ['No asististe', 'No asistió'], expired: ['La solicitud venció', 'Vencida'],
}

export default async function ApptStatus({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  if (!/^[A-Za-z0-9]{10,40}$/.test(token)) notFound()
  const [a, cat] = await asUser(null, async (tx) => [(await tx`select public.public_appointment(${token}) as a`)[0].a, (await tx`select public.public_catalog(${slug}) as c`)[0].c])
  if (!a || !cat || cat.suspended) notFound()
  const b = cat.business
  const pending = a.status === 'pending', good = a.status === 'confirmed' || a.status === 'completed'
  const wa = b.contact?.whatsapp
  return (
    <div className="screen card" style={{ ['--g' as string]: b.accent_color }}>
      <div className="scroll pad" style={{ paddingTop: 40, textAlign: 'center' }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          {pending ? <div className="wait"><Icon name="clock" size={44} /></div>
            : <div className="done" style={{ position: 'static', padding: 0, background: 'none', transform: 'none', width: 'auto' }}><div className="ok" style={good ? undefined : { background: '#C53030', boxShadow: '0 0 0 14px #FDECEC' }}><Icon name={good ? 'check' : 'x'} size={44} stroke={3} /></div></div>}
        </div>
        <div className="hi" style={{ marginTop: 30 }}>{TXT[a.status][0]}</div>
        <p className="mut">{pending ? `Apartamos este horario para ti. ${b.name} confirmará tu cita en breve.` : a.status === 'rejected' && a.reject_reason ? a.reject_reason : b.name}</p>
        <div className="apcard" style={{ textAlign: 'left', marginTop: 18 }}>
          {pending ? <span className="pill"><Icon name="clock" size={13} /> En espera de aprobación</span> : <small>{TXT[a.status][1]}</small>}
          <small style={{ display: 'block' }}>{dayParts(ymd(a.starts_at)).long}</small>
          <div className="apt">{fmtTime(a.starts_at)}</div>
          <div className="aps"><span>Servicio</span><b>{a.service}{a.duration_min ? ` · ${a.duration_min} min` : ''}</b></div>
          <div className="aps"><span>Con</span><b>{a.staff}</b></div>
          <div className="aps"><span>Precio</span><b>{money(a.price)}</b></div>
          <div className="aps"><span>A nombre de</span><b>{a.customer_name}</b></div>
        </div>
        <p className="hint">Guarda este enlace para consultar el estado de tu cita.</p>
        {wa ? <a className="btn wa" target="_blank" rel="noopener noreferrer" href={waLink(wa, `Hola, soy ${a.customer_name}. Tengo una cita de ${a.service} el ${dayParts(ymd(a.starts_at)).long} a las ${fmtTime(a.starts_at)}.`)}><Icon name="wa" /> Escribir al negocio</a> : null}
        {a.can_cancel ? <CancelButton token={token} /> : ['pending', 'confirmed'].includes(a.status) ? <p className="hint">Ya no es posible cancelar en línea (límite: {Math.round(a.cancel_until_min / 60)} h antes).</p> : null}
        <Link href={`/${slug}`} className="btn ghost" style={{ marginTop: 10 }}>Volver a {b.name}</Link>
      </div>
    </div>
  )
}
