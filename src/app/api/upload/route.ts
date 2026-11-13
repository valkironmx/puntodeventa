import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { getSession, isSuperAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { cors } from '@/lib/mobile'
import { putObject } from '@/lib/storage'

const EXT: Record<string, string> = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png' }
const BUCKET: Record<string, string> = { product: 'product-images', logo: 'business-assets', hero: 'business-assets', promo: 'business-assets' }

// Sube una imagen ya comprimida en el cliente. Escritura solo para owner/admin del negocio. Ruta: {bucket}/{business_id}/...
export const OPTIONS = (req: Request) => new Response(null, { status: 204, headers: cors(req) })

export async function POST(req: Request) {
  const res = await upload(req)
  for (const [k, v] of Object.entries(cors(req))) res.headers.set(k, v)
  return res
}

async function upload(req: Request): Promise<Response> {
  const s = await getSession()
  if (!s) return Response.json({ error: 'Sin sesión' }, { status: 401 })
  const fd = await req.formData()
  const file = fd.get('file')
  const kind = String(fd.get('kind') ?? 'product')
  const businessId = String(fd.get('business_id') ?? '')
  if (!(file instanceof File) || !EXT[file.type] || !BUCKET[kind]) return Response.json({ error: 'Archivo no válido (usa JPG, PNG o WebP)' }, { status: 400 })
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return Response.json({ error: 'Negocio no válido' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: 'La imagen pesa más de 5 MB' }, { status: 400 })
  const [m] = await sql`select role from public.memberships where user_id = ${s.uid} and business_id = ${businessId}::uuid and active`
  if (!(m && (m.role === 'owner' || m.role === 'admin')) && !(await isSuperAdmin(s.uid))) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const rel = path.posix.join(BUCKET[kind], businessId, `${randomUUID()}${EXT[file.type]}`)
  await putObject(rel, new Uint8Array(await file.arrayBuffer()), file.type)
  return Response.json({ path: rel })
}
