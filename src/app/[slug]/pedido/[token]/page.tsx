import { notFound } from 'next/navigation'
import { OrderStatus } from '@/components/catalog/order-status'
import { asUser } from '@/lib/db'
import { storageUrl } from '@/lib/format'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi solicitud', robots: { index: false } }

export default async function OrderPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params
  if (!/^[A-Za-z0-9]{10,40}$/.test(token) || !/^[a-z0-9]{2,40}$/.test(slug)) notFound()
  const [o, cat] = await asUser(null, async (tx) => [(await tx`select public.public_order(${token}) as o`)[0].o, (await tx`select public.public_catalog(${slug}) as c`)[0].c])
  if (!o || !cat || cat.suspended) notFound()
  const b = cat.business
  return (
    <div className="screen card" style={{ ['--g' as string]: b.accent_color }}>
      <OrderStatus token={token} initial={o} business={{ slug: b.slug, name: b.name, mode: b.mode, logo: storageUrl(b.logo_path), whatsapp: b.contact?.whatsapp || b.contact?.phone || null }} />
    </div>
  )
}
