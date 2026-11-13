// Tareas del servidor en local:
// 1) mantenimiento cada 5 min (vence citas y cotizaciones, purga papelera, avisos de plan) — en Supabase lo hace pg_cron;
// 2) escucha el canal "push" de Postgres y envía las notificaciones push — en Supabase sería un Database Webhook / Edge Function.
import { sql } from './lib/db'

const g = globalThis as unknown as { __maint?: ReturnType<typeof setInterval>; __pushListen?: boolean }
// En Vercel (servidor sin estado) lo hacen pg_cron y pg_net en Supabase; aquí solo corre en tu Mac
const local = !process.env.VERCEL
if (local && !g.__maint) {
  const run = () => sql`select public.run_maintenance()`.then(() => sql`select public.run_notifications()`).catch((e: unknown) => console.error('[mantenimiento]', e))
  run()
  g.__maint = setInterval(run, 5 * 60 * 1000)
}
if (local && !g.__pushListen) {
  g.__pushListen = true
  import('./lib/push-sender').then(({ handlePushEvent }) =>
    sql.listen('push', (payload) => { handlePushEvent(payload).catch((e) => console.error('[push]', e)) })
  ).catch((e) => console.error('[push] no se pudo escuchar el canal', e))
}
