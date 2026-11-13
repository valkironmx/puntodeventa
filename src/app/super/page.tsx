import Link from 'next/link'
import { logoutAction } from '@/app/actions/auth'
import { openMasterPanelAction, startDemoAction } from '@/app/actions/super'
import { Icon } from '@/components/icons'
import { PlainBar } from '@/components/panel/plain-bar'
import { requireSuper } from '@/lib/auth'
import { daysLabel, daysLeft } from '@/lib/plan-days'
import { appDomain, fmtPlainDate, initials } from '@/lib/format'
import { TERMS, type Mode } from '@/lib/terms'

const ST: Record<string, [string, string]> = { activo: ['aceptada', 'Activo'], por_vencer: ['espera', 'Por vencer'], suspendido: ['cancelada', 'Suspendido'] }

export default async function SuperHome() {
  const { db } = await requireSuper()
  const list = await db((tx) => tx`select b.id, b.name, b.slug, b.mode, b.status, b.plan_expires_at, b.is_master, b.master_mode, b.onboarded, p.name as plan from public.businesses b join public.plans p on p.code = b.plan order by b.created_at desc`)
  return (
    <>
      <PlainBar title="Super Admin" sub={`${list.length} negocios`} right={<>
        <Link href="/super/avisos" className="ibtn" aria-label="Enviar avisos" title="Enviar avisos"><Icon name="megaphone" /></Link>
        <Link href="/super/planes" className="ibtn" aria-label="Planes" title="Planes"><Icon name="tag" /></Link>
        <Link href="/super/qr" className="ibtn" aria-label="QRs de clientes" title="QRs de clientes"><Icon name="qr" /></Link>
        <form action={logoutAction}><button className="ibtn" aria-label="Cerrar sesión"><Icon name="logout" /></button></form>
      </>} />
      <div className="scroll pad">
        <div className="sec" style={{ marginTop: 4 }}>Paneles maestros</div>
        <p className="mut" style={{ marginTop: 0 }}>Un negocio de demostración por cada modo. <b>Iniciar demostración</b> lo muestra como una cuenta recién creada, desde “¿Qué vendes?”, para enseñarle a un cliente cómo empieza. No borra productos, promociones ni ventas.</p>
        <div className="qa masters">
          {(['food', 'retail', 'service'] as Mode[]).map((m) => {
            const mb = list.find((b) => b.is_master && (b.master_mode ?? b.mode) === m)
            return (
              <div key={m} className="master-card">
                <div className="master-h">
                  <span className="qi"><Icon name={TERMS[m].icon} size={22} /></span>
                  <div><b>Modo {TERMS[m].modeName}</b><small>{mb ? `${appDomain()}/${mb.slug}` : 'Aún no creado'}</small></div>
                </div>
                <form action={startDemoAction.bind(null, m)}>
                  <button className="btn sm"><Icon name="refresh" size={15} /> Iniciar demostración</button>
                </form>
                <form action={openMasterPanelAction.bind(null, m)}>
                  <button className="btn ghost sm">{mb ? 'Entrar al panel' : 'Crear y entrar'}</button>
                </form>
              </div>
            )
          })}
        </div>
        <div className="sec">Negocios</div>
        <div className="list-grid">
        {list.map((b) => (
          <Link href={`/super/negocios/${b.id}`} className="lrow" key={b.id} style={{ padding: 12 }}>
            <div className="av">{initials(b.name)}</div>
            <div className="li">
              <b>{b.name}{b.is_master ? <span className="tagh" style={{ marginLeft: 6 }}>Maestro</span> : null}</b>
              <div className="meta">{TERMS[b.mode as Mode].modeName} · {appDomain()}/{b.slug}</div>
              <div className="meta">{b.is_master ? 'Panel maestro · sin plan ni vencimiento' : `Plan ${b.plan}${b.plan_expires_at ? ` · vence ${fmtPlainDate(b.plan_expires_at)}` : ''}`}</div>
              {b.status !== 'suspendido' && !b.is_master ? <div className="meta"><span className={`st ${daysLabel(daysLeft(b.plan_expires_at)).cls}`} style={{ padding: '2px 8px' }}>{daysLabel(daysLeft(b.plan_expires_at)).text}</span></div> : null}
            </div>
            <span className={`st ${ST[b.status][0]}`}>{ST[b.status][1]}</span>
          </Link>
        ))}
        </div>
      </div>
      <Link href="/super/negocios/nuevo" className="fab" aria-label="Alta de negocio"><Icon name="plus" size={26} /></Link>
    </>
  )
}
