import path from 'node:path'
import { publicUrl, readLocal } from '@/lib/storage'

// Fotos: en la nube redirige a Supabase Storage (público); en tu Mac las lee de la carpeta storage/.
const TYPES: Record<string, string> = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params
  const rel = parts.map(decodeURIComponent).join('/')
  const type = TYPES[path.extname(rel).toLowerCase()]
  if (!type || rel.includes('..')) return new Response('No encontrado', { status: 404 })
  const url = publicUrl(rel)
  if (url) return new Response(null, { status: 308, headers: { location: url, 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' } })
  const buf = await readLocal(rel)
  if (!buf) return new Response('No encontrado', { status: 404 })
  return new Response(new Uint8Array(buf), { headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' } })
}
