import { redirect } from 'next/navigation'
import { getCtx } from '@/lib/auth'
import { loadHome } from '@/lib/sections'
import { HomeView } from '@/sections/views'

export default async function Home() {
  const ctx = await getCtx()
  if (ctx.role === 'cashier') redirect('/app/pos')
  if (!ctx.business.onboarded) redirect('/app/asistente')
  return <HomeView {...await loadHome(ctx)} />
}
