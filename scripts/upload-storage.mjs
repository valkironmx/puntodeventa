// Sube a Supabase Storage las fotos que hoy están en la carpeta storage/ de tu Mac.
// Uso: node --env-file=.env.supabase scripts/upload-storage.mjs
import fs from 'node:fs'
import path from 'node:path'

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const root = path.join(process.cwd(), 'storage')
const TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
let ok = 0, fail = 0
for (const abs of walk(root)) {
  const type = TYPES[path.extname(abs).toLowerCase()]
  if (!type) continue
  const rel = path.relative(root, abs).split(path.sep).join('/')
  const [bucket, ...rest] = rel.split('/')
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${rest.join('/')}`, {
    method: 'POST', body: fs.readFileSync(abs),
    headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': type, 'x-upsert': 'true', 'cache-control': '31536000' },
  })
  if (r.ok) ok++; else { fail++; console.error('✗', rel, r.status, await r.text()) }
}
console.log(`Fotos subidas: ${ok}${fail ? ` · con error: ${fail}` : ''}`)
