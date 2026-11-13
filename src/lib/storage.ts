import 'server-only'
// Fotos del sistema. Rutas con forma "<bucket>/<negocio>/<archivo>" (ej. product-images/<id>/<uuid>.webp).
// - En tu Mac (sin claves de Supabase): carpeta storage/ del proyecto.
// - En la nube (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): Supabase Storage, buckets públicos.
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'storage')
const SB_URL = process.env.SUPABASE_URL?.replace(/\/$/, '')
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
export const cloudStorage = !!(SB_URL && SB_KEY)

const split = (rel: string) => { const i = rel.indexOf('/'); return { bucket: rel.slice(0, i), key: rel.slice(i + 1) } }
const sb = (p: string, init: RequestInit = {}) => fetch(`${SB_URL}/storage/v1${p}`, { ...init, headers: { authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY!, ...(init.headers ?? {}) } })

/** Guarda un archivo. */
export async function putObject(rel: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (cloudStorage) {
    const { bucket, key } = split(rel)
    const r = await sb(`/object/${bucket}/${key}`, { method: 'POST', body: Buffer.from(bytes), headers: { 'content-type': contentType, 'x-upsert': 'true', 'cache-control': '31536000' } })
    if (!r.ok) throw new Error(`No se pudo guardar la imagen (${r.status})`)
    return
  }
  const abs = path.join(ROOT, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, bytes)
}

/** Dirección pública (solo en la nube); en local regresa null y se sirve desde la carpeta. */
export const publicUrl = (rel: string) => (cloudStorage ? `${SB_URL}/storage/v1/object/public/${rel}` : null)

/** Lee un archivo local (solo modo local). */
export async function readLocal(rel: string): Promise<Buffer | null> {
  const file = path.normalize(path.join(ROOT, rel))
  if (!file.startsWith(ROOT + path.sep)) return null
  try { return await fs.readFile(file) } catch { return null }
}

/** Borra todas las fotos de un negocio en un bucket (al eliminar el negocio o la cuenta). */
export async function removeBusinessFiles(bucket: string, businessId: string): Promise<void> {
  if (!cloudStorage) { await fs.rm(path.join(ROOT, bucket, businessId), { recursive: true, force: true }).catch(() => {}); return }
  for (let round = 0; round < 20; round++) {
    const r = await sb(`/object/list/${bucket}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefix: businessId, limit: 1000 }) })
    const items = r.ok ? ((await r.json()) as { name: string }[]) : []
    if (!items.length) return
    await sb(`/object/${bucket}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: items.map((i) => `${businessId}/${i.name}`) }) })
  }
}
