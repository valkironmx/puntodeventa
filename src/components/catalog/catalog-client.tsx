'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { requestOrderAction } from '@/app/actions/orders'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/icons'
import { PromoBanner } from './promo-banner'
import { Ph, Seg, Sheet, useToast } from '@/components/ui'
import { initials, qtyLabel, storageUrl, unitSuffix, waLink } from '@/lib/format'
import type { ScheduleRow } from '@/lib/hours'
import { ORDER_TYPE_LABELS } from '@/lib/mode-defaults'
import { centsMoney, toCents } from '@/lib/money'
import { publicPrice, type TaxMode } from '@/lib/tax'
import type { Terms } from '@/lib/terms'

export interface PubOption { id: string; label: string; price_delta: string; track_stock: boolean; stock: string }
export interface PubGroup { id: string; name: string; type: 'modifier' | 'variant'; options: PubOption[] }
export interface PubProduct {
  id: string; category_id: string | null; name: string; description: string | null; emoji: string | null; kind: string
  sale_unit: string; price: string; sale_price: string | null; price_from: boolean; duration_min: number | null
  tax_mode: TaxMode; track_stock: boolean; stock: string; featured: boolean; custom_fields: { label: string; value: string }[]
  images: string[]; groups: PubGroup[]; sold_out: boolean; show_in_catalog?: boolean; active?: boolean
}
export interface PublicCatalog {
  business: {
    id: string; slug: string; name: string; mode: string; tagline: string | null; logo_path: string | null; hero_path: string | null
    hero_focal_x: number; hero_focal_y: number; hero_title: string | null; hero_text: string | null; hero_button: string | null; hero_action: 'catalog' | 'whatsapp' | 'booking' | 'none' | null; hero_links: { show: string[]; custom: { label: string; url: string } | null; call?: boolean } | null; order_types?: string[]; accent_color: string; address: string | null; maps_url: string | null; lat: number | null; lng: number | null
    contact: Record<string, string>; schedule: ScheduleRow[]; tax_rate: string; booking_enabled: boolean
  }
  categories: { id: string; name: string }[]
  products: PubProduct[]
}
export interface Promo { id: string; title: string; description: string | null; image_path: string | null; button_label: string; product_id: string | null }
interface CartItem { key: string; id: string; name: string; emoji: string | null; img: string | null; unit: number; qty: number; saleUnit: string; opts: string[]; notes: string }

const priceOf = (p: PubProduct, rate: number, deltas = 0) => publicPrice(toCents(p.sale_price ?? p.price) + deltas, p.tax_mode, rate)
/** Texto sin acentos ni mayúsculas: "Café" y "cafe" coinciden */
const norm = (t: string | null | undefined) => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const optOut = (p: PubProduct, o: PubOption) => p.track_stock && o.track_stock && Number(o.stock) <= 0

