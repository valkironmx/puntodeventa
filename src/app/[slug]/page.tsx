import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { CatalogClient, type PublicCatalog } from '@/components/catalog/catalog-client'
import { asUser } from '@/lib/db'
import { appUrl, storageUrl } from '@/lib/format'
import { openStatus } from '@/lib/hours'
import { modeDefaults } from '@/lib/mode-defaults'
import { getTerms } from '@/lib/terms'
import { isReserved } from '@/lib/slug'

export const dynamic = 'force-dynamic'

async function load(slug: string): Promise<(PublicCatalog & { suspended?: boolean; name?: string }) | null> {
  if (isReserved(slug) || !/^[a-z0-9]{2,40}$/.test(slug)) return null
  return asUser(null, async (tx) => (await tx`select public.public_catalog(${slug}) as c`)[0].c)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = await load(slug)
  if (!c || c.suspended) return { title: 'No disponible' }
  const b = c.business
  const img = storageUrl(b.hero_path) ?? storageUrl(b.logo_path)
  return {
    title: `${b.name} · ${getTerms(b).catalog}`, description: b.tagline ?? undefined,
    openGraph: { title: b.name, description: b.tagline ?? undefined, url: `${appUrl()}/${b.slug}`, images: img ? [`${appUrl()}${img}`] : undefined, type: 'website', locale: 'es_MX' },
  }
}

export default async function PublicCatalogPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ p?: string }> }) {
  const { slug } = await params
  const { p } = await searchParams
  const c = await load(slug)
  if (!c) notFound()
  if (c.suspended) {
    return (
      <div className="screen card"><div className="scroll pad" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div><div className="state-ic"><Icon name="clock" size={34} /></div><div className="hi">{c.name}</div><p className="mut">Esta página no está disponible por el momento.</p></div>
      </div></div>
    )
  }
  // Deep link ?p=: un producto oculto o inexistente devuelve 404
  if (p && !c.products.some((x) => x.id === p)) notFound()
  const b = c.business
  const promos = await asUser(null, async (tx) => (await tx`select public.public_promotions(${slug}) as p`)[0].p)
  return (
    <CatalogClient
      catalog={c} promos={promos} terms={getTerms(b)} orderTypes={b.order_types?.length ? b.order_types : modeDefaults(b).orderTypes}
      status={openStatus(b.schedule)} initialProduct={p ?? null}
    />
  )
}
