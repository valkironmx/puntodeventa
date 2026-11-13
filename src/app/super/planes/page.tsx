import { PlainBar } from '@/components/panel/plain-bar'
import { PlansManager } from '@/components/panel/plans-manager'
import { requireSuper } from '@/lib/auth'

export const metadata = { title: 'Planes' }

export default async function PlansPage() {
  const { db } = await requireSuper()
  const plans = await db((tx) => tx`select p.code, p.name, p.description, p.price, p.duration_days, p.max_employees, p.max_products, p.active,
      (select count(*)::int from public.businesses b where b.plan = p.code) as used
    from public.plans p order by p.position, p.name`)
  return (
    <>
      <PlainBar back="/super" title="Planes" sub="Precio, duración y límites de cada plan" />
      <div className="scroll pad">
        <PlansManager plans={plans.map((p) => ({ code: p.code, name: p.name, description: p.description, price: String(Number(p.price)), duration_days: p.duration_days,
          max_employees: p.max_employees, max_products: p.max_products, active: p.active, used: p.used }))} />
      </div>
    </>
  )
}
