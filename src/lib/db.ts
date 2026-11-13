import postgres from 'postgres'

// Conexión de servidor (equivale a la service role). NUNCA se importa desde el cliente.
const g = globalThis as unknown as { __sql?: postgres.Sql }
const url = process.env.DATABASE_URL!
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url)
// Supabase: conexión cifrada; con el pooler en modo transacción (puerto 6543) no se usan sentencias preparadas
export const sql = g.__sql ?? (g.__sql = postgres(url, {
  max: process.env.VERCEL ? 3 : 10,
  onnotice: () => {},
  ssl: local ? false : 'require',
  prepare: !/:6543\//.test(url),
}))

export type Tx = postgres.TransactionSql

/** Ejecuta consultas con RLS activo, como lo hace Supabase: rol `authenticated` (o `anon`) + auth.uid(). */
export async function asUser<T>(uid: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${uid ?? ''}, true)`
    // Supabase también lee auth.uid() desde request.jwt.claims
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' })}, true)`
    await tx.unsafe(uid ? 'set local role authenticated' : 'set local role anon')
    return fn(tx)
  })) as T
}

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'issues' in e) {
    const issues = (e as { issues: { message: string }[] }).issues
    return issues[0]?.message ?? 'Datos inválidos'
  }
  const m = e instanceof Error ? e.message : String(e)
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para hacer esto'
  if (/duplicate key/i.test(m)) return 'Ya existe un registro con esos datos'
  return m
}
