import { Pos } from '@/components/pos/pos'
import { getCtx } from '@/lib/auth'
import { modeDefaults } from '@/lib/mode-defaults'
import { ticketData } from '@/lib/panel-data'
import { redirect } from 'next/navigation'

export default async function PosPage({ searchParams }: { searchParams: Promise<{ cita?: string }> }) {
  const ctx = await getCtx()
  if (ctx.role === 'super') redirect('/app')
  const b = ctx.business
  const { cita } = await searchParams
  const [cats, products, session] = await ctx.db(async (tx) => [
    await tx`select id, name from public.categories where business_id = ${b.id} order by position, name`,
    await tx`select public.product_json(p.id, false) as p from public.products p where p.business_id = ${b.id} and p.active and p.deleted_at is null order by p.position, p.name`,
    (await tx`select id, opened_at from public.cash_sessions where business_id = ${b.id} and closed_at is null`)[0] ?? null,
  ] as const)
  let appt: { id: string; productId: string | null; customer: string } | null = null
  if (cita && /^[0-9a-f-]{36}$/.test(cita)) {
    const [a] = await ctx.db((tx) => tx`select id, product_id, customer_name from public.appointments where id = ${cita} and business_id = ${b.id} and status = 'confirmed' and sale_id is null`)
    if (a) appt = { id: a.id, productId: a.product_id, customer: a.customer_name }
  }
  const t = await ticketData(ctx)
  return (
    <Pos products={products.map((r) => r.p)} cats={cats.map((c) => ({ id: c.id, name: c.name }))} hasSession={!!session} rate={Number(b.tax_rate)}
      orderTypes={modeDefaults(b).orderTypes} mode={b.mode} cashier={ctx.membership?.display_name ?? ''} device={ctx.session.deviceLabel}
      searchPh={`Buscar ${ctx.terms.item}...`} ticket={t} autoPrint={!!t.settings.auto_print} appointment={appt} whatsapp={b.contact?.whatsapp ?? null} globalMode={b.tax_mode_global} fieldSuggestions={b.features?.custom_field_labels ?? modeDefaults(b).customFields} canQuote={ctx.role !== 'cashier'} />
  )
}
