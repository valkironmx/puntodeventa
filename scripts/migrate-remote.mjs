// Crea / actualiza la base de datos en Supabase con las mismas migraciones que usas en tu Mac.
// Lee DATABASE_URL_DIRECT (conexión directa, puerto 5432) del archivo .env.supabase (no se sube a GitHub).
//
//   node --env-file=.env.supabase scripts/migrate-remote.mjs                 → aplica migraciones pendientes
//   node --env-file=.env.supabase scripts/migrate-remote.mjs --super          → además crea el Super Admin (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD)
//   node --env-file=.env.supabase scripts/migrate-remote.mjs --demo           → además carga los negocios de demostración
//   node --env-file=.env.supabase scripts/migrate-remote.mjs --push-webhook   → guarda la dirección del aviso push (APP_URL + PUSH_WEBHOOK_SECRET)
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

const direct = process.env.DATABASE_URL_DIRECT
if (!direct) { console.error('Falta DATABASE_URL_DIRECT en .env.supabase'); process.exit(1) }
if (/127\.0\.0\.1|localhost/.test(direct)) { console.error('DATABASE_URL_DIRECT apunta a tu Mac; debe ser la base de Supabase'); process.exit(1) }
const args = new Set(process.argv.slice(2))
const root = process.cwd()
const opts = { max: 1, ssl: 'require', prepare: false, connect_timeout: 15, onnotice: (n) => console.log('  ·', n.message) }

// La conexión directa de Supabase (db.<ref>.supabase.co) solo existe por IPv6. Si la red no la alcanza,
// se usa el pooler en modo sesión (IPv4), con el mismo usuario y contraseña: postgres.<ref>@aws-X-<región>.pooler.supabase.com:5432
async function connect() {
  const candidates = [direct]
  const m = /^postgres(?:ql)?:\/\/postgres:(.+)@db\.([a-z0-9]+)\.supabase\.co:5432\/(\w+)$/.exec(direct)
  if (m) {
    const [, raw, ref, dbname] = m
    const pass = encodeURIComponent(decodeURIComponent(raw.trim()))   // ignora espacios pegados por error
    const regions = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'sa-east-1', 'eu-west-1', 'eu-west-2', 'eu-central-1', 'ap-southeast-1']
    for (const pre of ['aws-1', 'aws-0']) for (const r of regions) candidates.push(`postgresql://postgres.${ref}:${pass}@${pre}-${r}.pooler.supabase.com:5432/${dbname}`)
  }
  for (const u of candidates) {
    const sql = postgres(u, opts)
    try { await sql`select 1`; if (u !== direct) console.log('Conexión por el pooler de Supabase:', new URL(u).host); return sql }
    catch (e) { await sql.end({ timeout: 1 }).catch(() => {}); if (u === direct) console.log('Conexión directa no disponible desde esta red; probando el pooler…') }
  }
  throw new Error('No se pudo conectar a la base de Supabase. Revisa la contraseña en DATABASE_URL_DIRECT.')
}
const sql = await connect()

try {
  const [{ host }] = await sql`select inet_server_addr()::text as host`
  console.log(`Conectado a la base de Supabase (${host ?? 'remoto'})`)
  await sql.unsafe('create schema if not exists app_auth')
  await sql.unsafe('create table if not exists app_auth.migrations (name text primary key, applied_at timestamptz default now())')
  const done = new Set((await sql`select name from app_auth.migrations`).map((r) => r.name))
  const files = fs.readdirSync(path.join(root, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
  for (const f of files) {
    if (done.has(f)) continue
    console.log('migración:', f)
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(root, 'supabase/migrations', f), 'utf8'))
      await tx`insert into app_auth.migrations (name) values (${f})`
    })
  }
  console.log('Migraciones al día.')

  if (args.has('--super')) {
    const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim(), pass = process.env.SUPER_ADMIN_PASSWORD
    if (!email || !pass || pass.length < 10) throw new Error('Define SUPER_ADMIN_EMAIL y SUPER_ADMIN_PASSWORD (mínimo 10 caracteres) en .env.supabase')
    let [u] = await sql`select id from auth.users where email = ${email}`
    if (!u) [u] = await sql`select app_auth.create_user(${email}, ${pass}) as id`
    else await sql`update auth.users set encrypted_password = extensions.crypt(${pass}, extensions.gen_salt('bf')), updated_at = now() where id = ${u.id}`
    await sql`insert into public.platform_admins (user_id) values (${u.id}) on conflict do nothing`
    console.log(`Super Admin listo: ${email} (borra SUPER_ADMIN_PASSWORD de .env.supabase cuando entres)`)
  }

  if (args.has('--demo')) {
    const [{ n }] = await sql`select count(*)::int n from public.businesses`
    if (n > 0) console.log('Ya hay negocios en la base: no se cargan los de demostración.')
    else {
      await sql.unsafe(fs.readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8'))
      console.log('Negocios de demostración cargados (contraseña en CREDENCIALES-LOCAL.md).')
      const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      if (url && key) {
        const { attachDemoPhotos } = await import('./demo-photos.mjs')
        const upload = async (rel, file) => {
          const r = await fetch(`${url}/storage/v1/object/${rel}`, { method: 'POST', body: fs.readFileSync(file),
            headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': '31536000' } })
          if (!r.ok) throw new Error(`No se pudo subir ${rel}: ${r.status} ${await r.text()}`)
        }
        console.log('Fotos demo subidas a Supabase Storage:', await attachDemoPhotos(sql, root, null, upload))
      }
    }
  }

  if (args.has('--push-webhook')) {
    const app = process.env.APP_URL?.replace(/\/$/, ''), secret = process.env.PUSH_WEBHOOK_SECRET
    if (!app?.startsWith('https://') || !secret) throw new Error('Define APP_URL (https://…) y PUSH_WEBHOOK_SECRET en .env.supabase')
    await sql`insert into public.app_settings (key, value) values ('push_webhook_url', ${`${app}/api/push/webhook`}), ('push_webhook_secret', ${secret})
      on conflict (key) do update set value = excluded.value, updated_at = now()`
    console.log('Avisos push conectados a', `${app}/api/push/webhook`)
  }
} catch (e) {
  console.error('Error:', e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
