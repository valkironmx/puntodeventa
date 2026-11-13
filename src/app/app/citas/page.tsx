import { redirect } from 'next/navigation'
import { getCtx } from '@/lib/auth'
import { loadAppointments } from '@/lib/sections'
import { AppointmentsView } from '@/sections/views'

export default async function Appointments({ searchParams }: { searchParams: Promise<{ d?: string; p?: string }> }) {
  const ctx = await getCtx()
  if (!ctx.features.booking) redirect('/app')
  const sp = await searchParams
  return <AppointmentsView {...await loadAppointments(ctx, sp.d, sp.p)} />
}
