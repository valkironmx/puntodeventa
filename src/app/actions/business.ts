'use server'
import { z } from 'zod'
import { act, needManage } from '@/lib/action'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const schedRow = z.object({ days: z.string().max(30), dow: z.array(z.number().int().min(0).max(6)), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/), enabled: z.boolean() })
const bizSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del negocio').max(80),
  tagline: z.string().trim().max(120).nullable(),
  logo_path: z.string().max(300).nullable(), hero_path: z.string().max(300).nullable(),
  hero_focal_x: z.number().int().min(0).max(100), hero_focal_y: z.number().int().min(0).max(100),
  hero_title: z.string().trim().max(70).nullable(), hero_text: z.string().trim().max(160).nullable(),
  hero_button: z.string().trim().max(28).nullable(), hero_action: z.enum(['catalog', 'whatsapp', 'booking', 'none']),
  accent_color: hex, accent_auto: z.boolean(),
  address: z.string().trim().max(200).nullable(), maps_url: z.string().trim().max(500).nullable(),
  lat: z.number().nullable(), lng: z.number().nullable(),
  contact: z.record(z.string(), z.string().max(200)).superRefine((c, cx) => {
    for (const k of ['whatsapp', 'phone']) if (c[k] && !/^\d{10}$/.test(c[k])) cx.addIssue({ code: 'custom', message: k === 'whatsapp' ? 'El WhatsApp debe tener 10 dígitos' : 'El teléfono debe tener 10 dígitos' })
  }),
  schedule: z.array(schedRow).max(7),
  hero_links: z.object({
    show: z.array(z.enum(['whatsapp', 'instagram', 'facebook', 'tiktok', 'custom'])).max(4, 'Máximo 4 botones en el banner').refine((a) => new Set(a).size === a.length, 'Botón repetido'),
    custom: z.object({ label: z.string().trim().max(24), url: z.string().trim().max(300) }).nullable(),
    call: z.boolean().optional(),
  }),
  order_types: z.array(z.enum(['mostrador', 'comer_aqui', 'para_llevar', 'domicilio', 'envio', 'en_local'])).min(1, 'Deja al menos un tipo de entrega').max(6),
}).partial()

export async function saveBusinessAction(input: z.input<typeof bizSchema>) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = bizSchema.parse(input)
    if (d.maps_url && !/^https?:\/\//.test(d.maps_url)) throw new Error('El link de Maps debe empezar con https://')
    const orderTypes = d.order_types
    const cols = (Object.keys(d) as (keyof typeof d)[]).filter((k) => k !== 'order_types')
    if (cols.length === 0 && !orderTypes) return
    const row: Record<string, unknown> = {}
    if (d.hero_links?.show.includes('custom') && !/^https:\/\/\S+\.\S+/.test(d.hero_links.custom?.url ?? '')) throw new Error('El enlace personalizado debe empezar con https://')
    for (const k of cols) row[k] = k === 'contact' || k === 'schedule' || k === 'hero_links' ? JSON.stringify(d[k]) : d[k]
    await ctx.db(async (tx) => {
      if (cols.length) await tx`update public.businesses set ${tx(row as Record<string, string>, ...(cols as string[]))} where id = ${ctx.business.id}`
      if (d.contact) await tx`update public.businesses set contact = ${JSON.stringify(d.contact)}::text::jsonb where id = ${ctx.business.id}`
      if (d.schedule) await tx`update public.businesses set schedule = ${JSON.stringify(d.schedule)}::text::jsonb where id = ${ctx.business.id}`
      if (orderTypes) await tx`update public.businesses set order_types = (select array_agg(x) from jsonb_array_elements_text(${JSON.stringify(orderTypes)}::text::jsonb) x) where id = ${ctx.business.id}`
      if (d.hero_links) await tx`update public.businesses set hero_links = ${JSON.stringify(d.hero_links)}::text::jsonb where id = ${ctx.business.id}`
    })
  })
}

export async function setModeAction(mode: string) {
  return act(async (ctx) => {
    needManage(ctx)
    const m = z.enum(['food', 'retail', 'service']).parse(mode)
    await ctx.db((tx) => tx`update public.businesses set mode = ${m} where id = ${ctx.business.id}`)
    if (m === 'service') await ctx.db((tx) => tx`update public.booking_settings set online_enabled = true where business_id = ${ctx.business.id}`)
  })
}

export async function setFeaturesAction(features: Record<string, boolean>) {
  return act(async (ctx) => {
    needManage(ctx)
    const f = z.record(z.enum(['inventory', 'variants', 'modifiers', 'units', 'duration', 'booking']), z.boolean()).parse(features)
    const keep = ctx.business.features?.custom_field_labels ? { custom_field_labels: ctx.business.features.custom_field_labels } : {}
    await ctx.db((tx) => tx`update public.businesses set features = ${JSON.stringify({ ...keep, ...f })}::text::jsonb where id = ${ctx.business.id}`)
  })
}

