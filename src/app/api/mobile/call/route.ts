import { bearer, callAction, cors, ctxFromToken, handle } from '@/lib/mobile'

export const dynamic = 'force-dynamic'
export const OPTIONS = (req: Request) => new Response(null, { status: 204, headers: cors(req) })

// Acciones que necesitan respuesta inmediata del servidor (horarios disponibles, contraseña, etc.)
export const POST = (req: Request) => handle(req, async () => {
  await ctxFromToken(bearer(req))
  return { data: await callAction(await req.json()) }
})
