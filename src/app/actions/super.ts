'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession, inviteUser, requireSuper } from '@/lib/auth'
import { errMsg, sql } from '@/lib/db'
import { isRedirect, type Res } from '@/lib/action'
import { slugify } from '@/lib/slug'

const uuid = z.string().uuid()

async function sup<T>(fn: (s: Awaited<ReturnType<typeof requireSuper>>) => Promise<T>): Promise<Res<T>> {
  try {
    const s = await requireSuper()
    const data = await fn(s)
    revalidatePath('/', 'layout')
    return { ok: true, data }
  } catch (e) { if (isRedirect(e)) throw e; return { ok: false, error: errMsg(e) } }
}

/** Vista previa en vivo: "tuapp.com/cafelaluna · disponible" + sugerencia si está ocupado */
export async function checkSlugAction(name: string): Promise<{ slug: string; status: string; suggestion: string | null }> {
  await requireSuper()
  const slug = slugify(name).slice(0, 40)
  if (!slug) return { slug, status: 'invalid', suggestion: null }
  const [{ status }] = await sql`select public.slug_status(${slug}) as status`
  let suggestion: string | null = null
  if (status === 'taken' || status === 'reserved') {
    for (let i = 2; i < 50 && !suggestion; i++) {
      const [{ s }] = await sql`select public.slug_status(${slug + i}) as s`
      if (s === 'available') suggestion = slug + i
    }
  }
  return { slug, status, suggestion }
}

export async function createBusinessAction(input: { name: string; slug: string; ownerEmail: string; ownerName: string; phone: string; mode: string; plan: string }) {
  return sup(async ({ db }) => {
    const d = z.object({
      name: z.string().trim().min(2, 'Escribe el nombre del negocio').max(80), slug: z.string().regex(/^[a-z0-9]{2,40}$/, 'Slug inválido'),
      ownerEmail: z.string().trim().toLowerCase().email('Correo del dueño inválido'), ownerName: z.string().trim().max(60),
      phone: z.string().trim().regex(/^(\d{10})?$/, 'El teléfono debe tener 10 dígitos'), mode: z.enum(['food', 'retail', 'service']), plan: z.string().regex(/^[a-z0-9_-]{2,30}$/, 'Plan inválido'),
    }).parse(input)
    const id = await db(async (tx) => {
      const [pl] = await tx`select duration_days from public.plans where code = ${d.plan} and active`
      if (!pl) throw new Error('Ese plan no existe o está desactivado')
      const [{ id }] = await tx`select public.create_business(${d.name}, ${d.slug}, ${d.ownerEmail}, ${d.phone}, ${d.mode}, ${d.plan}) as id`
      await tx`update public.businesses set plan_expires_at = current_date + ${pl.duration_days}::int where id = ${id}`
      return id as string
    })
    // Invitación del dueño con service role (equivale a auth.admin.inviteUserByEmail) + membership owner
    const { id: userId, token } = await inviteUser(d.ownerEmail)
    const u = { id: userId }
    await sql`insert into public.memberships (business_id, user_id, role, display_name) values (${id}, ${u.id}, 'owner', ${d.ownerName || d.name})`
    return { id, inviteLink: token ? `/invitacion/${token}` : null }
  })
}

/* ---------- Negocios: plan, días, estatus y eliminación ---------- */
async function notMaster(db: Awaited<ReturnType<typeof requireSuper>>['db'], id: string) {
  const [b] = await db((tx) => tx`select is_master from public.businesses where id = ${id}`)
  if (b?.is_master) throw new Error('Los paneles maestros no usan planes ni vencimiento')
}

const statusOf = (expires: string | null) => {
  if (!expires) return 'activo'
  const days = Math.round((new Date(expires + 'T12:00:00Z').getTime() - Date.now()) / 86400000)
  return days <= 5 ? 'por_vencer' : 'activo'
}

