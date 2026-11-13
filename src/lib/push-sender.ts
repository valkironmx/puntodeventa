import * as webpush from 'web-push'
import { sql } from './db'

// Envío de notificaciones push (Web Push con llaves VAPID). Funciona en Android, computadora y iPhone con la app instalada.
let ready = false
function setup(): boolean {
  if (ready) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:soporte@tuapp.com', pub, priv)
  ready = true
  return true
}

export interface PushMsg { title: string; body?: string | null; url?: string | null; tag?: string }

export async function sendToUsers(userIds: string[], msg: PushMsg): Promise<number> {
  if (!userIds.length || !setup()) return 0
  const subs = await sql`select id, endpoint, p256dh, auth from public.push_subscriptions where user_id in ${sql(userIds)}`
  let sent = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: msg.title, body: msg.body ?? '', url: msg.url ?? '/app/notificaciones', tag: msg.tag }), { TTL: 60 * 60 * 24 })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await sql`delete from public.push_subscriptions where id = ${s.id}`   // el dispositivo ya no está suscrito
      else console.error('[push]', code ?? e)
    }
  }))
  return sent
}

/** Atiende el canal "push" de Postgres: cada notificación o aviso nuevo se envía a quien corresponde. */
export async function handlePushEvent(payload: string): Promise<void> {
  const ev = JSON.parse(payload) as { table: string; id: string }
  if (ev.table === 'notifications') {
    const [n] = await sql`select business_id, user_id, title, body, link from public.notifications where id = ${ev.id}`
    if (!n) return
    const users = n.user_id ? [n.user_id as string] : (await sql`select user_id from public.memberships where business_id = ${n.business_id} and active and role in ('owner','admin')`).map((r) => r.user_id as string)
    await sendToUsers(users, { title: n.title, body: n.body, url: n.link ?? '/app/notificaciones' })
  } else if (ev.table === 'announcements') {
    const [a] = await sql`select title, body, link_url, audience_modes from public.announcements where id = ${ev.id}`
    if (!a) return
    const users = (await sql`select distinct m.user_id from public.memberships m join public.businesses b on b.id = m.business_id
      where m.active and b.status <> 'suspendido' and (${a.audience_modes}::text[] is null or b.mode = any (${a.audience_modes}::text[]))`).map((r) => r.user_id as string)
    await sendToUsers(users, { title: a.title, body: a.body, url: a.link_url ?? '/app/notificaciones' })
  }
}
