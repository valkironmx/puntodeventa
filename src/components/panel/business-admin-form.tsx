'use client'
import { DateField } from '@/components/inputs'
import { useState } from 'react'
import { addDaysAction, deleteBusinessAction, setBusinessStatusAction, updateBusinessAdminAction } from '@/app/actions/super'
import { Icon } from '@/components/icons'
import { Field, Sheet, useAction } from '@/components/ui'
import { fmtPlainDate } from '@/lib/format'
import { daysLabel, daysLeft } from '@/lib/plan-days'

interface Plan { code: string; name: string; duration_days: number; price: string; active: boolean }

export function BusinessAdminForm({ id, name, plan, status, expires, plans, master }: { id: string; name: string; plan: string; status: string; expires: string | null; plans: Plan[]; master?: boolean }) {
  const [p, setP] = useState(plan)
  const [date, setDate] = useState(expires ?? '')
  const [custom, setCustom] = useState('')
  const [del, setDel] = useState(false)
  const [confirm, setConfirm] = useState('')
  const { run, busy } = useAction()
  const left = daysLeft(expires)
  const lb = daysLabel(left)
  const suspended = status === 'suspendido'
  const addDays = async (n: number) => { const r = await run(addDaysAction(id, n), n > 0 ? `Se agregaron ${n} días` : `Se quitaron ${-n} días`); if (typeof r === 'string') setDate(r) }
  const selPlan = plans.find((x) => x.code === p)
  const danger = (
    <>
      <div className="sec">Zona de riesgo</div>
      <div className="box">
        <p className="mut" style={{ margin: '0 0 12px' }}>Eliminar borra el negocio con su catálogo, fotos, ventas, cotizaciones, citas, QR y las cuentas de su equipo que no pertenezcan a otro negocio. No se puede deshacer.</p>
        <button className="btn ghost rj sm" onClick={() => { setDel(true); setConfirm('') }}><Icon name="trash" size={16} /> Eliminar negocio</button>
      </div>
    </>
  )
  const delSheet = del ? (
    <Sheet title="Eliminar negocio" onClose={() => setDel(false)} top={160}>
      <div className="err">Se eliminará {name} con todos sus datos. Esta acción no se puede deshacer.</div>
      <Field label={`Escribe "${name}" para confirmar`}><input className="inp" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
      <button className="btn red" disabled={busy || confirm.trim().toLowerCase() !== name.trim().toLowerCase()} onClick={() => run(deleteBusinessAction(id, confirm), 'Negocio eliminado')}>Eliminar definitivamente</button>
      <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setDel(false)}>Cancelar</button>
    </Sheet>
  ) : null

  if (master) {
    return (
      <>
        <div className="box">
          <div className="swrow" style={{ alignItems: 'flex-start' }}>
            <div><b style={{ fontSize: 15 }}>Panel maestro</b><small>Es tuyo para demostrar la plataforma: no usa plan, no vence, no se suspende y no tiene límites de empleados ni productos.</small></div>
            <span className="st duenio">Maestro</span>
          </div>
        </div>
        {danger}
        {delSheet}
      </>
    )
  }

  return (
    <>
      <div className="box">
        <div className="swrow" style={{ alignItems: 'flex-start' }}>
          <div>
            <b style={{ fontSize: 15 }}>{suspended ? 'Suspendido' : 'Activo'}</b>
            <small>{suspended ? 'Su página pública muestra "no disponible" y su equipo no puede usar el panel.' : 'Su página pública y su panel funcionan con normalidad.'}</small>
          </div>
          <span className={`st ${suspended ? 'cancelada' : 'aceptada'}`}>{suspended ? 'Suspendido' : 'Activo'}</span>
        </div>
        <button className={`btn sm ${suspended ? '' : 'ghost rj'}`} style={{ marginTop: 12 }} disabled={busy}
          onClick={() => (suspended || window.confirm(`¿Suspender ${name}? Su página y su panel dejarán de funcionar hasta que lo actives.`)) && run(setBusinessStatusAction(id, suspended ? 'activo' : 'suspendido'), suspended ? 'Negocio activado' : 'Negocio suspendido')}>
          <Icon name={suspended ? 'check' : 'lock'} size={16} /> {suspended ? 'Activar negocio' : 'Suspender negocio'}
        </button>
      </div>

      <div className="sec">Días del plan</div>
      <div className="box">
        <div className="kv"><span>Vence</span><b>{expires ? fmtPlainDate(expires) : 'Sin fecha'}</b></div>
        <div className="kv"><span>Estado</span><span className={`st ${lb.cls}`}>{lb.text}</span></div>
        <div className="rowbtn" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {[7, 15, 30, 90, 365].map((n) => <button key={n} className="chip" disabled={busy} onClick={() => addDays(n)}>+{n} {n === 365 ? 'días (1 año)' : 'días'}</button>)}
        </div>
        <div className="cf" style={{ marginTop: 12 }}>
          <input className="inp" inputMode="numeric" placeholder="Otra cantidad (ej. 45 o -10)" value={custom} onChange={(e) => /^-?\d{0,4}$/.test(e.target.value) && setCustom(e.target.value)} />
          <button className="btn sm" style={{ width: 130 }} disabled={busy || !Number(custom)} onClick={async () => { await addDays(Number(custom)); setCustom('') }}>Aplicar</button>
        </div>
        <div className="hint">Si ya venció, los días se cuentan desde hoy. Un número negativo quita días.</div>
      </div>

      <div className="sec">Plan</div>
      <div className="box">
        <Field label="Plan">
          <select className="inp" value={p} onChange={(e) => setP(e.target.value)}>
            {plans.filter((x) => x.active || x.code === plan).map((x) => <option key={x.code} value={x.code}>{x.name} · ${Number(x.price)} · {x.duration_days} días{x.active ? '' : ' (desactivado)'}</option>)}
          </select>
        </Field>
        <Field label="Fecha de vencimiento" hint={selPlan && p !== plan ? `Al cambiar de plan puedes ajustar la fecha; este plan dura ${selPlan.duration_days} días.` : undefined}>
          <DateField value={date} onChange={setDate} placeholder="Sin fecha de vencimiento" clearable />
        </Field>
        <button className="btn sm" disabled={busy} onClick={() => run(updateBusinessAdminAction({ id, plan: p, planExpiresAt: date || null }), 'Plan guardado')}>Guardar plan y fecha</button>
      </div>
      {danger}
      {delSheet}
    </>
  )
}
