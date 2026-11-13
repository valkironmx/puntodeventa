import { applyOps, bearer, cors, ctxFromToken, handle, opsSchema, snapshot } from '@/lib/mobile'

export const dynamic = 'force-dynamic'
export const OPTIONS = (req: Request) => new Response(null, { status: 204, headers: cors(req) })

// Recibe lo que se hizo sin conexión (en orden) y regresa el resultado de cada operación y los datos al día
export const POST = (req: Request) => handle(req, async () => {
  const ctx = await ctxFromToken(bearer(req))
  const body = (await req.json()) as { ops?: unknown }
  const results = await applyOps(ctx, opsSchema.parse(body.ops ?? []))
  return { results, snapshot: await snapshot(ctx) }
})
