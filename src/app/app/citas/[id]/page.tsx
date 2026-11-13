import { notFound, redirect } from 'next/navigation'
import { getCtx } from '@/lib/auth'
import { loadAppointment } from '@/lib/sections'
import { AppointmentView } from '@/sections/views'

export default async function ApptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getCtx()
  if (!ctx.features.booking) redirect('/app')
  const p = await loadAppointment(ctx, id)
  if (!p) notFound()
  return <AppointmentView {...p} />
}
