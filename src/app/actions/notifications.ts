'use server'
import { getCtx } from '@/lib/auth'

/** Marca como leídas las notificaciones del negocio actual. No revalida: la lista conserva el resaltado hasta la siguiente visita. */
export async function markNotificationsReadAction(): Promise<void> {
  const ctx = await getCtx()
  await ctx.db((tx) => tx`select public.mark_notifications_read(${ctx.business.id})`)
}

export async function unreadNotificationsAction(): Promise<number> {
  const ctx = await getCtx()
  const [r] = await ctx.db((tx) => tx`select public.unread_notifications(${ctx.business.id}) as n`)
  return r.n as number
}
