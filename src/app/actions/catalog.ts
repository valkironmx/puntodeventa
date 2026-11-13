'use server'
import { z } from 'zod'
import { act, needManage, needOwner } from '@/lib/action'

const moneyStr = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, 'Precio inválido')
const qtyStr = z.string().regex(/^-?\d{1,9}(\.\d{1,3})?$/, 'Cantidad inválida')

export async function saveCategoryAction(input: { id?: string; name: string; visible: boolean }) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1, 'Escribe un nombre').max(40), visible: z.boolean() }).parse(input)
    await ctx.db(async (tx) => {
      // Si el id ya existe se actualiza; si no, se crea con ese id (la app del teléfono genera el id al crear sin conexión)
      if (d.id && (await tx`update public.categories set name = ${d.name}, visible = ${d.visible} where id = ${d.id} and business_id = ${ctx.business.id} returning id`).length) return
      await tx`insert into public.categories (id, business_id, name, visible, position)
        values (coalesce(${d.id ?? null}::uuid, gen_random_uuid()), ${ctx.business.id}, ${d.name}, ${d.visible}, coalesce((select max(position) + 1 from public.categories where business_id = ${ctx.business.id}), 1))`
    })
  })
}

export async function moveCategoryAction(id: string, dir: -1 | 1) {
  return act(async (ctx) => {
    needManage(ctx)
    z.string().uuid().parse(id)
    await ctx.db(async (tx) => {
      const rows = await tx`select id from public.categories where business_id = ${ctx.business.id} order by position, name`
      const ids = rows.map((r) => r.id as string)
      const i = ids.indexOf(id), j = i + dir
      if (i < 0 || j < 0 || j >= ids.length) return
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
      for (let k = 0; k < ids.length; k++) await tx`update public.categories set position = ${k + 1} where id = ${ids[k]}`
    })
  })
}

export async function deleteCategoryAction(id: string) {
  return act(async (ctx) => {
    needOwner(ctx)
    const r = await ctx.db((tx) => tx`delete from public.categories where id = ${z.string().uuid().parse(id)} and business_id = ${ctx.business.id} returning id`)
    if (r.length === 0) throw new Error('No se pudo eliminar')
  })
}

const optionSchema = z.object({ id: z.string().uuid().optional(), label: z.string().trim().min(1).max(60), price_delta: z.string().regex(/^-?\d{1,9}(\.\d{1,2})?$/), track_stock: z.boolean(), stock: qtyStr, sku: z.string().max(40).nullable() })
const groupSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1, 'Nombra el grupo de opciones').max(40), type: z.enum(['modifier', 'variant']), options: z.array(optionSchema).min(1, 'Agrega al menos una opción').max(30) })
const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Escribe el nombre').max(120),
  category_id: z.string().uuid().nullable(),
  description: z.string().trim().max(1000).nullable(),
  emoji: z.string().max(8).nullable(),
  kind: z.enum(['product', 'service']),
  sale_unit: z.enum(['pieza', 'kg', 'g', 'm', 'cm', 'l', 'ml']),
  price: moneyStr, sale_price: moneyStr.nullable(),
  price_from: z.boolean(), duration_min: z.number().int().min(5).max(600).nullable(),
  tax_mode: z.enum(['global', 'included', 'plus', 'exempt']),
  track_stock: z.boolean(), stock: qtyStr,
  show_in_catalog: z.boolean(), active: z.boolean(), featured: z.boolean(),
  custom_fields: z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().max(120) })).max(12),
  images: z.array(z.string().max(300)).max(3, 'Máximo 3 fotos'),
  groups: z.array(groupSchema).max(6),
})
export type ProductInput = z.input<typeof productSchema>

