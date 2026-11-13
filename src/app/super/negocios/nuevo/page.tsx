import { PlainBar } from '@/components/panel/plain-bar'
import { NewBusinessForm } from '@/components/panel/new-business-form'
import { appDomain } from '@/lib/format'
import { requireSuper } from '@/lib/auth'

export default async function NewBusiness() {
  const { db } = await requireSuper()
  const plans = await db((tx) => tx`select code, name, duration_days from public.plans where active order by position, name`)
  return (
    <>
      <PlainBar back="/super" title="Alta de negocio" />
      <NewBusinessForm domain={appDomain()} plans={plans.map((p) => ({ code: p.code, name: p.name, days: p.duration_days }))} />
    </>
  )
}
