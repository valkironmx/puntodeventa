'use server'
import { z } from 'zod'
import { act, needManage, type Res } from '@/lib/action'
import { asUser, errMsg } from '@/lib/db'

const uuid = z.string().uuid()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^\d{2}:\d{2}$/)

/* ---------- Público (anon) ---------- */
export async function publicSlotsAction(businessId: string, productId: string, membershipId: string | null, day: string): Promise<string[]> {
  const d = z.object({ b: uuid, p: uuid, m: uuid.nullable(), day: date }).parse({ b: businessId, p: productId, m: membershipId, day })
  const rows = await asUser(null, (tx) => tx`select starts_at from public.available_slots(${d.b}, ${d.p}, ${d.m}, ${d.day}::date)`)
  return rows.map((r) => (r.starts_at as Date).toISOString())
}

export async function requestAppointmentAction(input: { slug: string; productId: string; membershipId: string | null; startsAt: string; name: string; phone: string; notes: string }): Promise<Res<string>> {
  try {
    const d = z.object({
      slug: z.string().max(60), productId: uuid, membershipId: uuid.nullable(), startsAt: z.string().datetime(),
      name: z.string().trim().min(2, 'Escribe tu nombre').max(80), phone: z.string().trim().regex(/^\d{10}$/, 'Escribe tu WhatsApp a 10 dígitos'), notes: z.string().max(300),
    }).parse(input)
    const token = await asUser(null, async (tx) =>
      (await tx`select public.request_appointment(${d.slug}, ${d.productId}, ${d.membershipId}, ${d.startsAt}::timestamptz, ${d.name}, ${d.phone}, ${d.notes}) as t`)[0].t as string)
    return { ok: true, data: token }
  } catch (e) { return { ok: false, error: errMsg(e) } }
}

export async function cancelPublicAppointmentAction(token: string): Promise<Res> {
  try {
    await asUser(null, (tx) => tx`select public.cancel_appointment_public(${z.string().min(10).max(40).parse(token)})`)
    return { ok: true }
  } catch (e) { return { ok: false, error: errMsg(e) } }
}

/* ---------- Panel ---------- */
export async function decideAppointmentAction(id: string, decision: 'accept' | 'reject', reason = '') {
  return act(async (ctx) => {
    const d = z.object({ id: uuid, dec: z.enum(['accept', 'reject']), reason: z.string().max(200) }).parse({ id, dec: decision, reason })
    await ctx.db((tx) => tx`select public.decide_appointment(${d.id}, ${d.dec}, ${d.reason})`)
  })
}
export async function setAppointmentStatusAction(id: string, status: 'completed' | 'no_show' | 'cancelled') {
  return act(async (ctx) => {
    const s = z.enum(['completed', 'no_show', 'cancelled']).parse(status)
    await ctx.db((tx) => tx`select public.set_appointment_status(${uuid.parse(id)}, ${s})`)
  })
}
export async function panelSlotsAction(productId: string, membershipId: string, day: string, ignoreId: string | null = null) {
  return act(async (ctx) => {
    const d = z.object({ p: uuid, m: uuid, day: date, i: uuid.nullable() }).parse({ p: productId, m: membershipId, day, i: ignoreId })
    const rows = await ctx.db((tx) => tx`select starts_at, free from public.slot_grid(${ctx.business.id}, ${d.p}, ${d.m}, ${d.day}::date, true, ${d.i})`)
    return rows.map((r) => ({ at: (r.starts_at as Date).toISOString(), free: r.free as boolean }))
  })
}
export async function createAppointmentAction(input: { productId: string; membershipId: string; startsAt: string; name: string; phone: string; notes: string }) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = z.object({ productId: uuid, membershipId: uuid, startsAt: z.string().datetime(), name: z.string().trim().min(2, 'Escribe el nombre del cliente').max(80), phone: z.string().trim().regex(/^(\d{10})?$/, 'El teléfono debe tener 10 dígitos'), notes: z.string().max(300) }).parse(input)
    return ctx.db(async (tx) =>
      (await tx`select public.panel_create_appointment(${ctx.business.id}, ${d.productId}, ${d.membershipId}, ${d.startsAt}::timestamptz, ${d.name}, ${d.phone}, ${d.notes}) as id`)[0].id as string)
  })
}
export async function rescheduleAppointmentAction(id: string, startsAt: string, membershipId: string) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = z.object({ id: uuid, at: z.string().datetime(), m: uuid }).parse({ id, at: startsAt, m: membershipId })
    await ctx.db((tx) => tx`select public.reschedule_appointment(${d.id}, ${d.at}::timestamptz, ${d.m})`)
  })
}

