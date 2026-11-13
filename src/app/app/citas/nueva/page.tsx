import { getManageCtx } from '@/lib/auth'
import { loadNewAppointment } from '@/lib/sections'
import { NewAppointmentView } from '@/sections/views'

export default async function NewApptPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams
  return <NewAppointmentView {...await loadNewAppointment(await getManageCtx())} day={d} />
}
