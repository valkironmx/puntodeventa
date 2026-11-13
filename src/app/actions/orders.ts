'use server'
import { z } from 'zod'
import { act, type Res } from '@/lib/action'
import { asUser, errMsg } from '@/lib/db'

const uuid = z.string().uuid()

/** Página pública: crea la solicitud (los precios se recalculan en el servidor). */
export async function requestOrderAction(input: {
  slug: string; name: string; orderType: string; address: string
  items: { product_id: string; qty: number; options: string[]; notes: string }[]
}): Promise<Res<string>> {
  try {
    const d = z.object({
      slug: z.string().regex(/^[a-z0-9]{2,40}$/),
      name: z.string().trim().min(2, 'Escribe tu nombre').max(60),
      orderType: z.enum(['mostrador', 'comer_aqui', 'para_llevar', 'domicilio', 'envio', 'en_local']),
      address: z.string().trim().max(160),
      items: z.array(z.object({ product_id: uuid, qty: z.number().positive().max(999), options: z.array(z.string().max(60)).max(20), notes: z.string().max(120) })).min(1, 'Tu pedido está vacío').max(50),
    }).parse(input)
    const token = await asUser(null, async (tx) =>
      (await tx`select public.request_order(${d.slug}, ${JSON.stringify(d.items)}::text::jsonb, ${d.name}, ${d.orderType}, ${d.address || null}) as t`)[0].t as string)
    return { ok: true, data: token }
  } catch (e) { return { ok: false, error: errMsg(e) } }
}

export async function publicOrderAction(token: string) {
  const t = z.string().regex(/^[A-Za-z0-9]{10,40}$/).parse(token)
  return asUser(null, async (tx) => (await tx`select public.public_order(${t}) as o`)[0].o)
}

/** Panel: confirmar, rechazar o marcar como entregada una solicitud. */
export async function decideOrderAction(id: string, status: 'confirmed' | 'rejected' | 'completed', reason = '') {
  return act(async (ctx) => {
    const d = z.object({ id: uuid, status: z.enum(['confirmed', 'rejected', 'completed']), reason: z.string().max(200) }).parse({ id, status, reason })
    await ctx.db((tx) => tx`select public.decide_order(${d.id}, ${d.status}, ${d.reason})`)
  })
}
