import { asUser } from '@/lib/db'
import { appUrl, waLink } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Redirección del QR dinámico: 302 + no-store. El destino se resuelve en el momento.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  let r: { type: string; url: string | null; slug: string; whatsapp: string | null } | null = null
  try {
    r = await asUser(null, async (tx) => (await tx`select public.resolve_qr(${code}, ${req.headers.get('user-agent')}) as r`)[0].r)
  } catch { r = null }
  if (!r) {
    return new Response(
      `<!doctype html><html lang="es-MX"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Código no activo</title>
       <body style="font-family:system-ui,sans-serif;background:#F5F7F6;color:#16211D;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
       <div><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#C53030" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg><h1 style="font-size:22px">Este código ya no está activo</h1><p style="color:#6B7A74">Pide al negocio su código QR actualizado.</p></div></body></html>`,
      { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
    )
  }
  const dest = r.type === 'custom' && r.url ? r.url : r.type === 'whatsapp' && r.whatsapp ? waLink(r.whatsapp) : `${appUrl()}/${r.slug}`
  return new Response(null, { status: 302, headers: { location: dest, 'cache-control': 'no-store' } })
}