export async function updateBusinessAdminAction(input: { id: string; plan: string; planExpiresAt: string | null }) {
  return sup(async ({ db }) => {
    const d = z.object({ id: uuid, plan: z.string().regex(/^[a-z0-9_-]{2,30}$/), planExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).parse(input)
    await notMaster(db, d.id)
    await db((tx) => tx`update public.businesses set plan = ${d.plan}, plan_expires_at = ${d.planExpiresAt}::date,
      status = case when status = 'suspendido' then status else ${statusOf(d.planExpiresAt)} end where id = ${d.id}`)
  })
}

/** Suma (o resta) días al vencimiento. Si ya venció, cuenta desde hoy. */
export async function addDaysAction(id: string, days: number) {
  return sup(async ({ db }) => {
    const d = z.object({ id: uuid, days: z.number().int().min(-3650).max(3650).refine((x) => x !== 0, 'Indica los días') }).parse({ id, days })
    await notMaster(db, d.id)
    const [r] = await db((tx) => tx`update public.businesses
      set plan_expires_at = greatest(coalesce(plan_expires_at, current_date), case when ${d.days} > 0 then current_date else '-infinity'::date end) + ${d.days}::int
      where id = ${d.id} returning plan_expires_at::text as e, status`)
    if (!r) throw new Error('Negocio no encontrado')
    if (r.status !== 'suspendido') await db((tx) => tx`update public.businesses set status = ${statusOf(r.e)} where id = ${d.id}`)
    return r.e as string
  })
}

export async function setBusinessStatusAction(id: string, status: 'activo' | 'suspendido') {
  return sup(async ({ db }) => {
    const d = z.object({ id: uuid, status: z.enum(['activo', 'suspendido']) }).parse({ id, status })
    await notMaster(db, d.id)
    await db(async (tx) => {
      const [b] = await tx`select plan_expires_at::text as e from public.businesses where id = ${d.id}`
      if (!b) throw new Error('Negocio no encontrado')
      await tx`update public.businesses set status = ${d.status === 'suspendido' ? 'suspendido' : statusOf(b.e)} where id = ${d.id}`
    })
  })
}

/** Elimina el negocio con todos sus datos, sus imágenes y las cuentas que solo pertenecían a él. */
export async function deleteBusinessAction(id: string, confirmName: string) {
  const r = await sup(async ({ db }) => {
    const bid = uuid.parse(id)
    const [b] = await db((tx) => tx`select name from public.businesses where id = ${bid}`)
    if (!b) throw new Error('Negocio no encontrado')
    if (confirmName.trim().toLowerCase() !== String(b.name).trim().toLowerCase()) throw new Error('Escribe el nombre exacto del negocio para confirmar')
    const users = (await sql`select user_id from public.memberships where business_id = ${bid}`).map((m) => m.user_id as string)
    await db((tx) => tx`delete from public.businesses where id = ${bid}`)
    // Cuentas huérfanas: sin otro negocio y que no son super admin
    if (users.length) await sql`delete from auth.users u where u.id in ${sql(users)}
      and not exists (select 1 from public.memberships m where m.user_id = u.id) and not exists (select 1 from public.platform_admins a where a.user_id = u.id)`
    const { removeBusinessFiles } = await import('@/lib/storage')
    for (const bucket of ['product-images', 'business-assets']) await removeBusinessFiles(bucket, bid).catch(() => {})
    // Si el super admin estaba dentro de ese negocio, lo saca
    const s = await getSession()
    if (s?.businessId === bid) await sql`update app_auth.sessions set business_id = null where id = ${s.id}`
  })
  if (!r.ok) return r
  redirect('/super')
}

/* ---------- Planes ---------- */
const planSchema = z.object({
  code: z.string().regex(/^[a-z0-9_-]{2,30}$/).optional(),
  name: z.string().trim().min(2, 'Escribe el nombre del plan').max(40),
  description: z.string().trim().max(160).nullable(),
  price: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, 'Precio inválido'),
  duration_days: z.number().int().min(1, 'Mínimo 1 día').max(3650),
  max_employees: z.number().int().min(0).max(999),
  max_products: z.number().int().min(1).max(100000).nullable(),
  active: z.boolean(),
})
export async function savePlanAction(input: z.input<typeof planSchema>) {
  return sup(async ({ db }) => {
    const d = planSchema.parse(input)
    await db(async (tx) => {
      if (d.code) {
        const r = await tx`update public.plans set name = ${d.name}, description = ${d.description}, price = ${d.price}, duration_days = ${d.duration_days},
          max_employees = ${d.max_employees}, max_products = ${d.max_products}, active = ${d.active} where code = ${d.code} returning code`
        if (!r.length) throw new Error('Plan no encontrado')
      } else {
        let code = slugify(d.name).slice(0, 24) || 'plan'
        for (let i = 2; (await tx`select 1 from public.plans where code = ${code}`).length; i++) code = `${slugify(d.name).slice(0, 22)}${i}`
        await tx`insert into public.plans (code, name, description, price, duration_days, max_employees, max_products, active, position)
          values (${code}, ${d.name}, ${d.description}, ${d.price}, ${d.duration_days}, ${d.max_employees}, ${d.max_products}, ${d.active},
                  coalesce((select max(position) + 1 from public.plans), 1))`
      }
    })
  })
}
export async function deletePlanAction(code: string) {
  return sup(async ({ db }) => {
    const c = z.string().regex(/^[a-z0-9_-]{2,30}$/).parse(code)
    const [{ n }] = await db((tx) => tx`select count(*)::int n from public.businesses where plan = ${c}`)
    if (n > 0) throw new Error(`Hay ${n} negocio(s) con este plan. Cámbialos de plan o desactívalo en lugar de eliminarlo.`)
    await db((tx) => tx`delete from public.plans where code = ${c}`)
  })
}