export async function saveProductAction(input: ProductInput) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = productSchema.parse(input)
    if (d.sale_price !== null && Number(d.sale_price) >= Number(d.price)) throw new Error('El precio rebajado debe ser menor al precio normal')
    const b = ctx.business.id as string
    return ctx.db(async (tx) => {
      const base = {
        name: d.name, category_id: d.category_id, description: d.description, emoji: d.emoji, kind: d.kind, sale_unit: d.sale_unit,
        price: d.price, sale_price: d.sale_price, price_from: d.price_from, duration_min: d.duration_min, tax_mode: d.tax_mode,
        track_stock: d.track_stock, show_in_catalog: d.show_in_catalog, active: d.active, featured: d.featured,
        custom_fields: JSON.stringify(d.custom_fields),
      }
      let id = d.id
      const exists = id ? (await tx`update public.products set ${tx(base as unknown as Record<string, string>)} where id = ${id} and business_id = ${b} returning id`).length > 0 : false
      if (exists) {
        await tx`update public.products set custom_fields = ${JSON.stringify(d.custom_fields)}::text::jsonb where id = ${id!}`
        await tx`select public.adjust_stock(${id!}, null, ${d.stock})`
      } else {
        if (!ctx.business.is_master) {
          const [lim] = await tx`select p.max_products, p.name, (select count(*)::int from public.products x where x.business_id = ${b} and x.deleted_at is null) as n
            from public.plans p where p.code = ${ctx.business.plan}`
          if (lim?.max_products && lim.n >= lim.max_products) throw new Error(`Tu plan ${lim.name} permite hasta ${lim.max_products} ${ctx.terms.items}. Pide un plan mayor para agregar más.`)
        }
        // Id generado por la app del teléfono (creado sin conexión) o nuevo
        const [r] = await tx`insert into public.products ${tx({ ...base, ...(id ? { id } : {}), business_id: b, stock: d.stock } as unknown as Record<string, string>)} returning id`
        id = r.id as string
        await tx`update public.products set custom_fields = ${JSON.stringify(d.custom_fields)}::text::jsonb where id = ${id}`
      }
      // Fotos (máx. 3; la primera es la principal)
      await tx`delete from public.product_images where product_id = ${id!}`
      for (let i = 0; i < d.images.length; i++) await tx`insert into public.product_images (business_id, product_id, path, position) values (${b}, ${id!}, ${d.images[i]}, ${i})`
      // Opciones / variantes
      const keepGroups = d.groups.filter((g) => g.id).map((g) => g.id!)
      await tx`delete from public.product_option_groups where product_id = ${id!} and id not in (select x::uuid from jsonb_array_elements_text(${JSON.stringify(keepGroups)}::text::jsonb) x)`
      for (let gi = 0; gi < d.groups.length; gi++) {
        const g = d.groups[gi]
        let gid = g.id
        const gUpd = gid ? await tx`update public.product_option_groups set name = ${g.name}, type = ${g.type}, position = ${gi} where id = ${gid} and product_id = ${id!} returning id` : []
        if (!gUpd.length) gid = (await tx`insert into public.product_option_groups (id, business_id, product_id, name, type, position) values (coalesce(${gid ?? null}::uuid, gen_random_uuid()), ${b}, ${id!}, ${g.name}, ${g.type}, ${gi}) returning id`)[0].id as string
        const groupId = gid as string
        const keep = g.options.filter((o) => o.id).map((o) => o.id!)
        await tx`delete from public.product_options where group_id = ${groupId} and id not in (select x::uuid from jsonb_array_elements_text(${JSON.stringify(keep)}::text::jsonb) x)`
        for (let oi = 0; oi < g.options.length; oi++) {
          const o = g.options[oi]
          const oUpd = o.id ? await tx`update public.product_options set label = ${o.label}, price_delta = ${o.price_delta}, position = ${oi}, track_stock = ${o.track_stock}, sku = ${o.sku} where id = ${o.id} and group_id = ${groupId} returning id` : []
          if (oUpd.length) {
            await tx`select public.adjust_stock(${id!}, ${o.id!}, ${o.stock})`
          } else {
            await tx`insert into public.product_options (id, business_id, group_id, label, price_delta, position, track_stock, stock, sku)
              values (coalesce(${o.id ?? null}::uuid, gen_random_uuid()), ${b}, ${groupId}, ${o.label}, ${o.price_delta}, ${oi}, ${o.track_stock}, ${o.stock}, ${o.sku})`
          }
        }
      }
      return id!
    })
  })
}

export async function toggleProductAction(id: string, field: 'show_in_catalog' | 'active' | 'featured', value: boolean) {
  return act(async (ctx) => {
    needManage(ctx)
    const f = z.enum(['show_in_catalog', 'active', 'featured']).parse(field)
    await ctx.db((tx) => tx`update public.products set ${tx({ [f]: value })} where id = ${z.string().uuid().parse(id)} and business_id = ${ctx.business.id}`)
  })
}

export async function deleteProductAction(id: string) {
  return act(async (ctx) => {
    needOwner(ctx)
    await ctx.db((tx) => tx`update public.products set deleted_at = now(), active = false where id = ${z.string().uuid().parse(id)} and business_id = ${ctx.business.id}`)
  })
}
