import Link from 'next/link'
import { notFound } from 'next/navigation'
import { enterBusinessAction } from '@/app/actions/super'
import { Icon } from '@/components/icons'
import { BusinessAdminForm } from '@/components/panel/business-admin-form'
import { PlainBar } from '@/components/panel/plain-bar'
import { requireSuper } from '@/lib/auth'
import { sql } from '@/lib/db'
import { appDomain, fmtDate } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/permissions'
import { TERMS, type Mode } from '@/lib/terms'

export default async function BusinessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const { db } = await requireSuper()
  const [b] = await db((tx) => tx`select * from public.businesses where id = ${id}`)
  if (!b) notFound()
  const members = await sql`select m.display_name, m.role, m.active, u.email, (select token from app_auth.invites i where i.user_id = u.id) as invite_token, u.encrypted_password is not null as has_pw
    from public.memberships m join auth.users u on u.id = m.user_id where m.business_id = ${id} order by m.created_at`
  const [stats] = await db((tx) => tx`select (select count(*)::int from public.products where business_id = ${id} and deleted_at is null) as products,
    (select count(*)::int from public.sales where business_id = ${id}) as sales`)
  const plans = await db((tx) => tx`select code, name, duration_days, price, active from public.plans order by position, name`)
  const exp = b.plan_expires_at ? (b.plan_expires_at instanceof Date ? b.plan_expires_at.toISOString().slice(0, 10) : String(b.plan_expires_at).slice(0, 10)) : null
  return (
    <>
      <PlainBar back="/super" title={b.name} sub={`${TERMS[b.mode as Mode].modeName} · alta ${fmtDate(b.created_at)}`} />
      <div className="scroll pad narrow">
        <div className="linkc" style={{ marginTop: 0 }}>
          <div style={{ minWidth: 0 }}><small>Página pública</small><b>{appDomain()}/{b.slug}</b></div>
          <Link href={`/${b.slug}`} target="_blank" className="lb" style={{ marginLeft: 'auto' }} aria-label="Abrir página"><Icon name="eye" size={18} /></Link>
        </div>
        <form action={enterBusinessAction.bind(null, b.id)}><button className="btn dark" style={{ marginTop: 10 }}><Icon name="store" /> Entrar al panel del negocio</button></form>
        <div className="stats">
          <div className="stat"><b>{stats.products}</b><small>en catálogo</small></div>
          <div className="stat"><b>{stats.sales}</b><small>ventas</small></div>
          <div className="stat"><b>{members.length}</b><small>usuarios</small></div>
        </div>
        <div className="sec">Estatus</div>
        <BusinessAdminForm master={b.is_master} id={b.id} name={b.name} plan={b.plan} status={b.status} expires={exp}
          plans={plans.map((x) => ({ code: x.code, name: x.name, duration_days: x.duration_days, price: x.price, active: x.active }))} />
        <div className="sec">Usuarios</div>
        <div className="box">
          {members.map((m, i) => (
            <div className="emp" key={i}>
              <div style={{ minWidth: 0 }}>
                <b>{m.display_name}</b><small>{m.email}{m.has_pw ? '' : ' · invitación pendiente'}</small>
                {!m.has_pw && m.invite_token ? <small style={{ wordBreak: 'break-all', color: 'var(--g)' }}>/invitacion/{m.invite_token}</small> : null}
              </div>
              <span className={`st ${m.role === 'owner' ? 'duenio' : m.role === 'admin' ? 'admin' : 'cajero'}`}>{ROLE_LABEL[m.role]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
