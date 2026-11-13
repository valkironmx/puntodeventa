import Link from 'next/link'
import { Icon } from '@/components/icons'
import { sql } from '@/lib/db'
import { TERMS, type Mode } from '@/lib/terms'

export const dynamic = 'force-dynamic'

export default async function Landing() {
  const demos = await sql`select slug, name, mode, tagline, accent_color from public.businesses where status <> 'suspendido' order by created_at limit 6`
  return (
    <main className="landing">
      <div className="logo" style={{ background: 'var(--g)', color: '#fff' }}>ta</div>
      <h1 style={{ fontSize: 34, letterSpacing: '-.03em', margin: '18px 0 8px' }}>Tu catálogo digital y punto de venta, en una sola app</h1>
      <p style={{ color: '#4d5b56', maxWidth: 620, lineHeight: 1.55 }}>Menú o catálogo público con pedidos por WhatsApp, punto de venta sencillo, cotizaciones con abonos, corte de caja, QR dinámico y agenda de citas.</p>
      <div style={{ display: 'flex', gap: 10, margin: '22px 0 34px', flexWrap: 'wrap' }}>
        <Link href="/login" className="btn" style={{ width: 'auto', padding: '0 26px' }}>Entrar a mi negocio</Link>
      </div>
      <h2 style={{ fontSize: 17 }}>Negocios de ejemplo</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
        {demos.map((d) => (
          <Link key={d.slug} href={`/${d.slug}`} className="box" style={{ marginBottom: 0, display: 'block' }}>
            <span className="qi" style={{ background: `color-mix(in srgb, ${d.accent_color} 12%, #fff)`, color: d.accent_color }}><Icon name={TERMS[d.mode as Mode].icon} size={22} /></span>
            <b style={{ display: 'block', marginTop: 6 }}>{d.name}</b>
            <small className="mut">{d.tagline}</small>
            <div style={{ color: d.accent_color, fontWeight: 800, fontSize: 12.5, marginTop: 8 }}>/{d.slug} →</div>
          </Link>
        ))}
      </div>
      <p className="foot" style={{ marginTop: 40 }}><Link href="/privacidad">Aviso de privacidad</Link> · <Link href="/terminos">Términos y condiciones</Link> · <Link href="/soporte">Soporte</Link> · <Link href="/eliminar-cuenta">Eliminar mi cuenta</Link></p>
    </main>
  )
}
