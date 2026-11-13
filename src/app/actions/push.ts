'use server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

const subSchema = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) })

/** Guarda la suscripción push de este dispositivo para el usuario actual. */
export async function savePushSubscriptionAction(sub: unknown, userAgent: string): Promise<{ ok: boolean }> {
  const s = await getSession()
  if (!s) return { ok: false }
  const d = subSchema.parse(sub)
  await sql`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    values (${s.uid}, ${d.endpoint}, ${d.keys.p256dh}, ${d.keys.auth}, ${userAgent.slice(0, 300)})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  return { ok: true }
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<void> {
  const s = await getSession()
  if (!s) return
  await sql`delete from public.push_subscriptions where endpoint = ${z.string().max(1000).parse(endpoint)} and user_id = ${s.uid}`
}

/** Notificación de prueba a los dispositivos del usuario. */
export async function testPushAction(): Promise<{ sent: number }> {
  const s = await getSession()
  if (!s) return { sent: 0 }
  const { sendToUsers } = await import('@/lib/push-sender')
  const sent = await sendToUsers([s.uid], { title: 'Notificaciones activadas', body: 'Así te llegarán los avisos y las novedades de tu negocio.', url: '/app/notificaciones', tag: 'prueba' })
  return { sent }
}