export function CatalogClient({ catalog, promos, terms, orderTypes, status, initialProduct }: {
  catalog: PublicCatalog; promos: Promo[]; terms: Terms; orderTypes: string[]; status: { open: boolean; text: string } | null; initialProduct: string | null
}) {
  const b = catalog.business
  const rate = Number(b.tax_rate)
  const toast = useToast()
  const [cat, setCat] = useState<string>('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(initialProduct)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [slide, setSlide] = useState(0)
  const [promoOpen, setPromoOpen] = useState<string | null>(null)
  const [showNews, setShowNews] = useState(false)
  const [seenNews, setSeenNews] = useState<string[] | null>(null)
  const newsKey = `novedades:${b.slug}`
  useEffect(() => { try { setSeenNews(JSON.parse(localStorage.getItem(newsKey) ?? '[]')) } catch { setSeenNews([]) } }, [newsKey])
  const loaded = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const storeKey = `pedido:${b.slug}`

  useEffect(() => {
    try { const s = localStorage.getItem(storeKey); if (s) setCart(JSON.parse(s)) } catch { /* sin almacenamiento */ }
    loaded.current = true
  }, [storeKey])
  useEffect(() => { if (loaded.current) try { localStorage.setItem(storeKey, JSON.stringify(cart)) } catch { /* */ } }, [cart, storeKey])

  const open = (id: string | null) => {
    setOpenId(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('p', id); else url.searchParams.delete('p')
    window.history.replaceState(null, '', url)
  }

  const list = useMemo(() => {
    const s = norm(q)
    const words = s.split(/\s+/).filter(Boolean)
    return catalog.products.filter((p) => (cat === 'all' || p.category_id === cat) && (!words.length || words.every((w) => norm(p.name).includes(w) || norm(p.description).includes(w))))
  }, [catalog.products, cat, q])
  // Resultados instantáneos del buscador (en todo el catálogo, primero los que empiezan con lo escrito)
  const suggestions = useMemo(() => {
    const s = norm(q)
    if (!s) return []
    const words = s.split(/\s+/)
    return catalog.products
      .map((p) => ({ p, n: norm(p.name), d: norm(p.description) }))
      .filter((x) => words.every((w) => x.n.includes(w) || x.d.includes(w)))
      .sort((a, b) => Number(b.n.startsWith(s)) - Number(a.n.startsWith(s)) || Number(words.every((w) => b.n.includes(w))) - Number(words.every((w) => a.n.includes(w))) || a.n.localeCompare(b.n))
      .slice(0, 6).map((x) => x.p)
  }, [catalog.products, q])
  const [searchOpen, setSearchOpen] = useState(false)
  const featured = cat === 'all' && !q ? list.filter((p) => p.featured) : []
  const rest = featured.length ? list.filter((p) => !p.featured) : list
  const product = openId ? catalog.products.find((p) => p.id === openId) ?? null : null
  const total = cart.reduce((a, i) => a + Math.round(i.unit * i.qty), 0)
  const count = cart.reduce((a, i) => a + (i.saleUnit === 'pieza' ? i.qty : 1), 0)

  const add = (item: CartItem) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.key === item.key)
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: +(n[i].qty + item.qty).toFixed(3) }; return n }
      return [...c, item]
    })
    toast('Agregado a tu pedido')
  }
  const quickAdd = (p: PubProduct) => {
    if (p.groups.length || p.sale_unit !== 'pieza') return open(p.id)
    add({ key: p.id, id: p.id, name: p.name, emoji: p.emoji, img: p.images[0] ?? null, unit: priceOf(p, rate), qty: 1, saleUnit: p.sale_unit, opts: [], notes: '' })
  }
  const share = async () => {
    const url = window.location.origin + '/' + b.slug
    try { if (navigator.share) await navigator.share({ title: b.name, url }); else { await navigator.clipboard.writeText(url); toast('Enlace copiado') } } catch { /* cancelado */ }
  }

  const c = b.contact ?? {}
  const contacts: [string, string, string][] = []
  if (c.whatsapp) contacts.push(['wa', 'WhatsApp', waLink(c.whatsapp)])
  if (c.phone) contacts.push(['phone', 'Llamar', `tel:${c.phone}`])
  if (b.maps_url || b.address) contacts.push(['pin', 'Cómo llegar', b.maps_url || `https://maps.google.com/?q=${encodeURIComponent(b.address ?? '')}`])
  if (c.instagram) contacts.push(['ig', 'Instagram', `https://instagram.com/${c.instagram.replace('@', '')}`])
  if (c.facebook) contacts.push(['share', 'Facebook', c.facebook.startsWith('http') ? c.facebook : `https://facebook.com/${c.facebook}`])
  if (c.tiktok) contacts.push(['share', 'TikTok', `https://tiktok.com/@${c.tiktok.replace('@', '')}`])
  if (c.web) contacts.push(['share', 'Sitio web', c.web.startsWith('http') ? c.web : `https://${c.web}`])

  const card = (p: PubProduct) => {
    const pct = p.sale_price ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0
    return (
      <div className="card" key={p.id} style={p.sold_out ? { opacity: 0.55 } : undefined}>
        <button type="button" onClick={() => open(p.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }} aria-label={`Ver ${p.name}`}>
          {pct > 0 ? <span className="off">-{pct}%</span> : p.featured ? <span className="off feat">Popular</span> : null}
          <Ph src={storageUrl(p.images[0])} name={p.name} />
          <div className="pn">{p.name}</div>
          <div className="pd">{p.description}</div>
        </button>
        <div className="prow">
          <div>
            {p.price_from ? <small className="un pre">Desde</small> : null}
            {p.sale_price ? <span className="strike">{centsMoney(publicPrice(toCents(p.price), p.tax_mode, rate), true)}</span> : null}
            <span className="price">{centsMoney(priceOf(p, rate), true)}</span><small className="un">{unitSuffix(p.sale_unit)}</small>
            {p.duration_min ? <small className="dur"><Icon name="clock" size={11} /> {p.duration_min} min</small> : null}
          </div>
          {p.sold_out ? <span className="tagx">Agotado</span> : (
            <button className="add" onClick={() => quickAdd(p)} aria-label={`Agregar ${p.name}`}><Icon name="plus" size={18} stroke={2.6} /></button>
          )}
        </div>
      </div>
    )
  }

  const hero = storageUrl(b.hero_path), logo = storageUrl(b.logo_path)
  const catImg = (id: string) => storageUrl(catalog.products.find((p) => (id === 'all' || p.category_id === id) && p.images[0])?.images[0])
  const promoCards = promos.map((x) => {
    const prod = x.product_id ? catalog.products.find((p) => p.id === x.product_id) : undefined
    return { id: x.id, title: x.title, desc: x.description, img: storageUrl(x.image_path), label: prod ? (x.button_label || 'Agregar') : null, go: prod && !prod.sold_out ? () => quickAdd(prod) : null, prod }
  })
  const cats = [{ id: 'all', name: 'Todos' }, ...catalog.categories]
  const newsCount = seenNews === null ? 0 : promoCards.filter((x) => !seenNews.includes(x.id)).length
  const openNews = () => {
    setShowNews(true)
    const ids = promoCards.map((x) => x.id)
    setSeenNews(ids)
    try { localStorage.setItem(newsKey, JSON.stringify(ids)) } catch { /* sin almacenamiento */ }
  }
  const wa = c.whatsapp || c.phone
  // Banner principal: nombre, horario y hasta 4 botones de redes elegidos por el negocio
  const ig = (c.instagram ?? '').replace(/^@/, '').trim(), tk = (c.tiktok ?? '').replace(/^@/, '').trim(), fb = (c.facebook ?? '').trim()
  const SOCIAL: Record<string, { icon: string; label: string; href: string | null }> = {
    whatsapp: { icon: 'wa', label: 'WhatsApp', href: c.whatsapp ? waLink(c.whatsapp) : null },
    instagram: { icon: 'ig', label: 'Instagram', href: ig ? (ig.startsWith('http') ? ig : `https://instagram.com/${ig}`) : null },
    facebook: { icon: 'facebook', label: 'Facebook', href: fb ? (fb.startsWith('http') ? fb : `https://facebook.com/${fb}`) : null },
    tiktok: { icon: 'tiktok', label: 'TikTok', href: tk ? (tk.startsWith('http') ? tk : `https://www.tiktok.com/@${tk}`) : null },
  }
  const hl = b.hero_links ?? { show: [], custom: null }
  const heroLinks = (hl.show ?? []).slice(0, 4).map((k) => {
    if (k === 'custom') return hl.custom?.url && /^https:\/\//.test(hl.custom.url) ? { key: k, icon: 'link', label: hl.custom.label || 'Enlace', href: hl.custom.url } : null
    const x = SOCIAL[k]
    return x?.href ? { key: k, ...x } : null
  }).filter((x): x is { key: string; icon: string; label: string; href: string } => !!x)
  // Botón Llamar: viene activado; solo se ve en celular
  const phoneDigits = (c.phone ?? '').replace(/\D/g, '')
  const callHref = hl.call !== false && phoneDigits.length >= 8 ? `tel:${phoneDigits.length === 10 ? '+52' + phoneDigits : phoneDigits}` : null
  const todayHours = (() => {
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', weekday: 'short' }).format(new Date()))
    const r = (b.schedule ?? []).find((x) => x.enabled && x.dow?.includes(wd))
    const h12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}` }
    return r ? `Hoy ${h12(r.open)} – ${h12(r.close)}` : 'Hoy cerrado'
  })()
  const statusChip = status ? <span className="bh-st"><span className="dot" style={status.open ? undefined : { background: '#E5484D' }} /> {status.text}</span> : null
  return (
    <div className="screen pub" style={{ ['--g' as string]: b.accent_color }}>
      <div className="scroll" style={{ paddingBottom: 40 }}>
        {/* Encabezado: logotipo y nombre al centro, campana y carrito con contador, y debajo el buscador con filtros */}
        {/* Encabezado: logotipo (si tiene), buscador, campana y carrito con contador */}
        <header className="ptop">
          {logo ? <img className="plogo" src={logo} alt={b.name} /> : null}
          <div className="psrch">
            <label className="search">
              <Icon name="search" size={18} />
              <input ref={searchRef} value={q} placeholder="Buscar" aria-label="Buscar" autoComplete="off" enterKeyHint="search"
                role="combobox" aria-expanded={searchOpen && !!q.trim()} aria-controls="psug"
                onChange={(e) => { setQ(e.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setSearchOpen(false); e.currentTarget.blur() }
                  if (e.key === 'Enter') { setSearchOpen(false); e.currentTarget.blur(); document.getElementById('todo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
                }}
                style={{ border: 0, outline: 0, flex: 1, font: 'inherit', background: 'transparent', color: 'var(--ink)', minWidth: 0 }} />
              {q ? <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(''); searchRef.current?.focus() }} style={{ border: 0, background: 'none', cursor: 'pointer' }} aria-label="Limpiar"><Icon name="x" size={16} /></button> : null}
            </label>
            {searchOpen && q.trim() ? (
              <div className="psug" id="psug" role="listbox">
                {suggestions.map((p) => (
                  <button key={p.id} type="button" role="option" aria-selected={false} className="psug-i"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSearchOpen(false); searchRef.current?.blur(); open(p.id) }}>
                    <Ph src={storageUrl(p.images[0])} name={p.name} />
                    <span className="psug-t"><b>{p.name}</b><small>{p.sold_out ? 'Agotado' : `${p.price_from ? 'Desde ' : ''}${centsMoney(priceOf(p, rate), true)}${unitSuffix(p.sale_unit)}`}</small></span>
                    <Icon name="chevR" size={16} />
                  </button>
                ))}
                {suggestions.length === 0 ? <div className="psug-none">No encontramos “{q.trim()}”</div> : null}
              </div>
            ) : null}
          </div>
          <button className="pico" onClick={openNews} aria-label={newsCount ? `Novedades: ${newsCount} nuevas` : 'Novedades'}>
            <Icon name="bell" size={22} />{newsCount ? <i>{newsCount}</i> : null}
          </button>
          <button className="pico" onClick={() => setShowCart(true)} aria-label={count ? `Ver mi pedido: ${count} productos` : 'Ver mi pedido'}>
            <Icon name="cart" size={22} />{count ? <i>{count > 99 ? '99+' : count}</i> : null}
          </button>
        </header>

        {/* Banner principal a todo lo ancho: solo imagen de fondo y textos alineados con el contenido */}
        <section className={`bhero ${hero ? 'has-img' : ''}`}>
          {hero ? <img src={hero} alt="" style={{ objectPosition: `${b.hero_focal_x}% ${b.hero_focal_y}%` }} /> : null}
          <div className="bh-in">
            <div className="bh-t">
              {logo ? <img className="bh-logo" src={logo} alt="" /> : null}
              <h1>{b.name}</h1>
              <p className="bh-hours">
                {status ? <><span className="dot" style={status.open ? undefined : { background: '#E5484D' }} /> {status.open ? 'Abierto ahora' : 'Cerrado ahora'} · </> : null}{todayHours}
              </p>
              {heroLinks.length || callHref ? (
                <div className="bh-soc">
                  {callHref ? <a href={callHref} className="bh-call" aria-label="Llamar" title="Llamar"><Icon name="phone" size={20} /></a> : null}
                  {heroLinks.map((x) => (
                    <a key={x.key} href={x.href} target="_blank" rel="noopener noreferrer" aria-label={x.label} title={x.label}><Icon name={x.icon} size={20} /></a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="playout">
          <main className="pwrap">

            {b.booking_enabled ? (
              <Link href={`/${b.slug}/agendar`} className="bookcta">
                <span className="qi"><Icon name="calendar" size={22} /></span>
                <span><b>Agendar cita</b><small>Elige servicio, día y hora</small></span>
                <Icon name="chevR" style={{ marginLeft: 'auto' }} />
              </Link>
            ) : null}

            {promoCards.length ? (
              <>
                <div className="shead"><b>Promociones</b></div>
                <div className="promo-row" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
                  {promoCards.map((x) => <PromoBanner key={x.id} title={x.title} description={x.desc} image={x.img} button={x.label} onClick={x.go} viewLabel="Ver" onOpen={() => setPromoOpen(x.id)} />)}
                </div>
                {promoCards.length > 1 ? <div className="pdots">{promoCards.map((x, i) => <i key={x.id} className={i === slide ? 'on' : ''} />)}</div> : null}
              </>
            ) : null}

            <div className="pcats" id="todo">
              {cats.map((k) => {
                const im = catImg(k.id)
                return (
                  <button key={k.id} className={`pcat ${cat === k.id ? 'on' : ''}`} onClick={() => setCat(k.id)}>
                    <span style={im ? { backgroundImage: `url(${im})` } : undefined}>{im ? null : k.id === 'all' ? <Icon name="grid" size={22} /> : initials(k.name).slice(0, 2)}</span>
                    {k.name}
                  </button>
                )
              })}
            </div>

            {featured.length ? (
              <>
                <div className="shead"><b>{terms.featured}</b></div>
                <div className="pgrid">{featured.map(card)}</div>
                {rest.length ? <div className="shead" style={{ marginTop: 26 }}><b>{terms.catalog}</b></div> : null}
              </>
            ) : <div className="shead"><b>{q ? 'Resultados' : cat === 'all' ? terms.catalog : catalog.categories.find((k) => k.id === cat)?.name}</b></div>}
            <div className="pgrid">{rest.map(card)}</div>
            {list.length === 0 ? <div className="empty">{catalog.products.length === 0 ? `Pronto verás aquí nuestros ${terms.items}.` : `No encontramos ${terms.items} con esa búsqueda.`}</div> : null}

            <footer className="pfoot">
              <div className="pinfo2">
                <div className="pi-head">
                  {logo ? <img src={logo} alt="" /> : null}
                  <div><b>{b.name}</b>{b.tagline ? <span>{b.tagline}</span> : null}</div>
                </div>
                <div className="pi-grid">
                  <div className="pi-col">
                    <h3>Contacto</h3>
                    {([
                      ['pin', 'Dirección', b.address],
                      ['phone', 'Teléfono', c.phone],
                      ['wa', 'WhatsApp', c.whatsapp],
                      ['ig', 'Instagram', c.instagram ? '@' + c.instagram.replace(/^@/, '') : null],
                      ['facebook', 'Facebook', c.facebook],
                      ['tiktok', 'TikTok', c.tiktok ? '@' + c.tiktok.replace(/^@/, '') : null],
                      ['doc', 'Correo', c.email],
                      ['link', 'Sitio web', c.web],
                    ] as [string, string, string | null | undefined][]).filter(([, , v]) => v).map(([ic, label, v]) => (
                      <div className="pi-row" key={label}>
                        <span className="pi-ic"><Icon name={ic} size={18} /></span>
                        <div><small>{label}</small><b>{v}</b></div>
                      </div>
                    ))}
                  </div>
                  {(b.schedule ?? []).length ? (
                    <div className="pi-col">
                      <h3>Horario</h3>
                      {status ? <div className={`pi-status ${status.open ? 'open' : ''}`}><span className="dot" style={status.open ? undefined : { background: '#E5484D' }} /> {status.text}</div> : null}
                      {(b.schedule ?? []).map((r, i) => (
                        <div className="pi-day" key={i}><span>{r.days}</span><b>{r.enabled ? `${r.open} – ${r.close}` : 'Cerrado'}</b></div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <p className="foot">Precios con IVA incluido · <a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a> · <a href={`/soporte?reportar=${b.slug}`}>Reportar esta página</a></p>
            </footer>
          </main>

          {/* PC: el pedido siempre visible a la derecha */}
          <aside className="pside">
            <div className="pside-in">
              <div className="pside-h"><Icon name="bag" size={20} /> Tu pedido{count ? <i>{count}</i> : null}</div>
              <CartSheet inline cart={cart} setCart={setCart} total={total} orderTypes={orderTypes} business={b} terms={terms} onClose={() => {}} />
            </div>
          </aside>
        </div>
      </div>

      {product ? <ProductPop key={product.id} p={product} rate={rate} terms={terms} category={catalog.categories.find((k) => k.id === product.category_id)?.name ?? null}
        mode={b.mode} onClose={() => open(null)} onAdd={(i) => { add(i); open(null) }} /> : null}

      {promoOpen ? (() => {
        const x = promoCards.find((y) => y.id === promoOpen)
        if (!x) return null
        const p = x.prod
        return (
          <div className="popwrap center">
            <div className="pop-scrim" onClick={() => setPromoOpen(null)} />
            <div className="pop promo-pop" role="dialog" aria-modal aria-label={x.title}>
              <button className="pop-x" onClick={() => setPromoOpen(null)} aria-label="Cerrar"><Icon name="x" size={18} /></button>
              <div className="pbody">
                <span className="dcat">Promoción de la semana</span>
                <div className="dname">{x.title}</div>
                {x.desc ? <p className="dtext" style={{ whiteSpace: 'pre-wrap' }}>{x.desc}</p> : null}
                {p ? (
                  <>
                    <div className="opt">Incluye</div>
                    <div className="citem" style={{ marginBottom: 0 }}>
                      <Ph src={storageUrl(p.images[0])} name={p.name} />
                      <div style={{ minWidth: 0 }}>
                        <b>{p.name}</b>
                        {p.description ? <small>{p.description}</small> : null}
                        <span className="price" style={{ fontSize: 14 }}>{p.price_from ? 'Desde ' : ''}{centsMoney(priceOf(p, rate), true)}{unitSuffix(p.sale_unit)}</span>
                        {p.sale_price ? <span className="strike" style={{ display: 'inline', marginLeft: 6 }}>{centsMoney(publicPrice(toCents(p.price), p.tax_mode, rate), true)}</span> : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )
      })() : null}

      {showNews ? (
        <Sheet title="Novedades" onClose={() => setShowNews(false)} compact={promoCards.length === 0}>
          {promoCards.length === 0 ? (
            <div className="cart-empty"><span><Icon name="bell" size={26} /></span><b>Sin novedades por ahora</b><small>Aquí verás las promociones de {b.name}.</small></div>
          ) : promoCards.map((x) => (
            <button key={x.id} className="notif" style={{ width: '100%', border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => { setShowNews(false); setPromoOpen(x.id) }}>
              <span className="ni"><Icon name="tag" size={20} /></span>
              <div className="nb"><small>Promoción</small><b>{x.title}</b>{x.desc ? <p>{x.desc}</p> : null}<span className="lk">Ver promoción <Icon name="chevR" size={12} stroke={2.6} /></span></div>
            </button>
          ))}
        </Sheet>
      ) : null}

      {showCart ? (
        <CartSheet cart={cart} setCart={setCart} total={total} orderTypes={orderTypes} business={b} terms={terms} onClose={() => setShowCart(false)} />
      ) : null}
    </div>
  )
}

function ProductPop({ p, rate, terms, category, mode, onClose, onAdd }: { p: PubProduct; rate: number; terms: Terms; category: string | null; mode: string; onClose: () => void; onAdd: (i: CartItem) => void }) {
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const s: Record<string, string[]> = {}
    for (const g of p.groups) if (g.type === 'variant' || /tama|talla|opci/i.test(g.name)) { const f = g.options.find((o) => !optOut(p, o)); if (f) s[g.id] = [f.id] }
    return s
  })
  const decimal = p.sale_unit !== 'pieza'
  const [qty, setQty] = useState(decimal ? '' : '1')
  const [notes, setNotes] = useState('')
  const [slide, setSlide] = useState(0)
  const single = (g: PubGroup) => g.type === 'variant' || /tama|talla|opci/i.test(g.name)
  const chosen = p.groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)))
  const unit = priceOf(p, rate, chosen.reduce((a, o) => a + toCents(o.price_delta), 0))
  const n = Number(qty) || 0
  const pct = p.sale_price ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0
  const imgs = p.images.length ? p.images : [null]
  const variantStock = chosen.find((o) => o.track_stock)
  const left = p.track_stock ? Number(variantStock ? variantStock.stock : p.stock) : null
  const toggle = (g: PubGroup, o: PubOption) => setSel((s) => {
    const cur = s[g.id] ?? []
    return { ...s, [g.id]: single(g) ? [o.id] : cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id] }
  })
  const missing = p.groups.some((g) => g.type === 'variant' && !(sel[g.id]?.length))
  const can = !p.sold_out && n > 0 && !missing && (left === null || n <= left)
  return (
    <div className="popwrap">
      <div className="pop-scrim" onClick={onClose} />
      <div className="pop" role="dialog" aria-modal aria-label={p.name}>
        <button className="pop-x" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={18} /></button>
        <div className="galw">
          <div className="gal" onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {imgs.map((im, i) => <Ph key={i} src={storageUrl(im)} name={p.name} />)}
          </div>
          {imgs.length > 1 ? <div className="dots">{imgs.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}</div> : null}
        </div>
        <div className="pbody">
          {category ? <span className="dcat">{category}</span> : null}
          <div className="dname">{p.name}</div>
          <div className="dprice">
            <span className="price">{p.price_from ? 'Desde ' : ''}{centsMoney(unit, true)}<small className="un">{unitSuffix(p.sale_unit)}</small></span>
            {p.sale_price ? <><span className="strike">{centsMoney(publicPrice(toCents(p.price), p.tax_mode, rate), true)}</span><span className="save">-{pct}%</span></> : null}
          </div>
          <div className="hint" style={{ marginTop: 0 }}>Precio con IVA incluido{p.duration_min ? ` · ${p.duration_min} min aprox.` : ''}{left !== null && left > 0 && left <= 5 ? ` · Quedan ${qtyLabel(left, p.sale_unit)}` : ''}</div>
          {p.description ? <p className="dtext">{p.description}</p> : null}
          {p.custom_fields?.length ? <div style={{ marginTop: 10 }}>{p.custom_fields.map((f, i) => <div className="kv" key={i}><span>{f.label}</span><b>{f.value}</b></div>)}</div> : null}
          {p.groups.map((g) => (
            <div key={g.id}>
              <div className="opt">{g.name}{g.type === 'variant' ? '' : single(g) ? '' : ' (opcional)'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.options.map((o) => {
                  const out = optOut(p, o)
                  return (
                    <button key={o.id} disabled={out} className={`chip ${sel[g.id]?.includes(o.id) ? 'on' : ''}`} style={out ? { opacity: 0.4, textDecoration: 'line-through' } : undefined} onClick={() => toggle(g, o)}>
                      {o.label}{Number(o.price_delta) ? ` +${centsMoney(toCents(o.price_delta), true)}` : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {mode === 'food' && !p.sold_out ? (
            <input className="inp" style={{ marginTop: 14 }} placeholder="Nota para tu pedido (opcional)" value={notes} maxLength={120} onChange={(e) => setNotes(e.target.value)} />
          ) : null}
          {p.sold_out ? <div className="err" style={{ marginTop: 16, textAlign: 'center' }}>Agotado por ahora</div> : (
            <div className="pact">
              {decimal ? (
                <div style={{ flex: '0 0 42%' }}>
                  <input className="inp" inputMode="decimal" placeholder={`Cantidad (${p.sale_unit === 'l' ? 'L' : p.sale_unit})`} value={qty} aria-label="Cantidad"
                    onChange={(e) => /^\d*\.?\d{0,3}$/.test(e.target.value) && setQty(e.target.value)} />
                </div>
              ) : (
                <div className="stp" style={{ marginLeft: 0 }}>
                  <button onClick={() => setQty(String(Math.max(1, n - 1)))} aria-label="Menos"><Icon name="minus" size={14} /></button>
                  <span>{n}</span>
                  <button onClick={() => setQty(String(n + 1))} aria-label="Más"><Icon name="plus" size={14} /></button>
                </div>
              )}
              <button className="btn" disabled={!can} onClick={() => onAdd({
                key: `${p.id}|${chosen.map((o) => o.id).join(',')}|${notes}`, id: p.id, name: p.name, emoji: p.emoji, img: p.images[0] ?? null,
                unit, qty: n, saleUnit: p.sale_unit, opts: chosen.map((o) => o.label), notes,
              })}>
                {terms.item === 'servicio' ? 'Agregar' : 'Agregar'} · {centsMoney(Math.round(unit * (n || (decimal ? 0 : 1))), true)}
              </button>
            </div>
          )}
          {left !== null && n > left && !p.sold_out ? <div className="hint" style={{ color: '#C53030' }}>Solo quedan {qtyLabel(left, p.sale_unit)}.</div> : null}
        </div>
      </div>
    </div>
  )
}

function CartSheet({ inline, cart, setCart, total, orderTypes, business, terms, onClose }: {
  inline?: boolean; cart: CartItem[]; setCart: (f: (c: CartItem[]) => CartItem[]) => void; total: number; orderTypes: string[]
  business: PublicCatalog['business']; terms: Terms; onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState('')
  const [type, setType] = useState(orderTypes[0])
  const [addr, setAddr] = useState('')
  const [sending, setSending] = useState(false)
  const wa = business.contact?.whatsapp || business.contact?.phone
  const step = (key: string, d: number) => setCart((c) => c.flatMap((i) => {
    if (i.key !== key) return [i]
    const q = +(i.qty + d).toFixed(3)
    return q > 0 ? [{ ...i, qty: q }] : []
  }))
  const needsAddr = type === 'domicilio' || type === 'envio'
  const ready = name.trim().length >= 2 && (!needsAddr || addr.trim().length >= 5)
  const requestLabel = business.mode === 'service' ? 'Solicitar servicio' : 'Solicitar pedido'
  // Texto preconfigurado: "Hola, soy …" y el pedido, sin el nombre del negocio
  const send = () => {
    const lines = [`Hola, soy ${name.trim()}.`, '', 'Mi pedido:']
    for (const i of cart) {
      lines.push(`• ${qtyLabel(i.qty, i.saleUnit)} × ${i.name}${i.opts.length ? ` (${i.opts.join(', ')})` : ''} — ${centsMoney(Math.round(i.unit * i.qty), true)}`)
      if (i.notes) lines.push(`   Nota: ${i.notes}`)
    }
    lines.push('', `Total: ${centsMoney(total)}`, `Entrega: ${ORDER_TYPE_LABELS[type]}`)
    if (needsAddr && addr.trim()) lines.push(`Dirección: ${addr.trim()}`)
    window.open(waLink(wa, lines.join('\n')), '_blank', 'noopener')
  }
  const request = async () => {
    setSending(true)
    const r = await requestOrderAction({ slug: business.slug, name, orderType: type, address: needsAddr ? addr : '',
      items: cart.map((i) => ({ product_id: i.id, qty: i.qty, options: i.opts, notes: i.notes })) })
    if (!r.ok) { setSending(false); toast(r.error, true); return }
    setCart(() => [])
    router.push(`/${business.slug}/pedido/${r.data}`)
  }
  const body = (
    <>
      {cart.length === 0 ? (
        <div className="cart-empty">
          <span><Icon name="bag" size={26} /></span>
          <b>Aún no has agregado nada</b>
          <small>Toca el botón + de un {terms.item} para agregarlo a tu pedido.</small>
          {inline ? null : <button className="btn sm" style={{ marginTop: 14 }} onClick={onClose}>Ver {terms.catalog.toLowerCase()}</button>}
        </div>
      ) : null}
      {cart.map((i) => (
        <div className="citem" key={i.key}>
          <Ph src={storageUrl(i.img)} name={i.name} />
          <div style={{ minWidth: 0 }}>
            <b>{i.name}</b>
            <small>{[...i.opts, i.notes].filter(Boolean).join(' · ') || (i.saleUnit !== 'pieza' ? qtyLabel(i.qty, i.saleUnit) : ' ')}</small>
            <span className="price" style={{ fontSize: 13.5 }}>{centsMoney(Math.round(i.unit * i.qty), true)}</span>
          </div>
          <div className="stp">
            <button onClick={() => step(i.key, i.saleUnit === 'pieza' ? -1 : -i.qty)} aria-label="Quitar"><Icon name={i.saleUnit === 'pieza' && i.qty > 1 ? 'minus' : 'trash'} size={13} /></button>
            <span>{qtyLabel(i.qty, i.saleUnit)}</span>
            {i.saleUnit === 'pieza' ? <button onClick={() => step(i.key, 1)} aria-label="Agregar"><Icon name="plus" size={13} /></button> : null}
          </div>
        </div>
      ))}
      {cart.length ? (
        <>
          {orderTypes.length > 1 ? (
            <>
              <div className="sec">¿Cómo lo quieres?</div>
              <Seg value={type} options={orderTypes.map((t) => [t, ORDER_TYPE_LABELS[t]] as [string, string])} onChange={setType} />
            </>
          ) : <div className="hint" style={{ marginTop: 12 }}>Entrega: <b>{ORDER_TYPE_LABELS[type]}</b></div>}
          <div className="field" style={{ marginTop: 14 }}><label htmlFor={inline ? "cname-i" : "cname"}>Tu nombre</label>
            <input id={inline ? "cname-i" : "cname"} className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="¿A nombre de quién?" maxLength={60} />
          </div>
          {needsAddr ? <div className="field"><label htmlFor={inline ? "caddr-i" : "caddr"}>Dirección de entrega</label><input id={inline ? "caddr-i" : "caddr"} className="inp" value={addr} onChange={(e) => setAddr(e.target.value)} maxLength={160} /></div> : null}
          <div className="tot">
            <div className="big"><span>Total</span><b>{centsMoney(total)}</b></div>
            <div><span>Precios con IVA incluido</span></div>
          </div>
          <button className="btn" style={{ marginTop: 12 }} disabled={!ready || sending} onClick={request}><Icon name="check" size={19} /> {sending ? 'Enviando…' : requestLabel}</button>
          {wa ? <button className="btn wa" style={{ marginTop: 10 }} disabled={!ready} onClick={send}><Icon name="wa" size={19} /> Enviar por WhatsApp</button> : null}
          {!ready ? <div className="hint">{name.trim().length < 2 ? 'Escribe tu nombre para enviar tu pedido.' : 'Escribe la dirección de entrega.'}</div> : null}
        </>
      ) : null}
    </>
  )
  return inline ? body : <Sheet title="Mi pedido" onClose={onClose} compact={cart.length === 0}>{body}</Sheet>
}
