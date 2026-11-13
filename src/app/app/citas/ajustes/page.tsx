import { notFound } from 'next/navigation'
import { getManageCtx } from '@/lib/auth'
import { loadBookingSettings } from '@/lib/sections'
import { BookingSettingsView } from '@/sections/views'

export default async function BookingSettingsPage() {
  const p = await loadBookingSettings(await getManageCtx())
  if (!p) notFound()
  return <BookingSettingsView {...p} />
}
