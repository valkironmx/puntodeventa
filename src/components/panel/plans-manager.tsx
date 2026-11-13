'use client'
import { useState } from 'react'
import { deletePlanAction, savePlanAction } from '@/app/actions/super'
import { Icon } from '@/components/icons'
import { Field, Sheet, SwRow, useAction } from '@/components/ui'
import { moneyShort } from '@/lib/money'

interface Plan { code?: string; name: string; description: string | null; price: string; duration_days: number; max_employees: number; max_products: number | null; active: boolean; used?: number }
const EMPTY: Plan = { name: '', description: '', price: '0', duration_days: 30, max_employees: 2, max_products: null, active: true }
const num = (v: string) => v.replace(/\D/g, '').slice(0, 6)

export function PlansManager({ plans }: { plans: Plan[] }) {
  const [ed, setEd] = useState<Plan | null>(null)
  const { run, busy } = useAction()
  return (
    <>
      <div className="plan-grid">
        {plans.map((p) => (
          <div className={`plan-card ${p.active ? '' : 'off'}`} key={p.code}>
            <div className="t"><b>{p.name}</b>{p.active ? null : <span className="tagh">Desactivado</span>}</div>
            <div className="pr">{moneyShort(p.price)}<small> / {p.duration_days} días</small></div>
            {p.description ? <p className="mut">{p.description}</p> : null}
            <ul>
              <li><Icon name="users" size={15} /> Hasta {p.max_employees} empleados</li>
              <li><Icon name="tag" size={15} /> {p.max_products ? `Hasta ${p.max_products} productos` : 'Productos sin límite'}</li>
              <li><Icon name="store" size={15} /> {p.used} {p.used === 1 ? 'negocio' : 'negocios'} con este plan</li>
            </ul>
            <div className="rowbtn">
              <button className="btn ghost sm" onClick={() => setEd(p)}><Icon name="edit" size={15} /> Editar</button>
              {p.used ? null : <button className="btn ghost rj sm" disabled={busy} onClick={() => confirm(`¿Eliminar el plan "${p.name}"?`) && run(deletePlanAction(p.code!), 'Plan eliminado')}><Icon name="trash" size={15} /> Eliminar</button>}
            </div>
          </div>
        ))}
        <button className="plan-card plan-new" onClick={() => setEd({ ...EMPTY })}><Icon name="plus" size={26} /><b>Nuevo plan</b></button>
      </div>
      {ed ? (
        <Sheet title={ed.code ? `Editar ${ed.name}` : 'Nuevo plan'} onClose={() => setEd(null)} top={60}>
          <Field label="Nombre"><input className="inp" value={ed.name} maxLength={40} onChange={(e) => setEd({ ...ed, name: e.target.value })} placeholder="Ej. Premium" /></Field>
          <Field label="Descripción"><input className="inp" value={ed.description ?? ''} maxLength={160} onChange={(e) => setEd({ ...ed, description: e.target.value })} /></Field>
          <div className="g2">
            <Field label="Precio"><div className="money"><input className="inp" inputMode="decimal" value={ed.price} onChange={(e) => /^\d{0,7}(\.\d{0,2})?$/.test(e.target.value) && setEd({ ...ed, price: e.target.value })} /></div></Field>
            <Field label="Duración (días)" hint="Días que se dan al dar de alta o renovar."><input className="inp" inputMode="numeric" value={String(ed.duration_days)} onChange={(e) => setEd({ ...ed, duration_days: Number(num(e.target.value)) })} /></Field>
            <Field label="Máx. empleados"><input className="inp" inputMode="numeric" value={String(ed.max_employees)} onChange={(e) => setEd({ ...ed, max_employees: Number(num(e.target.value)) })} /></Field>
            <Field label="Máx. productos" hint="Vacío = sin límite."><input className="inp" inputMode="numeric" value={ed.max_products === null ? '' : String(ed.max_products)} onChange={(e) => setEd({ ...ed, max_products: num(e.target.value) ? Number(num(e.target.value)) : null })} /></Field>
          </div>
          <SwRow title="Plan activo" hint="Desactivado ya no se puede asignar a negocios nuevos; los que lo tienen lo conservan." on={ed.active} onChange={(v) => setEd({ ...ed, active: v })} />
          <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={async () => { if (await run(savePlanAction({ code: ed.code, name: ed.name, description: ed.description || null, price: ed.price || '0', duration_days: ed.duration_days, max_employees: ed.max_employees, max_products: ed.max_products, active: ed.active }), 'Plan guardado')) setEd(null) }}><Icon name="check" /> Guardar plan</button>
        </Sheet>
      ) : null}
    </>
  )
}
