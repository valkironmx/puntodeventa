import Link from 'next/link'
import { PreorderList, type PreorderRow } from '@/components/panel/preorder-list'
import { AppBar } from '@/components/ui'
import { getCtx } from '@/lib/auth'
import { loadWebOrders } from '@/lib/sections'
import { WebOrdersBody } from '@/sections/views'

export const metadata = { title: 'Pedidos' }

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ f?: string; t?: string }> }) {
  const ctx = await getCtx()
  const b = ctx.business
  const hasPos = b.mode === 'food' || b.mode === 'retail'
  const sp = await searchParams
  const [{ n }] = await ctx.db((tx) => tx`select count(*)::int n from public.order_requests where business_id = ${b.id} and status = 'pending'`)
  // Sin pestaña elegida: si hay solicitudes en línea pendientes, se abren primero
  const tab = hasPos && (sp.t === 'pos' || (sp.t !== 'web' && n === 0)) ? 'pos' : 'web'
  const back = ctx.role === 'cashier' ? '/app/pos' : '/app'

  const tabs = hasPos ? (
    <div className="pos-mode ped-tabs" role="tablist" aria-label="Tipo de pedido">
      <Link role="tab" aria-selected={tab === 'pos'} className={tab === 'pos' ? 'on' : ''} href="/app/pedidos?t=pos">Pedidos del punto de venta</Link>
      <Link role="tab" aria-selected={tab === 'web'} className={tab === 'web' ? 'on' : ''} href="/app/pedidos?t=web">Solicitudes en línea{n ? <i className="ped-n">{n}</i> : null}</Link>
    </div>
  ) : null

  if (tab === 'pos') {
    const f = ['proximos', 'saldo', 'entregados', 'todos'].includes(sp.f ?? '') ? sp.f! : 'proximos'
    const rows = await ctx.db((tx) => tx`
      select s.id, s.folio, s.customer_name, s.customer_phone, s.order_type, s.delivery_at, s.delivered_at, s.status, s.total, s.paid_total, s.balance, s.notes, s.custom_fields,
        coalesce((select json_agg(json_build_object('title', i.title, 'qty', i.qty, 'sale_unit', i.sale_unit, 'notes', i.notes) order by i.created_at, i.id) from public.sale_items i where i.sale_id = s.id), '[]') as items,
        coalesce((select json_agg(json_build_object('id', p.id, 'amount', p.amount, 'method', p.method, 'note', p.note, 'date', p.created_at, 'initial', p.is_initial,
          'by', (select m.display_name from public.memberships m where m.business_id = s.business_id and m.user_id = p.received_by limit 1)) order by p.created_at) from public.payments p where p.sale_id = s.id), '[]') as payments
      from public.sales s
      where s.business_id = ${b.id} and s.source = 'encargo'
        and ((${f} = 'proximos' and s.delivered_at is null and s.status <> 'cancelled')
          or (${f} = 'saldo' and s.balance > 0 and s.status <> 'cancelled')
          or (${f} = 'entregados' and s.delivered_at is not null)
          or ${f} = 'todos')
      order by case when ${f} in ('proximos', 'saldo') then s.delivery_at end asc, s.delivery_at desc
      limit 200`)
    const [c] = await ctx.db((tx) => tx`select count(*) filter (where delivered_at is null and status <> 'cancelled')::int proximos, count(*) filter (where balance > 0 and status <> 'cancelled')::int saldo
      from public.sales where business_id = ${b.id} and source = 'encargo'`)
    const data: PreorderRow[] = rows.map((r) => ({
      id: r.id, folio: r.folio, customer: r.customer_name ?? 'Cliente', phone: r.customer_phone, orderType: r.order_type, deliveryAt: r.delivery_at.toISOString(),
      deliveredAt: r.delivered_at ? r.delivered_at.toISOString() : null, status: r.status, total: r.total, paid: r.paid_total, balance: r.balance, notes: r.notes,
      fields: r.custom_fields ?? [], items: r.items, payments: r.payments.map((p: { id: string; amount: string | number; method: string; note: string | null; date: string; initial: boolean; by: string | null }) => ({ ...p, amount: String(p.amount), by: p.by ?? undefined })),
    }))
    return (
      <>
        <AppBar back={back} title="Pedidos" sub="Pedidos a futuro con su entrega y sus pagos" right={<Link className="btn sm" href="/app/pos" style={{ width: 'auto', padding: '0 14px' }}>Nuevo pedido</Link>} />
        <div className="scroll pad">
          {tabs}
          <PreorderList rows={data} filter={f} canManage={ctx.role !== 'cashier'} counts={{ proximos: c.proximos, saldo: c.saldo }} />
        </div>
      </>
    )
  }

  const f = sp.f ?? 'pending'
  return (
    <>
      <AppBar back={back} title="Pedidos" sub="Solicitudes que llegan desde tu página" />
      <div className="scroll pad">
        {tabs}
        <WebOrdersBody {...await loadWebOrders(ctx, f)} />
      </div>
    </>
  )
}
