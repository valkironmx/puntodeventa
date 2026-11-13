'use server'
import { z } from 'zod'
import { act, needManage, needOwner } from '@/lib/action'

import { amount, preorderEdit, quoteSchema, saleSchema, uuid, type QuoteInput, type SaleInput, type SaleResult } from '@/lib/sale-schemas'
export type { QuoteInput, SaleInput, SaleResult }

/* ---------- Caja ---------- */
export async function openCashAction(opening: string) {
  return act(async (ctx) => {
    const o = amount.parse(opening || '0')
    await ctx.db((tx) => tx`select public.open_cash_session(${ctx.business.id}, ${o}, ${ctx.session.deviceLabel})`)
  })
}
export async function cashMovementAction(sessionId: string, type: 'in' | 'out', amt: string, reason: string) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = z.object({ s: uuid, t: z.enum(['in', 'out']), a: amount, r: z.string().trim().min(2, 'Escribe el motivo').max(120) }).parse({ s: sessionId, t: type, a: amt, r: reason })
    if (Number(d.a) <= 0) throw new Error('Monto inválido')
    await ctx.db((tx) => tx`select public.add_cash_movement(${d.s}, ${d.t}, ${d.a}, ${d.r})`)
  })
}
export async function closeCashAction(sessionId: string, counted: string, notes: string) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = z.object({ s: uuid, c: amount, n: z.string().max(300) }).parse({ s: sessionId, c: counted, n: notes })
    return ctx.db(async (tx) => (await tx`select public.close_cash_session(${d.s}, ${d.c}, ${d.n}) as r`)[0].r)
  })
}

/* ---------- Punto de venta ---------- */

export async function registerSaleAction(input: SaleInput) {
  return act(async (ctx) => {
    const d = saleSchema.parse(input)
    if (!d.extra && d.payments.length === 0) throw new Error('Indica cómo te pagan')
    if (d.extra && new Date(d.extra.delivery_at).getTime() < Date.now() - 60 * 60 * 1000) throw new Error('La fecha de entrega ya pasó')
    return ctx.db(async (tx) => {
      const [r] = await tx`select public.register_pos_sale(${ctx.business.id}, ${JSON.stringify(d.items)}::text::jsonb, ${JSON.stringify(d.payments)}::text::jsonb,
        ${d.cash_received}, ${d.customer_name}, ${d.order_type}, ${d.table_label}, ${d.appointment_id}, ${d.extra ? JSON.stringify(d.extra) : null}::text::jsonb) as r`
      return r.r as SaleResult
    })
  })
}

/* ---------- Ventas y pagos ---------- */
export async function addPaymentAction(saleId: string, amt: string, method: string, note: string) {
  return act(async (ctx) => {
    // El cajero solo puede abonar a pedidos; la función de la base lo valida
    const d = z.object({ s: uuid, a: amount, m: z.enum(['cash', 'card', 'transfer']), n: z.string().max(120) }).parse({ s: saleId, a: amt, m: method, n: note })
    return ctx.db(async (tx) => (await tx`select public.add_payment(${d.s}, ${d.a}, ${d.m}, ${d.n}) as r`)[0].r as { balance: string; status: string })
  })
}
export async function setDeliveredAction(saleId: string, delivered: boolean) {
  return act(async (ctx) => {
    await ctx.db((tx) => tx`select public.set_preorder_delivered(${uuid.parse(saleId)}, ${!!delivered})`)
  })
}
export async function cancelSaleAction(saleId: string) {
  return act(async (ctx) => {
    needOwner(ctx)
    await ctx.db((tx) => tx`select public.cancel_sale(${uuid.parse(saleId)})`)
  })
}


export async function updatePreorderAction(saleId: string, input: z.input<typeof preorderEdit>) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = preorderEdit.parse(input)
    await ctx.db((tx) => tx`select public.update_preorder(${uuid.parse(saleId)}, ${JSON.stringify(d)}::text::jsonb)`)
  })
}

/* ---------- Cotizaciones ---------- */

export async function saveQuoteAction(input: QuoteInput) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = quoteSchema.parse(input)
    return ctx.db(async (tx) => (await tx`select public.save_quote(${ctx.business.id}, ${d.id ?? null}, ${JSON.stringify(d)}::text::jsonb) as id`)[0].id as string)
  })
}
export async function setQuoteStatusAction(id: string, status: string) {
  return act(async (ctx) => {
    needManage(ctx)
    const s = z.enum(['draft', 'pending', 'accepted', 'rejected', 'cancelled']).parse(status)
    await ctx.db((tx) => tx`update public.quotes set status = ${s} where id = ${uuid.parse(id)} and business_id = ${ctx.business.id} and status <> 'converted'`)
  })
}
export async function trashQuoteAction(id: string, restore = false) {
  return act(async (ctx) => {
    needOwner(ctx)
    await ctx.db((tx) => tx`update public.quotes set deleted_at = ${restore ? null : new Date()} where id = ${uuid.parse(id)} and business_id = ${ctx.business.id}`)
  })
}
export async function duplicateQuoteAction(id: string) {
  return act(async (ctx) => {
    needManage(ctx)
    return ctx.db(async (tx) => {
      const [q] = await tx`select * from public.quotes where id = ${uuid.parse(id)} and business_id = ${ctx.business.id}`
      if (!q) throw new Error('Cotización no encontrada')
      const items = await tx`select product_id, title, description, unit_price, qty, sale_unit from public.quote_items where quote_id = ${q.id} order by position`
      const payload = { client_name: q.client_name ?? '', client_phone: q.client_phone ?? '', client_email: q.client_email ?? '', status: 'draft', valid_days: q.valid_days,
        prices_plus_tax: q.prices_plus_tax, custom_fields: q.custom_fields, notes: q.notes ?? '', items }
      return (await tx`select public.save_quote(${ctx.business.id}, null, ${JSON.stringify(payload)}::text::jsonb) as id`)[0].id as string
    })
  })
}
export async function convertQuoteAction(id: string, initial: { amount: string; method: string } | null) {
  return act(async (ctx) => {
    needManage(ctx)
    const pay = initial && Number(initial.amount) > 0 ? z.object({ amount, method: z.enum(['cash', 'card', 'transfer']) }).parse(initial) : null
    return ctx.db(async (tx) => (await tx`select public.convert_quote_to_sale(${uuid.parse(id)}, ${pay ? JSON.stringify(pay) : null}::text::jsonb) as r`)[0].r as { sale_id: string; folio: number })
  })
}
