import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes } from 'node:crypto'
import { sql, asUser, type Tx } from './db'
import { getTerms, type Terms } from './terms'
import { getFeatures, type Features } from './mode-defaults'
import type { Role } from './permissions'

const COOKIE = 'sid'
const hash = (t: string) => createHash('sha256').update(t).digest('hex')

export interface Session { id: string; loginUserId: string; uid: string; businessId: string | null; isCashDevice: boolean; deviceLabel: string }

export const getSession = cache(async (): Promise<Session | null> => {
  // Panel web: cookie. App del teléfono: encabezado Authorization (sincronización y subida de fotos)
  let token = (await cookies()).get(COOKIE)?.value
  if (!token) {
    const auth = (await headers()).get('authorization') ?? ''
    const m = /^Bearer\s+([a-f0-9]{64})$/i.exec(auth.trim())
    if (m) token = m[1]
  }
  if (!token) return null
  const [s] = await sql`select id, user_id, acting_user_id, business_id, is_cash_device, device_label from app_auth.sessions where token_hash = ${hash(token)} and expires_at > now()`
  if (!s) return null
  return { id: s.id, loginUserId: s.user_id, uid: s.acting_user_id ?? s.user_id, businessId: s.business_id, isCashDevice: s.is_cash_device, deviceLabel: s.device_label }
})

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  await sql`insert into app_auth.sessions (token_hash, user_id, expires_at) values (${hash(token)}, ${userId}, now() + interval '30 days')`
  await sql`update auth.users set last_sign_in_at = now(), updated_at = now() where id = ${userId}`
  ;(await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 })
}

export async function destroySession() {
  const c = await cookies()
  const token = c.get(COOKIE)?.value
  if (token) await sql`delete from app_auth.sessions where token_hash = ${hash(token)}`
  c.delete(COOKIE)
}

/** Alta (o reuso) de un usuario invitado: si aún no tiene contraseña regresa el token de su invitación. */
export async function inviteUser(email: string): Promise<{ id: string; token: string | null }> {
  const e = email.toLowerCase().trim()
  let [u] = await sql`select id, encrypted_password from auth.users where email = ${e}`
  if (!u) [u] = await sql`select app_auth.create_user(${e}, null) as id, null::text as encrypted_password`
  if (u.encrypted_password) return { id: u.id, token: null }
  const [inv] = await sql`insert into app_auth.invites (user_id, token) values (${u.id}, ${randomBytes(24).toString('hex')})
    on conflict (user_id) do update set token = app_auth.invites.token returning token`
  return { id: u.id, token: inv.token }
}

export async function verifyPassword(email: string, password: string): Promise<string | null> {
  const [u] = await sql`select id from auth.users where email = ${email.toLowerCase().trim()} and encrypted_password is not null
    and encrypted_password = extensions.crypt(${password}, encrypted_password)`
  return u?.id ?? null
}

export const isSuperAdmin = cache(async (uid: string): Promise<boolean> => {
  const [r] = await sql`select 1 from public.platform_admins where user_id = ${uid}`
  return !!r
})

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Ctx {
  session: Session; uid: string; isSuper: boolean; role: Role
  business: any; membership: { id: string; display_name: string } | null
  terms: Terms; features: Features
  db: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>
}

/** Contexto del panel: usuario activo, negocio y rol. Redirige a /login si no hay sesión. */
export const getCtx = cache(async (): Promise<Ctx> => {
  const session = await getSession()
  if (!session) redirect('/login')
  const uid = session.uid
  const isSuper = await isSuperAdmin(uid)
  const mems = await sql`select id, business_id, role, display_name from public.memberships where user_id = ${uid} and active order by created_at`
  let mem = mems.find((m) => m.business_id === session.businessId) ?? null
  let businessId: string | null = mem?.business_id ?? null
  if (!businessId && isSuper && session.businessId) businessId = session.businessId
  if (!businessId && mems[0]) { mem = mems[0]; businessId = mems[0].business_id }
  if (!businessId) redirect(isSuper ? '/super' : '/login?e=sin-negocio')
  const [business] = (await sql`select * from public.businesses where id = ${businessId}`) as any[]
  if (!business) redirect(isSuper ? '/super' : '/login')
  const role: Role = mem ? (mem.role as Role) : 'super'
  // Negocio suspendido por el super admin: su equipo no puede usar el panel
  if (business.status === 'suspendido' && !isSuper) redirect('/suspendido')
  return {
    session, uid, isSuper, role, business,
    membership: mem ? { id: mem.id, display_name: mem.display_name } : null,
    terms: getTerms(business), features: getFeatures(business),
    db: (fn) => asUser(uid, fn),
  }
})

export async function requireSuper(): Promise<{ uid: string; db: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> }> {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!(await isSuperAdmin(session.uid))) redirect('/app')
  return { uid: session.uid, db: (fn) => asUser(session.uid, fn) }
}

/** Páginas de administración: el cajero solo tiene POS (y sus citas). */
export async function getManageCtx(): Promise<Ctx> {
  const ctx = await getCtx()
  if (ctx.role === 'cashier') redirect('/app/pos')
  return ctx
}