/** El super admin entra al panel de un negocio */
export async function enterBusinessAction(id: string) {
  await requireSuper()
  const s = await getSession()
  await sql`update app_auth.sessions set business_id = ${uuid.parse(id)} where id = ${s!.id}`
  redirect('/app')
}

export async function superQrAction(qrId: string, op: 'regenerate' | 'delete') {
  return sup(async ({ db }) => {
    const id = uuid.parse(qrId)
    if (op === 'regenerate') await db((tx) => tx`select public.regenerate_qr(${id})`)
    else await db((tx) => tx`select public.delete_qr(${id})`)
  })
}
export async function superQrDestinationAction(qrId: string, type: string, url: string | null) {
  return sup(async ({ db }) => {
    const t = z.enum(['catalog', 'whatsapp', 'custom']).parse(type)
    await db((tx) => tx`select public.set_qr_destination(${uuid.parse(qrId)}, ${t}, ${url})`)
  })
}

/** Panel maestro: negocio de demostración por modo. Lo crea si no existe y entra como dueño. */
export async function openMasterPanelAction(mode: string) {
  const { db } = await requireSuper()
  const m = z.enum(['food', 'retail', 'service']).parse(mode)
  // Entrar normal: el panel aparece listo, sin el asistente de una demostración anterior
  const id = await db(async (tx) => {
    const [{ id }] = await tx`select public.create_master_business(${m}) as id`
    await tx`update public.businesses set onboarded = true where id = ${id}`
    return id as string
  })
  try {
    const { attachDemoPhotos } = await import('../../../scripts/demo-photos.mjs')
    await attachDemoPhotos(sql, process.cwd(), id)
  } catch (e) { console.error('[fotos demo]', e) }
  const s = await getSession()
  await sql`update app_auth.sessions set business_id = ${id} where id = ${s!.id}`
  revalidatePath('/', 'layout')
  redirect('/app')
}

/* ---------- Avisos del sistema ---------- */
export async function sendAnnouncementAction(input: { title: string; body: string; link: string; modes: string[] }) {
  return sup(async ({ db, uid }) => {
    const d = z.object({
      title: z.string().trim().min(3, 'Escribe el título del aviso').max(80),
      body: z.string().trim().min(3, 'Escribe el mensaje').max(600),
      link: z.string().trim().max(300).refine((v) => v === '' || /^https:\/\//.test(v) || /^\/[a-z0-9/_-]*$/i.test(v), 'El enlace debe empezar con https:// o con /'),
      modes: z.array(z.enum(['food', 'retail', 'service'])).max(3),
    }).parse(input)
    const modes = d.modes.length === 0 || d.modes.length === 3 ? null : d.modes
    await db((tx) => tx`insert into public.announcements (title, body, link_url, audience_modes, created_by)
      values (${d.title}, ${d.body}, ${d.link || null},
        (select array_agg(x) from jsonb_array_elements_text(${modes ? JSON.stringify(modes) : null}::text::jsonb) x), ${uid})`)
  })
}
export async function deleteAnnouncementAction(id: string) {
  return sup(async ({ db }) => {
    await db((tx) => tx`delete from public.announcements where id = ${uuid.parse(id)}`)
  })
}

/** Demostración: entra al panel maestro como cuenta recién creada (asistente desde "¿Qué vendes?"), sin borrar datos. */
export async function startDemoAction(mode: string) {
  const { db } = await requireSuper()
  const m = z.enum(['food', 'retail', 'service']).parse(mode)
  const id = await db(async (tx) => (await tx`select public.start_master_demo(${m}) as id`)[0].id as string)
  try {
    const { attachDemoPhotos } = await import('../../../scripts/demo-photos.mjs')
    await attachDemoPhotos(sql, process.cwd(), id)
  } catch (e) { console.error('[fotos demo]', e) }
  const s = await getSession()
  await sql`update app_auth.sessions set business_id = ${id} where id = ${s!.id}`
  revalidatePath('/', 'layout')
  redirect('/app/asistente')
}
