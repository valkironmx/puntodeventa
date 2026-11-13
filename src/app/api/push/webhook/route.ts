import { timingSafeEqual } from 'node:crypto'
import { handlePushEvent } from '@/lib/push-sender'

export const dynamic = 'force-dynamic'

// Lo llama la base de datos (pg_net) al crearse una notificación o aviso. Protegido con PUSH_WEBHOOK_SECRET.
export async function POST(req: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET ?? ''
  const got = req.headers.get('x-push-secret') ?? ''
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return new Response('No autorizado', { status: 401 })
  const body = await req.text()
  try { JSON.parse(body) } catch { return new Response('Datos inválidos', { status: 400 }) }
  await handlePushEvent(body)
  return Response.json({ ok: true })
}
