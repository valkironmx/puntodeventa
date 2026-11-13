// Postgres local SIN Docker (binarios embebidos). Aplica el shim de auth, migraciones y seed.
import EmbeddedPostgres from 'embedded-postgres'
import postgres from 'postgres'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, '.pgdata')
export const PORT = 54329
const URL = `postgres://postgres:postgres@127.0.0.1:${PORT}`

const pg = new EmbeddedPostgres({
  databaseDir: dataDir, user: 'postgres', password: 'postgres', port: PORT, persistent: true,
  onLog: () => {}, onError: () => {},
  postgresFlags: ['-c', 'timezone=UTC'],
})

async function isUp() {
  const s = postgres(`${URL}/postgres`, { max: 1, connect_timeout: 2, onnotice: () => {} })
  try { await s`select 1`; return true } catch { return false } finally { await s.end({ timeout: 1 }) }
}

async function runFile(sql, file) {
  await sql.unsafe(fs.readFileSync(file, 'utf8'))
}

export async function migrate({ reset = false } = {}) {
  const admin = postgres(`${URL}/postgres`, { max: 1, onnotice: () => {} })
  if (reset) await admin.unsafe('drop database if exists app with (force)')
  const [{ exists }] = await admin`select exists(select 1 from pg_database where datname='app')`
  if (!exists) await admin.unsafe('create database app')
  await admin.end()
  const sql = postgres(`${URL}/app`, { max: 1, onnotice: () => {} })
  await sql.unsafe('create table if not exists public._migrations(name text primary key, applied_at timestamptz default now())')
  const done = new Set((await sql`select name from public._migrations`).map((r) => r.name))
  const files = [
    ...fs.readdirSync(path.join(root, 'supabase/local')).sort().map((f) => ['local/' + f, path.join(root, 'supabase/local', f)]),
    ...fs.readdirSync(path.join(root, 'supabase/migrations')).sort().map((f) => [f, path.join(root, 'supabase/migrations', f)]),
  ].filter(([, p]) => p.endsWith('.sql'))
  let fresh = false
  for (const [name, file] of files) {
    if (done.has(name)) continue
    console.log('  migración:', name)
    await runFile(sql, file)
    await sql`insert into public._migrations(name) values (${name})`
    fresh = true
  }
  const [{ n }] = await sql`select count(*)::int n from public.businesses`
  if (n === 0 && fresh) {
    console.log('  seed: supabase/seed.sql')
    await runFile(sql, path.join(root, 'supabase/seed.sql'))
    const { attachDemoPhotos } = await import('./demo-photos.mjs')
    console.log('  fotos demo:', await attachDemoPhotos(sql, root))
  }
  await sql.end()
}

export async function startDb() {
  if (await isUp()) return null
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) { console.log('Inicializando Postgres en .pgdata …'); await pg.initialise() }
  const pidFile = path.join(dataDir, 'postmaster.pid')
  if (fs.existsSync(pidFile)) fs.rmSync(pidFile)
  await pg.start()
  return pg
}

const cmd = process.argv[2]
if (process.argv[1] && process.argv[1].endsWith('db.mjs')) {
  const started = await startDb()
  await migrate({ reset: cmd === 'reset' })
  console.log(`Postgres listo en ${URL}/app`)
  if (cmd === 'reset' || cmd === 'migrate') { if (started) await started.stop(); process.exit(0) }
  const stop = async () => { if (started) await started.stop(); process.exit(0) }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  if (!started) process.exit(0)
}
