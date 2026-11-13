'use server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { sql } from '@/lib/db'

const prefsSchema = z.object({ sidebar_collapsed: z.boolean() }).partial()

/** Guarda preferencias del usuario en la base de datos: se conservan al cerrar sesión y en otros dispositivos. */
export async function savePrefsAction(patch: z.input<typeof prefsSchema>): Promise<void> {
  const s = await getSession()
  if (!s) return
  const d = prefsSchema.parse(patch)
  await sql`insert into public.user_prefs (user_id, prefs) values (${s.uid}, ${JSON.stringify(d)}::text::jsonb)
    on conflict (user_id) do update set prefs = public.user_prefs.prefs || excluded.prefs, updated_at = now()`
}
