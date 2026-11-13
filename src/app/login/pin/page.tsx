import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { PinPad } from './pad'

export const metadata = { title: 'Modo caja' }

export default async function PinPage() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!s.isCashDevice) redirect('/app')
  const [own] = await sql`select business_id from public.memberships where user_id = ${s.loginUserId} and active order by created_at limit 1`
  const businessId = s.businessId ?? own?.business_id
  if (!businessId) redirect('/login')
  const [b] = await sql`select name, accent_color from public.businesses where id = ${businessId}`
  const staff = await sql`select id, display_name, role from public.memberships where business_id = ${businessId} and active and pin_hash is not null order by role desc, display_name`
  return (
    <div className="screen card" style={{ ['--g' as string]: b.accent_color }}>
      <div className="scroll pad" style={{ paddingTop: 34 }}>
        <div className="hi">{b.name}</div>
        <p className="mut" style={{ margin: '4px 0 18px' }}>{s.deviceLabel} · ¿Quién atiende?</p>
        <PinPad staff={staff.map((m) => ({ id: m.id, name: m.display_name, role: m.role }))} />
      </div>
    </div>
  )
}
