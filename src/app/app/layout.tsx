import { Shell } from '@/components/shell'
import { getCtx } from '@/lib/auth'
import { sql } from '@/lib/db'
import { storageUrl } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCtx()
  const b = ctx.business
  const [{ n: pending }] = await ctx.db((tx) => tx`select count(*)::int n from public.appointments where business_id = ${b.id} and status = 'pending'`)
  const [plan] = await sql`select name from public.plans where code = ${b.plan}`
  const [{ n: unread }] = await ctx.db((tx) => tx`select public.unread_notifications(${b.id}) as n`)
  const [pref] = await sql`select prefs from public.user_prefs where user_id = ${ctx.uid}`
  const [{ n: orders }] = await ctx.db((tx) => tx`select count(*)::int n from public.order_requests where business_id = ${b.id} and status = 'pending'`)
  return (
    <Shell
      business={{ name: b.name, slug: b.slug, logo: storageUrl(b.logo_path), accent: b.accent_color, plan: b.plan, planName: b.is_master ? 'Maestro' : plan?.name ?? b.plan }}
      role={ctx.role} userName={ctx.membership?.display_name ?? 'Super Admin'} isSuper={ctx.isSuper}
      cashDevice={ctx.session.isCashDevice} deviceLabel={ctx.session.deviceLabel}
      catalogWord={ctx.terms.catalog} booking={ctx.features.booking} pending={pending} unread={unread} orders={orders} collapsed={!!pref?.prefs?.sidebar_collapsed}
    >
      {children}
    </Shell>
  )
}
