import { PlainBar } from '@/components/panel/plain-bar'
import { SuperQrList } from '@/components/qr/super-qr-list'
import { requireSuper } from '@/lib/auth'
import { appUrl, appDomain } from '@/lib/format'

export default async function SuperQr() {
  const { db } = await requireSuper()
  const rows = await db((tx) => tx`select q.id, q.code, q.destination_type, q.destination_url, q.scans_count, b.name, b.slug
    from public.qr_codes q join public.businesses b on b.id = q.business_id where q.active and q.deleted_at is null order by b.name`)
  return (
    <>
      <PlainBar back="/super" title="QRs de clientes" sub={`${rows.length} activos`} />
      <div className="scroll pad">
        <SuperQrList base={appUrl()} domain={appDomain()} rows={rows.map((r) => ({ id: r.id, code: r.code, type: r.destination_type, url: r.destination_url, scans: r.scans_count, name: r.name, slug: r.slug }))} />
      </div>
    </>
  )
}
