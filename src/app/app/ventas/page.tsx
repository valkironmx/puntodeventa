import Link from 'next/link'
import { AppBar } from '@/components/ui'
import { getManageCtx } from '@/lib/auth'
import { fmtDateTime, folio } from '@/lib/format'
import { money } from '@/lib/money'

const ST: Record<string, [string, string]> = { paid: ['pagada', 'Liquidada'], partial: ['parcial', 'Pago parcial'], pending: ['pendiente', 'Pendiente'], cancelled: ['cancelada', 'Cancelada'] }
const FILTERS: [string, string][] = [['todas', 'Todas'], ['pedidos', 'Pedidos por entregar'], ['pagadas', 'Pagadas'], ['saldo', 'Con saldo'], ['canceladas', 'Canceladas']]

export default async function Sales({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const ctx = await getManageCtx()
  const { f = 'todas' } = await searchParams
  const rows = await ctx.db((tx) => tx`select id, folio, source, customer_name, status, total, balance, created_at, delivery_at from public.sales
    where business_id = ${ctx.business.id} and ((${f} = 'pedidos' and source = 'encargo' and status <> 'cancelled' and delivery_at > now() - interval '1 day') or ${f} = 'todas' or (${f} = 'pagadas' and status = 'paid') or (${f} = 'saldo' and status in ('partial','pending')) or (${f} = 'canceladas' and status = 'cancelled'))
    order by case when ${f} = 'pedidos' then delivery_at end asc, created_at desc limit 200`)
  return (
    <>
      <AppBar back="/app" title="Ventas y pagos" />
      <div className="scroll">
        <div className="chips">{FILTERS.map(([k, l]) => <Link key={k} href={`/app/ventas?f=${k}`} className={`chip ${f === k ? 'on' : ''}`}>{l}</Link>)}</div>
        <div className="pad cards">
          {rows.map((s) => (
            <Link href={`/app/ventas/${s.id}`} className="qcard" key={s.id} style={{ display: 'block' }}>
              <div className="t"><span className="f">{folio('V', s.folio)} · {s.source === 'quote' ? 'De cotización' : s.source === 'encargo' ? 'Pedido' : 'Punto de venta'}</span><span className={`st ${ST[s.status][0]}`}>{ST[s.status][1]}</span></div>
              <div className="c">{s.customer_name || 'Venta de mostrador'}</div>
              <div className="b"><span>{s.delivery_at ? `Entrega ${fmtDateTime(s.delivery_at)}` : fmtDateTime(s.created_at)}{Number(s.balance) > 0 && s.status !== 'cancelled' ? ` · falta ${money(s.balance)}` : ''}</span><b>{money(s.total)}</b></div>
            </Link>
          ))}
          {rows.length === 0 ? <div className="empty">No hay ventas con este filtro.</div> : null}
        </div>
      </div>
    </>
  )
}
