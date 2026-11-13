import { bearer, cors, handle, mobileLogout } from '@/lib/mobile'

export const dynamic = 'force-dynamic'
export const OPTIONS = (req: Request) => new Response(null, { status: 204, headers: cors(req) })
export const POST = (req: Request) => handle(req, async () => { await mobileLogout(bearer(req)); return { ok: true } })
