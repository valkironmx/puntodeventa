import { AnnouncementsManager } from '@/components/panel/announcements-manager'
import { PlainBar } from '@/components/panel/plain-bar'
import { requireSuper } from '@/lib/auth'
import { fmtDateTime } from '@/lib/format'

export const metadata = { title: 'Avisos' }

export default async function AnnouncementsPage() {
  const { db } = await requireSuper()
  const [rows, counts] = await db(async (tx) => [
    await tx`select a.id, a.title, a.body, a.link_url, a.audience_modes, a.created_at,
        (select count(distinct k.user_id)::int from public.notification_reads k where k.kind = 'a' and k.ref_id = a.id) as readers
      from public.announcements a order by a.created_at desc limit 100`,
    await tx`select mode, count(*)::int n from public.businesses where status <> 'suspendido' group by mode`,
  ] as const)
  const byMode: Record<string, number> = { food: 0, retail: 0, service: 0 }
  for (const c of counts) byMode[c.mode] = c.n
  return (
    <>
      <PlainBar back="/super" title="Avisos" sub="Mensajes que ven los negocios en su panel de notificaciones" />
      <div className="scroll pad">
        <AnnouncementsManager byMode={byMode}
          sent={rows.map((r) => ({ id: r.id, title: r.title, body: r.body, link: r.link_url, modes: r.audience_modes, at: fmtDateTime(r.created_at), readers: r.readers }))} />
      </div>
    </>
  )
}
