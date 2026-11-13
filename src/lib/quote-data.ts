import 'server-only'
import type { Ctx } from './auth'

export async function quoteProducts(ctx: Ctx) {
  const rows = await ctx.db((tx) => tx`select id, name, description, coalesce(sale_price, price) as price, sale_unit from public.products
    where business_id = ${ctx.business.id} and active and deleted_at is null order by name`)
  return rows.map((p) => ({ id: p.id as string, name: p.name as string, description: (p.description ?? '') as string, price: String(Number(p.price)), unit: p.sale_unit as string }))
}
