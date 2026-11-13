'use server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { asUser, sql } from '@/lib/db'
import { createSession, destroySession, getSession, isSuperAdmin, verifyPassword } from '@/lib/auth'

const loginSchema = z.object({ email: z.string().email('Escribe un correo válido'), password: z.string().min(1, 'Escribe tu contraseña') })

async function homeFor(uid: string): Promise<string> {
  if (await isSuperAdmin(uid)) return '/super'
  const [m] = await sql`select role from public.memberships where user_id = ${uid} and active order by created_at limit 1`
  if (!m) return '/login?e=sin-negocio'
  return m.role === 'cashier' ? '/app/pos' : '/app'
}

export async function loginAction(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const p = loginSchema.safeParse({ email: fd.get('email'), password: fd.get('password') })
  if (!p.success) return { error: p.error.issues[0].message }
  const email = p.data.email.toLowerCase().trim()
  const [{ n }] = await sql`select count(*)::int n from app_auth.login_attempts where email = ${email} and not ok and at > now() - interval '15 minutes'`
  if (n >= 8) return { error: 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' }
  const uid = await verifyPassword(email, p.data.password)
  await sql`insert into app_auth.login_attempts (email, ok) values (${email}, ${!!uid})`
  if (!uid) return { error: 'Correo o contraseña incorrectos' }
  await sql`delete from app_auth.login_attempts where email = ${email} and not ok`
  await createSession(uid)
  redirect(await homeFor(uid))
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}

const inviteSchema = z.object({ token: z.string().min(10), password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres') })
export async function acceptInviteAction(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const p = inviteSchema.safeParse({ token: fd.get('token'), password: fd.get('password') })
  if (!p.success) return { error: p.error.issues[0].message }
  const [inv] = await sql`delete from app_auth.invites where token = ${p.data.token} returning user_id`
  const [u] = inv ? await sql`update auth.users set encrypted_password = extensions.crypt(${p.data.password}, extensions.gen_salt('bf')), updated_at = now()
    where id = ${inv.user_id} returning id` : []
  if (!u) return { error: 'Esta invitación ya no es válida' }
  await createSession(u.id)
  redirect(await homeFor(u.id))
}

/** Modo caja compartida: marcar este dispositivo como caja */
export async function setCashDeviceAction(on: boolean, label?: string) {
  const s = await getSession()
  if (!s) redirect('/login')
  await sql`update app_auth.sessions set is_cash_device = ${on}, device_label = ${label || 'Caja 1'}, acting_user_id = null where id = ${s.id}`
  redirect(on ? '/login/pin' : '/app')
}

const pinSchema = z.object({ membershipId: z.string().uuid(), pin: z.string().regex(/^\d{4}$/, 'El PIN tiene 4 dígitos') })
export async function pinLoginAction(membershipId: string, pin: string): Promise<{ error?: string }> {
  const p = pinSchema.safeParse({ membershipId, pin })
  if (!p.success) return { error: p.error.issues[0].message }
  const s = await getSession()
  if (!s || !s.isCashDevice) return { error: 'Este dispositivo no está en modo caja' }
  const [own] = await sql`select business_id from public.memberships where user_id = ${s.loginUserId} and active order by created_at limit 1`
  const businessId = s.businessId ?? own?.business_id
  if (!businessId) return { error: 'Sin negocio' }
  let uid: string | null = null
  try {
    const [r] = await sql`select public.verify_pin(${businessId}, ${p.data.membershipId}, ${p.data.pin}) as uid`
    uid = r.uid
  } catch (e) { return { error: e instanceof Error ? e.message : 'Error' } }
  if (!uid) return { error: 'PIN incorrecto' }
  await sql`update app_auth.sessions set acting_user_id = ${uid}, business_id = ${businessId} where id = ${s.id}`
  const [m] = await sql`select role from public.memberships where id = ${p.data.membershipId}`
  redirect(m.role === 'cashier' ? '/app/pos' : '/app')
}

/* ---------- Mi cuenta ---------- */
export async function changePasswordAction(current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const s = await getSession()
  if (!s) redirect('/login')
  const p = z.object({ current: z.string().min(1, 'Escribe tu contraseña actual'), next: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres').max(72) }).safeParse({ current, next })
  if (!p.success) return { ok: false, error: p.error.issues[0].message }
  // En modo caja el usuario activo puede ser otro: siempre se cambia la del usuario que inició sesión con contraseña
  const [u] = await sql`select id from auth.users where id = ${s.loginUserId} and encrypted_password = extensions.crypt(${p.data.current}, encrypted_password)`
  if (!u) return { ok: false, error: 'La contraseña actual no es correcta' }
  await sql`update auth.users set encrypted_password = extensions.crypt(${p.data.next}, extensions.gen_salt('bf')) where id = ${u.id}`
  await sql`delete from app_auth.sessions where user_id = ${u.id} and id <> ${s.id}`
  return { ok: true }
}

/** Eliminación de cuenta iniciada por el usuario (requisito de App Store y Google Play). */
export async function deleteAccountAction(confirm: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const s = await getSession()
  if (!s) redirect('/login')
  if (s.uid !== s.loginUserId) return { ok: false, error: 'Sal del modo caja e inicia sesión con tu propia cuenta para eliminarla.' }
  const uid = s.loginUserId
  const [u] = await sql`select id from auth.users where id = ${uid} and encrypted_password = extensions.crypt(${password}, encrypted_password)`
  if (!u) return { ok: false, error: 'La contraseña no es correcta' }
  const owned = await sql`select m.business_id from public.memberships m where m.user_id = ${uid} and m.role = 'owner'
    and not exists (select 1 from public.memberships o where o.business_id = m.business_id and o.role = 'owner' and o.user_id <> ${uid} and o.active)`
  try {
    await asUser(uid, (tx) => tx`select public.delete_my_account(${confirm})`)
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'No se pudo eliminar la cuenta' } }
  // Borra también las imágenes del negocio eliminado
  const { removeBusinessFiles } = await import('@/lib/storage')
  for (const b of owned) for (const bucket of ['product-images', 'business-assets']) await removeBusinessFiles(bucket, String(b.business_id)).catch(() => {})
  ;(await cookies()).delete('sid')
  redirect('/login?e=cuenta-eliminada')
}
