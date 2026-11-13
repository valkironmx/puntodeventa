import { bearer, cors, ctxFromToken, handle, snapshot } from '@/lib/mobile'

export const dynamic = 'force-dynamic'
export const OPTIONS = (req: Request) => new Response(null, { status: 204, headers: cors(req) })
export const GET = (req: Request) => handle(req, async () => snapshot(await ctxFromToken(bearer(req))))
