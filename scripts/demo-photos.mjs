// Pone fotos de ejemplo (supabase/demo-photos) en productos, banners y portadas SIN imagen. No toca lo que ya tiene foto.
import fs from 'node:fs'
import path from 'node:path'

// palabra clave en el nombre del producto → archivo
const BY_NAME = [
  ['capuchino', 'capuchino'], ['americano', 'americano'], ['latte', 'latte'], ['frapp', 'latte'], ['pastel', 'pastel'], ['dona', 'dona'],
  ['chilaquiles', 'desayuno'], ['molletes', 'desayuno'], ['grano', 'grano'], ['hamburguesa', 'burger'], ['ensalada', 'ensalada'],
  ['tenis', 'tenis'], ['mochila', 'mochila'], ['gorra', 'gorra'], ['termo', 'termo'], ['linterna', 'linterna'],
  ['corte + barba', 'barber4'], ['paquete', 'barber4'], ['corte', 'barber3'], ['afeitado', 'barber1'], ['barba', 'barber1'], ['diseño', 'barber2'], ['color', 'barber2'], ['pomada', 'pomada'],
]
const BANNER = { food: 'cafebanner', retail: 'tenis', service: 'barber4' }
const HERO = { food: 'cafebanner', retail: 'linterna', service: 'barber4' }
const keyFor = (name) => (BY_NAME.find(([k]) => name.toLowerCase().includes(k)) ?? [])[1]

export async function attachDemoPhotos(sql, root, onlyBusinessId = null) {
  const src = path.join(root, 'supabase', 'demo-photos')
  if (!fs.existsSync(src)) return 0
  const put = (bucket, businessId, key) => {
    const from = path.join(src, `${key}.jpg`)
    if (!fs.existsSync(from)) return null
    const rel = path.posix.join(bucket, businessId, `demo-${key}.jpg`)
    const abs = path.join(root, 'storage', rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    if (!fs.existsSync(abs)) fs.copyFileSync(from, abs)
    return rel
  }
  let n = 0
  const businesses = await sql`select id, mode, hero_path from public.businesses where ${onlyBusinessId}::uuid is null or id = ${onlyBusinessId}::uuid`
  for (const b of businesses) {
    const products = await sql`select p.id, p.name from public.products p where p.business_id = ${b.id} and p.deleted_at is null
      and not exists (select 1 from public.product_images i where i.product_id = p.id)`
    for (const p of products) {
      const key = keyFor(p.name)
      const rel = key && put('product-images', b.id, key)
      if (rel) { await sql`insert into public.product_images (business_id, product_id, path, position) values (${b.id}, ${p.id}, ${rel}, 0)`; n++ }
    }
    const promos = await sql`select pr.id, p.name from public.promotions pr left join public.products p on p.id = pr.product_id where pr.business_id = ${b.id} and pr.image_path is null`
    for (const pr of promos) {
      const rel = put('business-assets', b.id, (pr.name && keyFor(pr.name)) || BANNER[b.mode])
      if (rel) { await sql`update public.promotions set image_path = ${rel} where id = ${pr.id}`; n++ }
    }
    if (!b.hero_path) {
      const rel = put('business-assets', b.id, HERO[b.mode])
      if (rel) { await sql`update public.businesses set hero_path = ${rel} where id = ${b.id}`; n++ }
    }
  }
  return n
}

if (process.argv[1] && process.argv[1].endsWith('demo-photos.mjs')) {
  const { default: postgres } = await import('postgres')
  const sql = postgres('postgres://postgres:postgres@127.0.0.1:54329/app', { onnotice: () => {} })
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/%20/g, ' ')), '..')
  console.log('Fotos demo asignadas:', await attachDemoPhotos(sql, root))
  await sql.end()
}