const settingsSchema = z.object({
  online_enabled: z.boolean(), requires_approval: z.boolean(), approvers: z.enum(['owner_admin', 'owner_admin_assignee']),
  approval_timeout_min: z.number().int().min(15).max(2880), slot_interval_min: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  min_notice_min: z.number().int().min(0).max(10080), max_days_ahead: z.number().int().min(1).max(180),
  cancel_until_min: z.number().int().min(0).max(10080), buffer_min: z.number().int().min(0).max(120),
  reminder_24h: z.boolean(), reminder_2h: z.boolean(), reminder_template: z.string().max(500),
})
export async function saveBookingSettingsAction(input: z.input<typeof settingsSchema>) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = settingsSchema.parse(input)
    await ctx.db((tx) => tx`update public.booking_settings set ${tx(d as unknown as Record<string, string>)} where business_id = ${ctx.business.id}`)
  })
}

export async function saveStaffScheduleAction(membershipId: string, days: { weekday: number; enabled: boolean; start: string; end: string; breakStart: string | null; breakEnd: string | null }[]) {
  return act(async (ctx) => {
    needManage(ctx)
    const m = uuid.parse(membershipId)
    const d = z.array(z.object({ weekday: z.number().int().min(0).max(6), enabled: z.boolean(), start: time, end: time, breakStart: time.nullable(), breakEnd: time.nullable() })).max(7).parse(days)
    for (const x of d) if (x.enabled && x.end <= x.start) throw new Error('La hora de salida debe ser después de la de entrada')
    await ctx.db(async (tx) => {
      const [mem] = await tx`select id from public.memberships where id = ${m} and business_id = ${ctx.business.id}`
      if (!mem) throw new Error('Persona no encontrada')
      for (const x of d) {
        await tx`insert into public.staff_schedules (business_id, membership_id, weekday, start_time, end_time, break_start, break_end, enabled)
          values (${ctx.business.id}, ${m}, ${x.weekday}, ${x.start}, ${x.end}, ${x.breakStart}, ${x.breakEnd}, ${x.enabled})
          on conflict (membership_id, weekday) do update set start_time = excluded.start_time, end_time = excluded.end_time,
            break_start = excluded.break_start, break_end = excluded.break_end, enabled = excluded.enabled`
      }
    })
  })
}

export async function addBlockAction(input: { day: string; membershipId: string | null; reason: string }) {
  return act(async (ctx) => {
    needManage(ctx)
    const d = z.object({ day: date, membershipId: uuid.nullable(), reason: z.string().trim().max(80) }).parse(input)
    await ctx.db((tx) => tx`insert into public.schedule_blocks (business_id, membership_id, starts_at, ends_at, reason)
      values (${ctx.business.id}, ${d.membershipId}, (${d.day}::date)::timestamp at time zone 'America/Mexico_City',
              (${d.day}::date + 1)::timestamp at time zone 'America/Mexico_City', ${d.reason || 'Bloqueado'})`)
  })
}
export async function deleteBlockAction(id: string) {
  return act(async (ctx) => {
    if (ctx.role !== 'owner' && ctx.role !== 'super') throw new Error('Solo el dueño puede eliminar')
    await ctx.db((tx) => tx`delete from public.schedule_blocks where id = ${uuid.parse(id)} and business_id = ${ctx.business.id}`)
  })
}
