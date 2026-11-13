import { z } from 'zod'
import { cors, ctxFromToken, handle, mobileLogin, snapshot } from '@/lib/mobile'

export const dynamic = 'force-dynamic'
export const OPTIONS = (req: Request) => new Response(null, { status: 204, headers: cors(req) })

export const POST = (req: Request) => handle(req, async () => {
  const d = z.object({ email: z.string().trim().email('Escribe un correo válido'), password: z.string().min(1, 'Escribe tu contraseña').max(200) }).parse(await req.json())
  const token = await mobileLogin(d.email, d.password)
  return { token, snapshot: await snapshot(await ctxFromToken(token)) }
})
