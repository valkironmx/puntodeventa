import { notFound } from 'next/navigation'
import { PublicBooking } from '@/components/booking/public-booking'
import { PlainBar } from '@/components/panel/plain-bar'
import { asUser } from '@/lib/db'
import { addDays, dayParts, ymd } from '@/lib/format'
import { isReserved } from '@/lib/slug'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Agendar cita' }

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ s?: string }> }) {
  const { slug } = await params
  const { s } = await searchParams
  if (isReserved(slug) || !/^[a-z0-9]{2,40}$/.test(slug)) notFound()
  const [info, cat] = await asUser(null, async (tx) => [(await tx`select public.public_booking_info(${slug}) as i`)[0].i, (await tx`select public.public_catalog(${slug}) as c`)[0].c])
  if (!info || !cat || cat.suspended) notFound()
  const b = cat.business
  const today = ymd()
  const n = Math.min(14, (info.settings?.max_days_ahead ?? 30) + 1)
  const days = Array.from({ length: n }, (_, i) => addDays(today, i)).map((d) => ({ d, ...dayParts(d), today: d === today }))
  return (
    <div className="screen card" style={{ ['--g' as string]: b.accent_color }}>
      <PlainBar back={`/${slug}`} title="Agendar cita" sub={b.name} />
      {!cat.business.booking_enabled || !info.settings?.online_enabled ? (
        <div className="scroll pad"><div className="vbox">Por ahora este negocio no recibe citas en línea. Escríbele por WhatsApp.</div></div>
      ) : (
        <PublicBooking slug={slug} businessId={info.business_id} services={info.services} staff={info.staff} days={days} approval={info.settings.requires_approval}
          initialService={s && info.services.some((x: { id: string }) => x.id === s) ? s : null} />
      )}
    </div>
  )
}
