'use server'
import { z } from 'zod'
import { inviteUser } from '@/lib/auth'
import { act, needOwner } from '@/lib/action'
import { sql } from '@/lib/db'

const uuid = z.string().uuid()

export async function inviteEmployeeAction(input: { name: string; email: string; role: string; pin: string }) {
  return act(async (ctx) => {
    needOwner(ctx)
    const d = z.object({
      name: z.string().trim().min(2, 'Escribe el nombre').max(60), email: z.string().trim().toLowerCase().email('Correo inválido'),
      role: z.enum(['admin', 'cashier']), pin: z.string().regex(/^\d{4}$/, 'El PIN debe tener 4 dígitos'),
    }).parse(input)
    // Límite de empleados según el plan
    const [{ n }] = await sql`select count(*)::int n from public.memberships where business_id = ${ctx.business.id} and active and role <> 'owner'`
    const [plan] = await sql`select max_employees from public.plans where code = ${ctx.business.plan}`
    if (plan && !ctx.business.is_master && n >= plan.max_employees) throw new Error(`Tu plan permite hasta ${plan.max_employees} empleados`)
    // Invitación con service role (equivale a auth.admin.inviteUserByEmail). En local no se envía correo: se muestra el link.
    const { id: userId, token } = await inviteUser(d.email)
    const u = { id: userId }
    const mid = await ctx.db(async (tx) => {
      const [m] = await tx`insert into public.memberships (business_id, user_id, role, display_name) values (${ctx.business.id}, ${u.id}, ${d.role}, ${d.name}) returning id`
      await tx`select public.set_pin(${m.id}, ${d.pin})`
      return m.id as string
    })
    return { membershipId: mid, inviteLink: token ? `/invitacion/${token}` : null }
  })
}

export async function updateEmployeeAction(input: { id: string; role?: string; active?: boolean; pin?: string; name?: string }) {
  return act(async (ctx) => {
    needOwner(ctx)
    const d = z.object({ id: uuid, role: z.enum(['admin', 'cashier']).optional(), active: z.boolean().optional(), pin: z.string().regex(/^\d{4}$/, 'El PIN debe tener 4 dígitos').optional(), name: z.string().trim().min(2).max(60).optional() }).parse(input)
    await ctx.db(async (tx) => {
      const [m] = await tx`select id, role from public.memberships where id = ${d.id} and business_id = ${ctx.business.id}`
      if (!m) throw new Error('Empleado no encontrado')
      if (m.role === 'owner' && (d.role || d.active === false)) throw new Error('No puedes cambiar el rol del dueño')
      if (d.role) await tx`update public.memberships set role = ${d.role} where id = ${d.id}`
      if (d.active !== undefined) await tx`update public.memberships set active = ${d.active} where id = ${d.id}`
      if (d.name) await tx`update public.memberships set display_name = ${d.name} where id = ${d.id}`
      if (d.pin) await tx`select public.set_pin(${d.id}, ${d.pin})`
    })
  })
}