export async function saveTaxAction(mode: string, rate: number) {
  return act(async (ctx) => {
    needManage(ctx)
    const m = z.enum(['included', 'plus']).parse(mode)
    const r = z.union([z.literal(16), z.literal(8), z.literal(0)]).parse(rate)
    await ctx.db((tx) => tx`update public.businesses set tax_mode_global = ${m}, tax_rate = ${r} where id = ${ctx.business.id}`)
  })
}

export async function saveCustomFieldLabelsAction(labels: string[]) {
  return act(async (ctx) => {
    needManage(ctx)
    const l = z.array(z.string().trim().min(1).max(40)).max(20).parse(labels)
    const features = { ...(ctx.business.features ?? {}), custom_field_labels: l }
    await ctx.db((tx) => tx`update public.businesses set features = ${JSON.stringify(features)}::text::jsonb where id = ${ctx.business.id}`)
  })
}

export async function finishOnboardingAction() {
  return act(async (ctx) => {
    needManage(ctx)
    await ctx.db((tx) => tx`update public.businesses set onboarded = true where id = ${ctx.business.id}`)
  })
}

const ticketSchema = z.object({
  show_logo: z.boolean(), header_name: z.string().max(80).nullable(), show_address: z.boolean(), address_text: z.string().max(160).nullable(),
  show_phone: z.boolean(), phone_text: z.string().max(80).nullable(), show_tax_breakdown: z.boolean(), show_payment: z.boolean(), show_cashier: z.boolean(),
  thanks_message: z.string().max(120).nullable(), show_qr: z.boolean(), qr_text: z.string().max(120).nullable(), footer_text: z.string().max(240).nullable(),
  paper_width: z.union([z.literal(58), z.literal(80)]), auto_print: z.boolean(), open_cash_drawer: z.boolean(),
}).partial()
export async function saveTicketAction(input: z.input<typeof ticketSchema>) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = ticketSchema.parse(input)
    const cols = Object.keys(d)
    if (cols.length) await ctx.db((tx) => tx`update public.ticket_settings set ${tx(d as Record<string, string>, ...cols)} where business_id = ${ctx.business.id}`)
  })
}

export async function setQrDestinationAction(qrId: string, type: string, url: string | null) {
  return act(async (ctx) => {
    const t = z.enum(['catalog', 'whatsapp', 'custom']).parse(type)
    const id = z.string().uuid().parse(qrId)
    if (t === 'custom') z.string().url().startsWith('https://', 'La URL debe empezar con https://').parse(url)
    await ctx.db((tx) => tx`select public.set_qr_destination(${id}, ${t}, ${url})`)
  })
}

/* ---------- Promociones (banners) ---------- */
const promoSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, 'Escribe el título de la promoción').max(60),
  description: z.string().trim().max(160).nullable(),
  image_path: z.string().max(300).nullable(),
  button_label: z.string().trim().min(1, 'Escribe el texto del botón').max(28),
  product_id: z.string().uuid().nullable(),
  active: z.boolean(),
})
export async function savePromotionAction(input: z.input<typeof promoSchema>) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = promoSchema.parse(input)
    const b = ctx.business.id as string
    await ctx.db(async (tx) => {
      if (d.product_id) {
        const [p] = await tx`select id from public.products where id = ${d.product_id} and business_id = ${b}`
        if (!p) throw new Error('Producto no encontrado')
      }
      const upd = d.id ? await tx`update public.promotions set title = ${d.title}, description = ${d.description}, image_path = ${d.image_path}, button_label = ${d.button_label},
          product_id = ${d.product_id}, active = ${d.active} where id = ${d.id} and business_id = ${b} returning id` : []
      if (!upd.length) {
        await tx`insert into public.promotions (id, business_id, title, description, image_path, button_label, product_id, active, position)
          values (coalesce(${d.id ?? null}::uuid, gen_random_uuid()), ${b}, ${d.title}, ${d.description}, ${d.image_path}, ${d.button_label}, ${d.product_id}, ${d.active},
                  coalesce((select max(position) + 1 from public.promotions where business_id = ${b}), 1))`
      }
    })
  })
}
export async function togglePromotionAction(id: string, active: boolean) {
  return act(async (ctx) => {
    needManage(ctx)
    await ctx.db((tx) => tx`update public.promotions set active = ${active} where id = ${z.string().uuid().parse(id)} and business_id = ${ctx.business.id}`)
  })
}
export async function deletePromotionAction(id: string) {
  return act(async (ctx) => {
    if (ctx.role !== 'owner' && ctx.role !== 'super') throw new Error('Solo el dueño puede eliminar. Puedes desactivarla.')
    const r = await ctx.db((tx) => tx`delete from public.promotions where id = ${z.string().uuid().parse(id)} and business_id = ${ctx.business.id} returning id`)
    if (r.length === 0) throw new Error('No se pudo eliminar')
  })
}
