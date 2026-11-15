'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { openCashAction, registerSaleAction, saveQuoteAction, type SaleResult } from '@/app/actions/sales'
import type { PubGroup, PubOption, PubProduct } from '@/components/catalog/catalog-client'
import { Icon } from '@/components/icons'
import { DateField, FieldsEditor, PhoneInput, longDate, longTime } from '@/components/inputs'
import { Ticket, type TicketSale, type TicketSettings } from '@/components/ticket/ticket'
import { AppBar, Field, NumPad, Ph, Seg, Sheet, useAction, useIsDesktop, useToast } from '@/components/ui'
import { exportJpg } from '@/lib/export-image'
import { fmtDateTime, folio, qtyLabel, storageUrl, unitSuffix, waLink } from '@/lib/format'
import { ORDER_TYPE_LABELS } from '@/lib/mode-defaults'
import { centsMoney, fromCents, toCents } from '@/lib/money'
import { calcLine, sumLines, type TaxMode } from '@/lib/tax'

interface Line { key: string; product_id: string | null; option_ids: string[]; title: string; unit: number; list?: number; qty: number; saleUnit: string; mode: TaxMode; opts: string[]; notes: string }
type Method = 'cash' | 'card' | 'transfer' | 'mixed'
interface Disc { type: 'amount' | 'pct'; value: string }
const KIND_LABEL = { sale: 'la venta', pre: 'el pedido', quote: 'la cotización' } as const
const KIND_TO = { sale: 'Venta', pre: 'Pedido', quote: 'Cotización' } as const

interface TicketInfo { settings: TicketSettings; business: { name: string; logo: string | null }; qrUrl: string; qrLabel: string; taxRate: number }

const optOut = (p: PubProduct, o: PubOption) => p.track_stock && o.track_stock && Number(o.stock) <= 0

export function Pos({ products, cats, hasSession, rate, orderTypes, mode, cashier, device, searchPh, ticket, autoPrint, appointment, whatsapp, globalMode, fieldSuggestions, canQuote }: {
  products: PubProduct[]; cats: { id: string; name: string }[]; hasSession: boolean; rate: number; orderTypes: string[]; mode: string
  cashier: string; device: string; searchPh: string; ticket: TicketInfo; autoPrint: boolean
  appointment: { id: string; productId: string | null; customer: string } | null; whatsapp: string | null; globalMode: TaxMode; fieldSuggestions: string[]; canQuote: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const { run, busy } = useAction()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [optFor, setOptFor] = useState<PubProduct | null>(null)
  const [qtyFor, setQtyFor] = useState<{ p: PubProduct; option_ids: string[]; opts: string[]; unit: number } | null>(null)
  const [free, setFree] = useState(false)
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState<{ r: SaleResult; sale: TicketSale } | null>(null)
  const [opening, setOpening] = useState('')
  const [preorder, setPreorder] = useState(false)
  const [quote, setQuote] = useState(false)
  const [quoteDone, setQuoteDone] = useState<string | null>(null)
  const [hold, setHold] = useState(false)
  const tkRef = useRef<HTMLDivElement>(null)
  const canPreorder = (mode === 'food' || mode === 'retail') && !appointment
  const showQuote = canQuote && !appointment
  const applyKind = (k: 'sale' | 'pre' | 'quote') => { setPreorder(k === 'pre'); setQuote(k === 'quote'); setQuoteDone(null) }
  const current: 'sale' | 'pre' | 'quote' = preorder ? 'pre' : quote ? 'quote' : 'sale'
  const setKind = (k: 'sale' | 'pre' | 'quote') => {
    if (k === current) return
    if (lines.length > 0 && !done && !quoteDone) return setConfirmLeave({ kind: k })
    clearAll(); applyKind(k)
  }
  const desktop = useIsDesktop()

  const list = useMemo(() => products.filter((p) => (cat === 'all' || p.category_id === cat) && p.name.toLowerCase().includes(q.toLowerCase())), [products, cat, q])
  const [disc, setDisc] = useState<Disc>({ type: 'pct', value: '' })
  const gross = sumLines(lines.map((l) => calcLine(l.unit, l.qty, l.mode, rate)))
  const discWanted = disc.type === 'amount' ? toCents(disc.value) : Math.round(gross.total * Math.min(100, Number(disc.value) || 0) / 100)
  const discCents = Math.max(0, Math.min(discWanted, gross.total))
  const factor = gross.total > 0 ? (gross.total - discCents) / gross.total : 1
  // Descuento general: se reparte en el precio de cada producto (queda como precio especial en el ticket)
  const effLines: Line[] = discCents > 0 ? lines.map((l) => ({ ...l, unit: Math.round(l.unit * factor), list: l.list ?? l.unit })) : lines
  const doc = sumLines(effLines.map((l) => calcLine(l.unit, l.qty, l.mode, rate)))
  const extraDisc = gross.total - doc.total
  const dirty = lines.length > 0 && !done && !quoteDone
  const [confirmLeave, setConfirmLeave] = useState<{ kind?: 'sale' | 'pre' | 'quote'; href?: string } | null>(null)
  const clearAll = () => { setLines([]); setDisc({ type: 'pct', value: '' }); setPaying(false) }

  // Si hay una captura a medias, avisa antes de salir del punto de venta
  useEffect(() => {
    if (!dirty) return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.closest('.cdlg')) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin || url.pathname === location.pathname) return
      e.preventDefault(); e.stopPropagation()
      setConfirmLeave({ href: url.pathname + url.search })
    }
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onUnload)
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('beforeunload', onUnload) }
  }, [dirty])
  const count = lines.reduce((a, l) => a + (l.saleUnit === 'pieza' ? l.qty : 1), 0)
  const qtyOf = (id: string) => lines.filter((l) => l.product_id === id).reduce((a, l) => a + l.qty, 0)

  const push = (l: Line) => setLines((c) => {
    const i = c.findIndex((x) => x.key === l.key)
    if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: +(n[i].qty + l.qty).toFixed(3) }; return n }
    return [...c, l]
  })
  const addProduct = (p: PubProduct, chosen: PubOption[] = [], qty = 1) => {
    const unit = toCents(p.sale_price ?? p.price) + chosen.reduce((a, o) => a + toCents(o.price_delta), 0)
    if (p.sale_unit !== 'pieza' && qty === 1 && !qtyFor) return setQtyFor({ p, option_ids: chosen.map((o) => o.id), opts: chosen.map((o) => o.label), unit })
    push({ key: `${p.id}|${chosen.map((o) => o.id).join(',')}`, product_id: p.id, option_ids: chosen.map((o) => o.id), title: p.name, unit, qty, saleUnit: p.sale_unit, mode: p.tax_mode, opts: chosen.map((o) => o.label), notes: '' })
  }
  const tap = (p: PubProduct) => {
    if (p.sold_out) return toast(`${p.name} está agotado`, true)
    if (p.groups.length) return setOptFor(p)
    addProduct(p)
  }

  // Cita confirmada → abre el POS con el servicio cargado
  useEffect(() => {
    if (!appointment?.productId) return
    const p = products.find((x) => x.id === appointment.productId)
    if (p && !p.groups.length) addProduct(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Regresa sola a una venta nueva en 3 s
  useEffect(() => {
    if (!done || done.sale.preorder || hold) return
    const t = setTimeout(() => newSale(), 3000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, hold])
  const newSale = () => { setHold(false); setDone(null); setQuoteDone(null); setLines([]); setDisc({ type: 'pct', value: '' }); setPaying(false); setPreorder(false); setQuote(false); if (appointment) router.replace('/app/pos'); router.refresh() }

  const modeTabs = (cls: string) => (
          <div className={`pos-mode ${cls}`} role="tablist" aria-label="Tipo de registro">
            <button role="tab" aria-selected={!preorder && !quote} className={!preorder && !quote ? 'on' : ''} onClick={() => setKind('sale')}><Icon name="pos" size={16} /> <span className="pm-l">Nueva venta</span><span className="pm-v">Venta</span></button>
            {canPreorder ? <button role="tab" aria-selected={preorder} className={preorder ? 'on' : ''} onClick={() => setKind('pre')}><Icon name="calendar" size={16} /> Pedido</button> : null}
            {showQuote ? <button role="tab" aria-selected={quote} className={quote ? 'on' : ''} onClick={() => setKind('quote')}><Icon name="doc" size={16} /> <span className="pm-q">Cotización</span><span className="pm-s">Cotizar</span></button> : null}
          </div>
  )

  if (!hasSession) {
    return (
      <>
        <AppBar title="Abrir caja" />
        <div className="scroll pad narrow">
          <div className="vbox"><Icon name="cash" /> Para cobrar necesitas abrir la caja con el fondo inicial.</div>
          <Field label="Fondo inicial en efectivo"><div className="money"><input className="inp" inputMode="decimal" value={opening} placeholder="0.00" onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setOpening(e.target.value)} /></div></Field>
          <div className="rowbtn" style={{ marginBottom: 12 }}>{['0', '200', '500', '1000'].map((v) => <button key={v} className="chip" onClick={() => setOpening(v)}>${v}</button>)}</div>
          <button className="btn" disabled={busy} onClick={async () => { if (await run(openCashAction(opening || '0'), 'Caja abierta')) router.refresh() }}><Icon name="check" /> Abrir caja</button>
        </div>
      </>
    )
  }

  return (
    <>
      <AppBar right={<CashierBadge device={device} cashier={cashier} />}>
        {canPreorder || showQuote ? (
          <>
            {modeTabs('in-bar')}
            <div className="ttl pos-ttl">Punto de venta</div>
          </>
        ) : <div className="ttl">{appointment ? `Cobrar cita · ${appointment.customer}` : 'Nueva venta'}</div>}
      </AppBar>
      {canPreorder || showQuote ? <div className="pos-mode-row">{modeTabs('full')}</div> : null}
      <div className="pos-top">
        <label className="search"><Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPh} style={{ border: 0, outline: 0, flex: 1, minWidth: 0, font: 'inherit', background: 'transparent' }} />
        </label>
        {desktop ? null : (
          <button type="button" className={`pos-cart ${count ? 'has' : ''}`} aria-label={count ? `Ver carrito: ${count} productos, ${centsMoney(doc.total)}` : 'Carrito vacío'}
            onClick={() => (lines.length ? setPaying(true) : toast('Toca un producto para agregarlo'))}>
            <span className="pos-cart-ic"><Icon name="cart" size={20} />{count ? <i key={count}>{count > 99 ? '99+' : count}</i> : null}</span>
            {count ? <b>{centsMoney(doc.total, true)}</b> : null}
          </button>
        )}
      </div>
      <div className="scroll">
        <div className="chips">
          <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>Todos</button>
          {cats.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>)}
        </div>
        <div className="tiles pad">
          {list.map((p) => {
            const n = qtyOf(p.id)
            return (
              <button type="button" key={p.id} className={`tile ${n ? 'sel' : ''} ${p.sold_out ? 'na' : ''}`} onClick={() => tap(p)} style={{ textAlign: 'left', font: 'inherit' }}>
                {n ? <span className="qb">{p.sale_unit === 'pieza' ? n : qtyLabel(n, p.sale_unit)}</span> : null}
                {p.show_in_catalog === false ? <span className="hid" title="Solo en sistema"><Icon name="eyeOff" size={12} /></span> : null}
                <Ph src={storageUrl(p.images[0])} name={p.name} />
                <b>{p.name}</b>
                <span className="pp">{p.sold_out ? 'Agotado' : `${centsMoney(toCents(p.sale_price ?? p.price), true)}${unitSuffix(p.sale_unit)}`}</span>
              </button>
            )
          })}
          <button type="button" className="tile free" onClick={() => setFree(true)} style={{ minHeight: 130 }}><Icon name="plus" size={24} /><b>Monto libre</b></button>
        </div>
      </div>

      {optFor ? <OptionSheet p={optFor} onClose={() => setOptFor(null)} onPick={(chosen) => { const p = optFor; setOptFor(null); addProduct(p, chosen) }} /> : null}
      {qtyFor ? <QtySheet info={qtyFor} onClose={() => setQtyFor(null)} onOk={(qty) => {
        const { p, option_ids, opts, unit } = qtyFor
        push({ key: `${p.id}|${option_ids.join(',')}`, product_id: p.id, option_ids, title: p.name, unit, qty, saleUnit: p.sale_unit, mode: p.tax_mode, opts, notes: '' })
        setQtyFor(null)
      }} /> : null}
      {free ? <FreeSheet onClose={() => setFree(false)} onOk={(title, cents) => { push({ key: `free|${title}|${cents}|${Date.now()}`, product_id: null, option_ids: [], title, unit: cents, qty: 1, saleUnit: 'pieza', mode: globalMode, opts: [], notes: '' }); setFree(false) }} /> : null}

      {desktop && !done && lines.length === 0 ? (
        <aside className="pos-side"><div className="pos-side-h">{preorder ? 'Nuevo pedido' : quote ? 'Nueva cotización' : 'Venta actual'}</div>
          <div className="empty"><Icon name="bag" size={30} /><br />{preorder ? 'Toca los productos del pedido.' : quote ? 'Toca los productos a cotizar.' : 'Toca productos para agregarlos a la venta.'}</div></aside>
      ) : null}
      {quote && ((desktop && lines.length > 0) || (!desktop && paying)) && !quoteDone ? (
        <QuoteSheet inline={desktop} lines={lines} setLines={setLines} doc={doc} rate={rate} onClose={() => setPaying(false)} busy={busy}
          onSave={async (c) => {
            const id = await run(saveQuoteAction({
              client_name: c.name, client_phone: c.phone, client_email: c.email, status: 'pending', valid_days: c.days, prices_plus_tax: false, custom_fields: [], notes: c.notes,
              items: lines.map((l) => ({ product_id: l.product_id, title: l.title, description: [...l.opts, l.notes].filter(Boolean).join(' · ') || undefined,
                unit_price: fromCents(calcLine(l.unit, 1, l.mode, rate).total), qty: String(l.qty), sale_unit: l.saleUnit })),
            }), 'Cotización guardada')
            if (typeof id === 'string') { setQuoteDone(id); setLines([]); setPaying(false) }
          }} />
      ) : null}
      {quoteDone ? (
        <div className="done">
          <div className="ok"><Icon name="doc" size={42} /></div>
          <div className="dt">Cotización guardada</div>
          <div className="mut" style={{ textAlign: 'center', maxWidth: 340 }}>Ábrela para enviarla al cliente, descargarla o convertirla en venta cuando la acepte.</div>
          <Link className="btn" style={{ marginTop: 26 }} href={`/app/cotizaciones/${quoteDone}`}><Icon name="doc" size={16} /> Ver cotización y convertir en venta</Link>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setQuoteDone(null)}>Nueva cotización</button>
        </div>
      ) : null}
      {!quote && ((desktop && lines.length > 0) || (!desktop && paying)) && !done ? (
        <PaySheet key={preorder ? 'pre' : 'sale'} inline={desktop} preorder={preorder} lines={lines} setLines={setLines} doc={doc} rate={rate} disc={disc} setDisc={setDisc} gross={gross.total} extraDisc={extraDisc} orderTypes={orderTypes} mode={mode} busy={busy}
          defaultName={appointment?.customer ?? ''} fieldSuggestions={fieldSuggestions} onClose={() => setPaying(false)}
          onPay={async (p) => {
            const payments = p.payments.map((x) => ({ method: x.method, amount: fromCents(x.amount) }))
            const cashPaid = p.payments.find((x) => x.method === 'cash')?.amount ?? 0
            const r = await run(registerSaleAction({
              items: effLines.map((l) => ({ product_id: l.product_id, option_ids: l.option_ids, title: l.title, unit_price: fromCents(l.unit), qty: String(l.qty), notes: l.notes,
                ...(l.list !== undefined && l.product_id ? { unit_override: fromCents(l.unit) } : {}) })),
              payments, cash_received: cashPaid > 0 ? fromCents(p.received) : null,
              customer_name: p.name || null, order_type: p.orderType as 'mostrador', table_label: p.table || null, appointment_id: appointment?.id ?? null,
              extra: preorder ? { preorder: true, delivery_at: p.deliveryAt, phone: p.phone, notes: p.notes, custom_fields: p.fields } : null,
            }))
            if (!r || r === true) return
            const paid = p.payments.reduce((a, x) => a + x.amount, 0)
            const sale: TicketSale = {
              folio: r.folio, date: new Date().toISOString(), subtotal: r.subtotal, tax: r.tax, total: r.total, payments,
              cash_received: cashPaid > 0 ? fromCents(p.received) : null, change: r.change,
              balance: preorder ? fromCents(toCents(r.total) - paid) : null,
              preorder: preorder ? { customer: p.name, phone: p.phone, deliveryAt: p.deliveryAt, notes: p.notes, fields: p.fields } : null,
              items: effLines.map((l) => ({ title: l.title, qty: l.qty, unit_price: fromCents(l.unit), list_price: l.list !== undefined ? fromCents(l.list) : null,
                line_total: fromCents(calcLine(l.unit, l.qty, l.mode, rate).total), sale_unit: l.saleUnit, opts: l.opts, notes: l.notes })),
            }
            setDone({ r, sale })
            let web = false
            try { web = localStorage.getItem('impresion-web') === '1' } catch { /* */ }
            if (autoPrint && web) setTimeout(() => window.print(), 150)
          }} />
      ) : null}

      {done ? (
        <div className="done">
          <div className="ok"><Icon name="check" size={46} stroke={3} /></div>
          <div className="dt">{done.sale.preorder ? 'Pedido registrado' : 'Venta registrada'}</div>
          <div className="mut">Folio {folio('V', done.r.folio)}</div>
          <div className="damt">{centsMoney(toCents(done.r.total))}</div>
          {done.sale.preorder ? (
            <div className="mut" style={{ textAlign: 'center' }}>
              Entrega: <b>{fmtDateTime(done.sale.preorder.deliveryAt)}</b><br />
              Anticipo {centsMoney(toCents(done.r.total) - toCents(done.sale.balance ?? '0'))} · Resta <b>{centsMoney(toCents(done.sale.balance ?? '0'))}</b>
            </div>
          ) : null}
          {Number(done.r.change) > 0 ? <div style={{ fontWeight: 800 }}>Cambio: {centsMoney(toCents(done.r.change))}</div> : null}
          {done.sale.preorder || hold ? null : <div className="prt"><Icon name="refresh" size={13} /> Nueva venta en 3 s…</div>}
          <div className="rowbtn" style={{ width: '100%', marginTop: 26 }}>
            <button className="btn ghost sm" onClick={() => { setHold(true); window.print() }}><Icon name="printer" size={16} /> Reimprimir</button>
            <button className="btn ghost sm" onClick={() => { setHold(true); if (tkRef.current) exportJpg(tkRef.current, `ticket-${folio('V', done.r.folio)}.jpg`, true).catch(() => toast('No se pudo generar la imagen', true)) }}><Icon name="download" size={16} /> Ticket JPG</button>
            <a className="btn ghost sm" target="_blank" rel="noopener noreferrer" onClick={() => setHold(true)}
              href={waLink(null, `${ticket.business.name}\nFolio ${folio('V', done.r.folio)}\n${done.sale.items.map((i) => `${qtyLabel(i.qty, i.sale_unit)} × ${i.title} — ${centsMoney(toCents(i.line_total), true)}`).join('\n')}\nTotal: ${centsMoney(toCents(done.r.total))}\n¡Gracias por su compra!`)}>
              <Icon name="wa" size={16} /> WhatsApp</a>
          </div>
          {done.sale.preorder ? <Link className="btn ghost" style={{ marginTop: 10 }} href="/app/pedidos?t=pos"><Icon name="calendar" size={16} /> Ver pedidos y pagos</Link> : null}
          <button className="btn" style={{ marginTop: 10 }} onClick={() => { const pre = !!done.sale.preorder; newSale(); if (pre) setPreorder(true) }}>{done.sale.preorder ? 'Nuevo pedido' : 'Nueva venta'}</button>
          <div style={{ position: 'absolute', left: -9999, top: 0 }}>
            <Ticket s={ticket.settings} sale={done.sale} business={ticket.business} cashier={cashier} device={device} qrUrl={ticket.qrUrl} qrLabel={ticket.qrLabel} taxRate={ticket.taxRate} printable />
            <div ref={tkRef} className="tk-export">
              <Ticket s={ticket.settings} sale={done.sale} business={ticket.business} cashier={cashier} device={device} qrUrl={ticket.qrUrl} qrLabel={ticket.qrLabel} taxRate={ticket.taxRate} />
            </div>
          </div>
        </div>
      ) : null}
      {confirmLeave ? (
        <ConfirmLeave
          title={confirmLeave.kind ? `¿Cambiar a ${KIND_TO[confirmLeave.kind]}?` : '¿Salir del punto de venta?'}
          text={`Se borrará ${KIND_LABEL[current]} que llevas.`}
          ok={confirmLeave.kind ? 'Borrar y cambiar' : 'Borrar y salir'}
          onCancel={() => setConfirmLeave(null)}
          onOk={() => { const c = confirmLeave; setConfirmLeave(null); clearAll(); if (c.kind) applyKind(c.kind); else if (c.href) router.push(c.href) }} />
      ) : null}
      {whatsapp ? null : null}
    </>
  )
}

function OptionSheet({ p, onClose, onPick }: { p: PubProduct; onClose: () => void; onPick: (chosen: PubOption[]) => void }) {
  const single = (g: PubGroup) => g.type === 'variant' || /tama|talla|opci/i.test(g.name)
  const [sel, setSel] = useState<Record<string, string[]>>(() => {
    const s: Record<string, string[]> = {}
    for (const g of p.groups) if (single(g)) { const f = g.options.find((o) => !optOut(p, o)); if (f) s[g.id] = [f.id] }
    return s
  })
  const chosen = p.groups.flatMap((g) => g.options.filter((o) => sel[g.id]?.includes(o.id)))
  const unit = toCents(p.sale_price ?? p.price) + chosen.reduce((a, o) => a + toCents(o.price_delta), 0)
  return (
    <Sheet title={p.name} onClose={onClose} top={220}>
      {p.groups.map((g) => (
        <div key={g.id}>
          <div className="opt" style={{ marginTop: 8 }}>{g.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {g.options.map((o) => {
              const out = optOut(p, o)
              return (
                <button key={o.id} disabled={out} className={`chip ${sel[g.id]?.includes(o.id) ? 'on' : ''}`} style={out ? { opacity: 0.4, textDecoration: 'line-through' } : undefined}
                  onClick={() => setSel((s) => { const cur = s[g.id] ?? []; return { ...s, [g.id]: single(g) ? [o.id] : cur.includes(o.id) ? cur.filter((x) => x !== o.id) : [...cur, o.id] } })}>
                  {o.label}{Number(o.price_delta) ? ` +${centsMoney(toCents(o.price_delta), true)}` : ''}{o.track_stock ? ` (${Number(o.stock)})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button className="btn" style={{ marginTop: 18 }} onClick={() => onPick(chosen)}>Agregar · {centsMoney(unit, true)}</button>
    </Sheet>
  )
}

function QtySheet({ info, onClose, onOk }: { info: { p: PubProduct; unit: number }; onClose: () => void; onOk: (qty: number) => void }) {
  const { p, unit } = info
  const weight = p.sale_unit === 'kg' || p.sale_unit === 'g'
  const [by, setBy] = useState<'qty' | 'amount'>('qty')
  const [v, setV] = useState('')
  const qty = by === 'qty' ? Number(v) || 0 : unit > 0 ? +((toCents(v) / unit).toFixed(3)) : 0
  return (
    <Sheet title={p.name} onClose={onClose} top={120}>
      {weight ? <Seg value={by} options={[['qty', `Cantidad (${p.sale_unit})`], ['amount', 'Importe ($)']]} onChange={(x) => { setBy(x); setV('') }} /> : null}
      <div style={{ textAlign: 'center', margin: '14px 0' }}>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{by === 'amount' ? '$' : ''}{v || '0'}{by === 'qty' ? ` ${p.sale_unit === 'l' ? 'L' : p.sale_unit}` : ''}</div>
        <div className="mut">{qtyLabel(qty, p.sale_unit)} × {centsMoney(unit, true)} = <b style={{ color: 'var(--g)' }}>{centsMoney(Math.round(unit * qty))}</b></div>
      </div>
      <NumPad value={v} onChange={setV} decimals={by === 'amount' ? 2 : 3} />
      <button className="btn" style={{ marginTop: 14 }} disabled={qty <= 0} onClick={() => onOk(qty)}>Agregar</button>
    </Sheet>
  )
}

function FreeSheet({ onClose, onOk }: { onClose: () => void; onOk: (title: string, cents: number) => void }) {
  const [title, setTitle] = useState('')
  const [v, setV] = useState('')
  return (
    <Sheet title="Monto libre" onClose={onClose} top={90}>
      <Field label="Concepto"><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Servicio especial" maxLength={80} /></Field>
      <div style={{ textAlign: 'center', fontSize: 34, fontWeight: 800, margin: '4px 0 12px' }}>${v || '0'}</div>
      <NumPad value={v} onChange={setV} decimals={2} />
      <button className="btn" style={{ marginTop: 14 }} disabled={toCents(v) <= 0} onClick={() => onOk(title.trim() || 'Monto libre', toCents(v))}>Agregar</button>
    </Sheet>
  )
}

export interface PayResult {
  payments: { method: 'cash' | 'card' | 'transfer'; amount: number }[]
  received: number; orderType: string; table: string; name: string
  phone: string; deliveryAt: string; notes: string; fields: { label: string; value: string }[]
}

function money2(v: string) { return /^\d*\.?\d{0,2}$/.test(v) }

function PaySheet({ inline, preorder, lines, setLines, doc, rate, disc, setDisc, gross, extraDisc, orderTypes, mode, busy, defaultName, fieldSuggestions, onClose, onPay }: {
  inline?: boolean; preorder: boolean; lines: Line[]; setLines: (f: (c: Line[]) => Line[]) => void; doc: { subtotal: number; iva: number; total: number }; rate: number
  disc: Disc; setDisc: (d: Disc) => void; gross: number; extraDisc: number
  orderTypes: string[]; mode: string; busy: boolean; defaultName: string; fieldSuggestions: string[]
  onClose: () => void; onPay: (p: PayResult) => void
}) {
  const [method, setMethod] = useState<Method>('cash')
  const [recv, setRecv] = useState('')
  const [mix, setMix] = useState({ cash: '', card: '', transfer: '' })
  const [orderType, setOrderType] = useState(orderTypes[0])
  const [table, setTable] = useState('')
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [deliveryAt, setDeliveryAt] = useState('')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState<{ label: string; value: string }[]>([])
  const [advance, setAdvance] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [pstep, setPstep] = useState(0)
  const [sstep, setSstep] = useState(0)
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({})

  // Lo que se cobra ahora: el total de la venta o el anticipo del pedido
  const due = preorder ? Math.min(toCents(advance), doc.total) : doc.total
  const mixSum = toCents(mix.cash) + toCents(mix.card) + toCents(mix.transfer)
  const mixLeft = due - mixSum
  const cashDue = method === 'cash' ? due : 0
  const received = recv === '' ? cashDue : toCents(recv)
  const change = received - cashDue
  const nProducts = lines.reduce((a, l) => a + (l.saleUnit === 'pieza' ? l.qty : 1), 0)
  const discount = lines.reduce((a, l) => a + (l.list !== undefined ? Math.round((l.list - l.unit) * l.qty) : 0), 0)
  const step = (key: string, d: number) => setLines((c) => c.flatMap((l) => { if (l.key !== key) return [l]; const q = +(l.qty + d).toFixed(3); return q > 0 ? [{ ...l, qty: q }] : [] }))
  const note = (key: string, v: string) => setLines((c) => c.map((l) => (l.key === key ? { ...l, notes: v } : l)))
  const applyPrice = (key: string) => {
    const cents = toCents(priceDraft)
    setLines((c) => c.map((l) => {
      if (l.key !== key) return l
      const base = l.list ?? l.unit
      return cents === base ? { ...l, unit: base, list: undefined } : { ...l, unit: cents, list: base }
    }))
    setEditing(null)
  }
  const resetPrice = (key: string) => { setLines((c) => c.map((l) => (l.key === key && l.list !== undefined ? { ...l, unit: l.list, list: undefined } : l))); setEditing(null) }
  useEffect(() => { if (lines.length === 0 && !inline) onClose() }, [lines.length, onClose, inline])

  const minDate = (() => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16) })()
  const dataOk = !preorder || (name.trim().length >= 2 && !!deliveryAt && (phone === '' || phone.length === 10))
  const payOk = due === 0 ? preorder : method === 'mixed' ? mixLeft === 0 && mixSum > 0 : method === 'cash' ? change >= 0 : true
  const ok = dataOk && payOk && (!preorder || toCents(advance) <= doc.total)
  const submit = () => {
    const payments: PayResult['payments'] = due === 0 ? [] : method === 'mixed'
      ? (['cash', 'card', 'transfer'] as const).map((m) => ({ method: m, amount: toCents(mix[m]) })).filter((x) => x.amount > 0)
      : [{ method, amount: due }]
    const cashPaid = payments.find((x) => x.method === 'cash')?.amount ?? 0
    onPay({ payments, received: method === 'cash' ? Math.max(received, cashPaid) : cashPaid, orderType, table, name, phone,
      deliveryAt: deliveryAt ? new Date(deliveryAt).toISOString() : '', notes, fields: fields.filter((f) => f.label.trim()) })
  }
  const fillRest = (k: 'cash' | 'card' | 'transfer') => setMix((m) => ({ ...m, [k]: fromCents(Math.max(0, toCents(m[k]) + (due - (toCents(m.cash) + toCents(m.card) + toCents(m.transfer))))) }))

  const linesJsx = (
    <>
      {lines.map((l) => (
        <div className="citem" key={l.key} style={{ flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>{l.title}</b>
            <small>{[...l.opts, `${centsMoney(l.unit, true)}${unitSuffix(l.saleUnit)}`].join(' · ')}</small>
            <span className="price" style={{ fontSize: 13.5 }}>{centsMoney(calcLine(l.unit, l.qty, l.mode, rate).total)}</span>
            {l.list !== undefined ? <span className="special">Precio especial · antes {centsMoney(l.list, true)}</span> : null}
          </div>
          <button className="ibtn sm" title="Cambiar precio" aria-label={`Cambiar precio de ${l.title}`} onClick={() => { setEditing(l.key); setPriceDraft(fromCents(l.unit)) }}><Icon name="edit" size={14} /></button>
          <div className="stp">
            <button onClick={() => step(l.key, l.saleUnit === 'pieza' ? -1 : -l.qty)} aria-label="Quitar"><Icon name={l.saleUnit === 'pieza' && l.qty > 1 ? 'minus' : 'trash'} size={13} /></button>
            <span>{qtyLabel(l.qty, l.saleUnit)}</span>
            {l.saleUnit === 'pieza' ? <button onClick={() => step(l.key, 1)} aria-label="Más"><Icon name="plus" size={13} /></button> : null}
          </div>
          {editing === l.key ? (
            <div className="price-edit">
              <div className="money" style={{ flex: 1 }}><input className="inp" autoFocus inputMode="decimal" value={priceDraft} aria-label="Precio especial por unidad" onChange={(e) => money2(e.target.value) && setPriceDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyPrice(l.key)} /></div>
              <button className="btn sm" style={{ width: 'auto', padding: '0 14px' }} onClick={() => applyPrice(l.key)}>Aplicar</button>
              {l.list !== undefined ? <button className="btn ghost sm" style={{ width: 'auto', padding: '0 12px' }} onClick={() => resetPrice(l.key)}>Precio normal</button> : null}
            </div>
          ) : null}
          {mode === 'food' && l.product_id ? (l.notes || noteOpen[l.key]
            ? <input className="inp" autoFocus={!l.notes} style={{ height: 36, fontSize: 12.5, flexBasis: '100%' }} placeholder="Nota (sin cebolla, extra caliente…)" value={l.notes} maxLength={120} onChange={(e) => note(l.key, e.target.value)} />
            : <button type="button" className="note-add" onClick={() => setNoteOpen((o) => ({ ...o, [l.key]: true }))}><Icon name="edit" size={13} /> Nota</button>) : null}
        </div>
      ))}

    </>
  )
  const payJsx = (
    <>
      {due > 0 ? (
        <>
          <div className="sec" style={{ marginTop: preorder ? undefined : 10 }}>{preorder ? 'Cómo paga el anticipo' : 'Método de pago'}</div>
          <Seg value={method} options={[['cash', 'Efectivo'], ['card', 'Tarjeta'], ['transfer', 'Transfer.'], ['mixed', 'Mixto']]} onChange={(m) => { setMethod(m); setRecv(''); setMix({ cash: '', card: '', transfer: '' }) }} />
          {method === 'cash' ? (
            <>
              <div className="g2" style={{ marginTop: 12 }}>
                <Field label="Recibido"><div className="money"><input className="inp" inputMode="decimal" value={recv} placeholder={fromCents(cashDue)} onChange={(e) => money2(e.target.value) && setRecv(e.target.value)} /></div></Field>
                <Field label="Cambio"><div className={`inp chg ${change < 0 ? 'neg' : ''}`}>{change < 0 ? `Faltan ${centsMoney(-change)}` : centsMoney(change)}</div></Field>
              </div>
              <div className="rowbtn">
                <button className="chip" onClick={() => setRecv('')}>Exacto</button>
                {[200, 500, 1000].filter((x) => x * 100 >= cashDue).slice(0, 2).map((x) => <button key={x} className="chip" onClick={() => setRecv(String(x))}>${x}</button>)}
              </div>
            </>
          ) : null}
          {method === 'mixed' ? (
            <div className="mix">
              {([['cash', 'Efectivo', 'cash'], ['card', 'Tarjeta', 'card'], ['transfer', 'Transferencia', 'swap']] as const).map(([k, label, icon]) => (
                <div className="mix-row" key={k}>
                  <span className="mix-l"><Icon name={icon} size={16} /> {label}</span>
                  <div className="money" style={{ flex: 1 }}><input className="inp" inputMode="decimal" value={mix[k]} placeholder="0.00" aria-label={label} onChange={(e) => money2(e.target.value) && setMix((m) => ({ ...m, [k]: e.target.value }))} /></div>
                  <button className="chip" disabled={mixLeft <= 0} onClick={() => fillRest(k)}>Resto</button>
                </div>
              ))}
              <div className={`mix-left ${mixLeft === 0 ? 'ok' : mixLeft < 0 ? 'bad' : ''}`}>
                {mixLeft === 0 ? 'Pago completo' : mixLeft > 0 ? `Falta por cubrir: ${centsMoney(mixLeft)}` : `Sobra: ${centsMoney(-mixLeft)}`}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

    </>
  )
  const typeJsx = orderTypes.length > 1 ? (
    <Field label={preorder ? 'Cómo se entrega' : 'Tipo de venta'}>
      <select className="inp" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
        {orderTypes.map((t) => <option key={t} value={t}>{ORDER_TYPE_LABELS[t]}</option>)}
      </select>
    </Field>
  ) : null
  const totalsJsx = (
    <div className="tot" style={{ marginTop: 6 }}>
      <div><span>Subtotal</span><b>{centsMoney(doc.subtotal)}</b></div>
      <div><span>IVA {rate}%</span><b>{centsMoney(doc.iva)}</b></div>
      {discount > 0 ? <div><span>Precio especial</span><b style={{ color: '#C53030' }}>−{centsMoney(discount)}</b></div> : null}
      {extraDisc > 0 ? <div><span>Descuento{disc.type === 'pct' ? ` ${Number(disc.value)}%` : ''}</span><b style={{ color: '#C53030' }}>−{centsMoney(extraDisc)}</b></div> : null}
      <div className="big"><span>Total</span><b>{centsMoney(doc.total)}</b></div>
      {preorder ? <div><span>Anticipo · resta por pagar</span><b>{centsMoney(due)} · {centsMoney(doc.total - due)}</b></div> : null}
    </div>
  )

  // ----- Pedido paso a paso -----
  const phoneOk = phone === '' || phone.length === 10
  const advanceOk = toCents(advance) <= doc.total
  const stepOk = [lines.length > 0, name.trim().length >= 2 && phoneOk, !!deliveryAt, payOk && advanceOk, ok]
  const reach = (i: number) => stepOk.slice(0, i).every(Boolean)
  const methodLabel = due === 0 ? 'Sin anticipo' : method === 'mixed'
    ? (['cash', 'card', 'transfer'] as const).filter((m) => toCents(mix[m]) > 0).map((m) => `${METHOD_LABEL[m]} ${centsMoney(toCents(mix[m]))}`).join(' + ')
    : METHOD_LABEL[method]
  const preHead = (
      <div className="wsteps-wrap">
      <div className="wsteps" role="tablist" aria-label="Pasos del pedido">
        {PRE_STEPS.map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={pstep === i} disabled={!reach(i)}
            className={`wstep ${pstep === i ? 'on' : ''} ${i < pstep && stepOk[i] ? 'wdone' : ''}`} onClick={() => setPstep(i)}>
            <i>{i < pstep && stepOk[i] ? <Icon name="check" size={12} stroke={3} /> : i + 1}</i><span>{t}</span>
          </button>
        ))}
      </div>
      <div className="wstep-t">Paso {pstep + 1} de {PRE_STEPS.length} · <b>{PRE_HINT[pstep]}</b></div>
      </div>
  )
  const preMain = (
    <>
      {pstep === 0 ? (
        <>
          {lines.length ? linesJsx : <div className="empty" style={{ padding: 20 }}>Toca los productos del pedido.</div>}
          {lines.length ? <DiscountBox disc={disc} setDisc={setDisc} gross={gross} applied={extraDisc} /> : null}
          {totalsJsx}
        </>
      ) : null}

      {pstep === 1 ? (
        <>
          <Field label="Nombre del cliente"><input className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej. Ana López" /></Field>
          <Field label="Teléfono (10 dígitos)" hint={phone && phone.length < 10 ? 'Faltan dígitos para completar el número.' : 'Opcional. Sirve para avisarle cuando esté listo.'}>
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
        </>
      ) : null}

      {pstep === 2 ? (
        <>
          <Field label="Día y hora de entrega"><DateField withTime value={deliveryAt} min={minDate} onChange={setDeliveryAt} placeholder="Elegir día y hora" /></Field>
          {typeJsx}
          <Field label="Características"><textarea className="inp" value={notes} maxLength={600} placeholder="Ej. pastel de 3 pisos, decoración en azul, texto: Feliz cumpleaños Ana" onChange={(e) => setNotes(e.target.value)} /></Field>
          <FieldsEditor fields={fields} setFields={setFields} suggestions={fieldSuggestions} />
        </>
      ) : null}

      {pstep === 3 ? (
        <>
          <div className="sec" style={{ marginTop: 4 }}>Anticipo</div>
          <div className="money"><input className="inp" inputMode="decimal" value={advance} placeholder="0.00" onChange={(e) => money2(e.target.value) && setAdvance(e.target.value)} /></div>
          <div className="rowbtn" style={{ marginTop: 8 }}>
            <button className="chip" onClick={() => setAdvance(fromCents(Math.round(doc.total / 2)))}>50%</button>
            <button className="chip" onClick={() => setAdvance(fromCents(doc.total))}>Total</button>
            <button className="chip" onClick={() => setAdvance('')}>Sin anticipo</button>
          </div>
          {!advanceOk ? <div className="hint" style={{ color: '#C53030' }}>El anticipo no puede ser mayor al total.</div> : null}
          {payJsx}
          {totalsJsx}
        </>
      ) : null}

      {pstep === 4 ? (
        <div className="wsum">
          <SumRow label="Productos" onEdit={() => setPstep(0)}>{nProducts} {nProducts === 1 ? 'producto' : 'productos'} · {centsMoney(doc.total)}{discount + extraDisc > 0 ? ` (incluye descuento de ${centsMoney(discount + extraDisc)})` : ''}</SumRow>
          <SumRow label="Cliente" onEdit={() => setPstep(1)}>{name}{phone ? ` · ${phone.replace(/(\d{2,3})(\d{3,4})(\d{4})$/, '$1 $2 $3')}` : ''}</SumRow>
          <SumRow label="Entrega" onEdit={() => setPstep(2)}>{longDate(deliveryAt)} · {longTime(deliveryAt.slice(11, 16))}{orderTypes.length > 1 ? ` · ${ORDER_TYPE_LABELS[orderType]}` : ''}</SumRow>
          {notes || fields.some((f) => f.label.trim()) ? (
            <SumRow label="Características" onEdit={() => setPstep(2)}>
              {notes ? <span style={{ whiteSpace: 'pre-wrap' }}>{notes}</span> : null}
              {fields.filter((f) => f.label.trim()).map((f, i) => <span key={i} style={{ display: 'block' }}>{f.label}: {f.value}</span>)}
            </SumRow>
          ) : null}
          <SumRow label="Anticipo" onEdit={() => setPstep(3)}>{centsMoney(due)} · {methodLabel}<br /><b>Resta por pagar {centsMoney(doc.total - due)}</b></SumRow>
        </div>
      ) : null}
    </>
  )
  const preFoot = (
    <>
        <div className="wfoot-tot">
          <div><small>Total</small><b>{centsMoney(doc.total)}</b></div>
          <div><small>Anticipo</small><b>{centsMoney(due)}</b></div>
          <div><small>Resta</small><b className="rest">{centsMoney(doc.total - due)}</b></div>
        </div>
      <div className="wnav">
        <button type="button" className="btn ghost" disabled={pstep === 0} onClick={() => setPstep(pstep - 1)}><Icon name="back" size={16} /> Atrás</button>
        {pstep < PRE_STEPS.length - 1 ? (
          <button type="button" className="btn" disabled={!stepOk[pstep]} onClick={() => setPstep(pstep + 1)}>Siguiente <Icon name="chevR" size={16} /></button>
        ) : (
          <button type="button" className="btn" disabled={busy || !ok} onClick={submit}><Icon name="check" /> {busy ? 'Registrando…' : 'Registrar pedido'}</button>
        )}
      </div>
      {!stepOk[pstep] && pstep < PRE_STEPS.length - 1 ? <div className="wfoot-why">{STEP_NEED[pstep]}</div> : null}
    </>
  )
  const saleMain = (
    <>
      {linesJsx}
      <DiscountBox disc={disc} setDisc={setDisc} gross={gross} applied={extraDisc} />
      {payJsx}
      <div className="g2" style={{ marginTop: 12 }}>
        {typeJsx}
        {mode === 'food' ? <Field label="Mesa (opcional)"><input className="inp" value={table} onChange={(e) => setTable(e.target.value)} placeholder="Mesa 4" maxLength={40} /></Field> : null}
        <Field label="Cliente (opcional)"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
      </div>
      {totalsJsx}
    </>
  )
  const saleFoot = (
    <>
      <div className="wfoot-tot">
        <div><small>Total</small><b>{centsMoney(doc.total)}</b></div>
        {extraDisc + discount > 0 ? <div><small>Descuento</small><b className="rest">−{centsMoney(extraDisc + discount)}</b></div> : <div />}
        {method === 'cash' && due > 0 ? <div><small>Cambio</small><b>{change < 0 ? '—' : centsMoney(change)}</b></div> : <div />}
      </div>
      <div className="wnav">
        <button type="button" className="btn" disabled={busy || !ok} onClick={submit}>
          <Icon name="check" /> {busy ? 'Registrando…' : `Registrar venta · ${centsMoney(doc.total)}`}
        </button>
      </div>
    </>
  )
  // ----- Cobro paso a paso (celular y tablet): sin desplazar una ventana larga -----
  const saleOk = [lines.length > 0, payOk, ok]
  const sReach = (i: number) => saleOk.slice(0, i).every(Boolean)
  const saleHead = (
    <div className="wsteps-wrap">
      <div className="wsteps" role="tablist" aria-label="Pasos del cobro">
        {SALE_STEPS.map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={sstep === i} disabled={!sReach(i)}
            className={`wstep ${sstep === i ? 'on' : ''} ${i < sstep && saleOk[i] ? 'wdone' : ''}`} onClick={() => setSstep(i)}>
            <i>{i < sstep && saleOk[i] ? <Icon name="check" size={12} stroke={3} /> : i + 1}</i><span>{t}</span>
          </button>
        ))}
      </div>
      <div className="wstep-t">Paso {sstep + 1} de {SALE_STEPS.length} · <b>{SALE_HINT[sstep]}</b></div>
    </div>
  )
  const saleStepsMain = (
    <>
      {sstep === 0 ? (
        <>
          {linesJsx}
          <DiscountBox disc={disc} setDisc={setDisc} gross={gross} applied={extraDisc} />
          {totalsJsx}
        </>
      ) : null}
      {sstep === 1 ? payJsx : null}
      {sstep === 2 ? (
        <>
          <div className="g2">
            {typeJsx}
            {mode === 'food' ? <Field label="Mesa (opcional)"><input className="inp" value={table} onChange={(e) => setTable(e.target.value)} placeholder="Mesa 4" maxLength={40} /></Field> : null}
          </div>
          <Field label="Cliente (opcional)"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          <div className="wsum">
            <SumRow label="Productos" onEdit={() => setSstep(0)}>{nProducts} {nProducts === 1 ? 'producto' : 'productos'} · {centsMoney(doc.total)}{discount + extraDisc > 0 ? ` (incluye descuento de ${centsMoney(discount + extraDisc)})` : ''}</SumRow>
            <SumRow label="Pago" onEdit={() => setSstep(1)}>
              {methodLabel}
              {method === 'cash' ? <><br />Recibido {centsMoney(received)} · <b>Cambio {centsMoney(Math.max(0, change))}</b></> : null}
            </SumRow>
          </div>
        </>
      ) : null}
    </>
  )
  const saleStepsFoot = (
    <>
      <div className="wfoot-tot">
        <div><small>Total</small><b>{centsMoney(doc.total)}</b></div>
        {extraDisc + discount > 0 ? <div><small>Descuento</small><b className="rest">−{centsMoney(extraDisc + discount)}</b></div> : <div />}
        {method === 'cash' && due > 0 && sstep > 0 ? <div><small>Cambio</small><b>{change < 0 ? '—' : centsMoney(change)}</b></div> : <div />}
      </div>
      <div className="wnav">
        <button type="button" className="btn ghost" disabled={sstep === 0} onClick={() => setSstep(sstep - 1)}><Icon name="back" size={16} /> Atrás</button>
        {sstep < SALE_STEPS.length - 1 ? (
          <button type="button" className="btn" disabled={!saleOk[sstep]} onClick={() => setSstep(sstep + 1)}>Siguiente <Icon name="chevR" size={16} /></button>
        ) : (
          <button type="button" className="btn" disabled={busy || !ok} onClick={submit}><Icon name="check" /> {busy ? 'Registrando…' : `Cobrar ${centsMoney(doc.total)}`}</button>
        )}
      </div>
      {!saleOk[sstep] && sstep < SALE_STEPS.length - 1 ? <div className="wfoot-why">{SALE_NEED[sstep]}</div> : null}
    </>
  )
  const stepped = !inline && !preorder
  return (
    <PosPanel inline={inline} title={preorder ? 'Nuevo pedido' : 'Cobrar'} onClose={onClose}
      head={preorder ? preHead : stepped ? saleHead : undefined} foot={preorder ? preFoot : stepped ? saleStepsFoot : saleFoot}>
      {preorder ? preMain : stepped ? saleStepsMain : saleMain}
    </PosPanel>
  )
}

const SALE_STEPS = ['Productos', 'Pago', 'Confirmar']
const SALE_HINT = ['Revisa lo que se cobra', '¿Cómo paga el cliente?', 'Revisa y cobra']
const SALE_NEED = ['Agrega al menos un producto.', 'Completa el pago: en efectivo, lo recibido debe cubrir el total; en mixto, la suma debe ser exacta.']

const PRE_STEPS = ['Productos', 'Cliente', 'Entrega', 'Anticipo', 'Confirmar']
const STEP_NEED = ['Agrega al menos un producto para continuar.', 'Escribe el nombre del cliente (y el teléfono completo si lo capturas).', 'Elige el día y la hora de entrega.', 'Revisa el anticipo y cómo paga.']
const PRE_HINT = ['Revisa lo que lleva el pedido', '¿A nombre de quién?', '¿Cuándo y cómo se entrega?', '¿Cuánto deja hoy?', 'Revisa y registra']
const METHOD_LABEL: Record<'cash' | 'card' | 'transfer', string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }

function SumRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="wsum-r">
      <div><small>{label}</small><div>{children}</div></div>
      <button type="button" className="ibtn sm" onClick={onEdit} aria-label={`Modificar ${label.toLowerCase()}`} title="Modificar"><Icon name="edit" size={14} /></button>
    </div>
  )
}

function QuoteSheet({ inline, lines, setLines, doc, rate, busy, onClose, onSave }: {
  inline?: boolean; lines: Line[]; setLines: (f: (c: Line[]) => Line[]) => void; doc: { subtotal: number; iva: number; total: number }; rate: number; busy: boolean
  onClose: () => void; onSave: (c: { name: string; phone: string; email: string; days: number; notes: string }) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [days, setDays] = useState(15)
  const [notes, setNotes] = useState('')
  useEffect(() => { if (lines.length === 0 && !inline) onClose() }, [lines.length, onClose, inline])
  const step = (key: string, d: number) => setLines((c) => c.flatMap((l) => { if (l.key !== key) return [l]; const q = +(l.qty + d).toFixed(3); return q > 0 ? [{ ...l, qty: q }] : [] }))
  const ok = lines.length > 0 && (phone === '' || phone.length === 10) && (email === '' || /^\S+@\S+\.\S+$/.test(email))
  const body = (
    <>
      {lines.map((l) => (
        <div className="citem" key={l.key}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <b>{l.title}</b>
            <small>{[...l.opts, `${centsMoney(l.unit, true)}${unitSuffix(l.saleUnit)}`].join(' · ')}</small>
            <span className="price" style={{ fontSize: 13.5 }}>{centsMoney(calcLine(l.unit, l.qty, l.mode, rate).total)}</span>
          </div>
          <div className="stp">
            <button onClick={() => step(l.key, l.saleUnit === 'pieza' ? -1 : -l.qty)} aria-label="Quitar"><Icon name={l.saleUnit === 'pieza' && l.qty > 1 ? 'minus' : 'trash'} size={13} /></button>
            <span>{qtyLabel(l.qty, l.saleUnit)}</span>
            {l.saleUnit === 'pieza' ? <button onClick={() => step(l.key, 1)} aria-label="Más"><Icon name="plus" size={13} /></button> : null}
          </div>
        </div>
      ))}
      <div className="sec" style={{ marginTop: 10 }}>Cliente</div>
      <Field label="Nombre (opcional)"><input className="inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ej. Eventos Ana" /></Field>
      <div className="g2">
        <Field label="Teléfono (10 dígitos)"><PhoneInput value={phone} onChange={setPhone} /></Field>
        <Field label="Correo (opcional)"><input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} /></Field>
      </div>
      <Field label="Vigencia">
        <div className="rowbtn">{[7, 15, 30].map((d) => <button key={d} type="button" className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>{d} días</button>)}</div>
      </Field>
      <Field label="Notas (opcional)"><textarea className="inp" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones, tiempos de entrega…" /></Field>
    </>
  )
  const foot = (
    <>
        <div className="wfoot-tot">
          <div><small>Total</small><b>{centsMoney(doc.total)}</b></div>
          <div><small>Subtotal</small><b>{centsMoney(doc.subtotal)}</b></div>
          <div><small>IVA {rate}%</small><b>{centsMoney(doc.iva)}</b></div>
        </div>
        <div className="wnav">
          <button type="button" className="btn" disabled={busy || !ok} onClick={() => onSave({ name: name.trim(), phone, email: email.trim(), days, notes })}>
            <Icon name="check" /> {busy ? 'Guardando…' : 'Guardar cotización'}
          </button>
        </div>
    </>
  )
  return <PosPanel inline={inline} title="Nueva cotización" onClose={onClose} foot={foot}>{body}</PosPanel>
}

function DiscountBox({ disc, setDisc, gross, applied }: { disc: Disc; setDisc: (d: Disc) => void; gross: number; applied: number }) {
  const [open, setOpen] = useState(!!disc.value)
  const over = disc.type === 'amount' ? toCents(disc.value) > gross : Number(disc.value) > 100
  if (!open) return <button type="button" className="addl disc-add" onClick={() => setOpen(true)}><Icon name="percent" size={16} /> Agregar descuento</button>
  return (
    <div className="disc">
      <div className="disc-h">
        <b><Icon name="percent" size={15} /> Descuentos</b>
        <button type="button" className="ibtn sm" aria-label="Quitar descuento" onClick={() => { setDisc({ type: 'pct', value: '' }); setOpen(false) }}><Icon name="x" size={14} /></button>
      </div>
      <div className="disc-row">
        <div className="disc-seg" role="radiogroup" aria-label="Tipo de descuento">
          <button type="button" role="radio" aria-checked={disc.type === 'pct'} className={disc.type === 'pct' ? 'on' : ''} onClick={() => setDisc({ type: 'pct', value: '' })}>%</button>
          <button type="button" role="radio" aria-checked={disc.type === 'amount'} className={disc.type === 'amount' ? 'on' : ''} onClick={() => setDisc({ type: 'amount', value: '' })}>$</button>
        </div>
        <div className={disc.type === 'amount' ? 'money' : 'pctin'} style={{ flex: 1 }}>
          <input className="inp" inputMode="decimal" aria-label={disc.type === 'pct' ? 'Porcentaje de descuento' : 'Monto de descuento'} placeholder={disc.type === 'pct' ? '0' : '0.00'} value={disc.value}
            onChange={(e) => (disc.type === 'pct' ? /^\d{0,3}(\.\d{0,2})?$/ : /^\d*\.?\d{0,2}$/).test(e.target.value) && setDisc({ ...disc, value: e.target.value })} />
        </div>
      </div>
      {disc.type === 'pct' ? (
        <div className="rowbtn" style={{ marginTop: 8 }}>{['5', '10', '15', '20'].map((v) => <button type="button" key={v} className={`chip ${disc.value === v ? 'on' : ''}`} onClick={() => setDisc({ type: 'pct', value: v })}>{v}%</button>)}</div>
      ) : null}
      {over ? <div className="hint" style={{ color: '#C53030' }}>{disc.type === 'pct' ? 'Máximo 100%.' : 'No puede ser mayor al total.'} Se aplica hasta el total.</div>
        : applied > 0 ? <div className="disc-ok">Descuento aplicado: −{centsMoney(applied)}</div> : null}
    </div>
  )
}

function ConfirmLeave({ title, text, ok, onOk, onCancel }: { title: string; text: string; ok: string; onOk: () => void; onCancel: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onCancel])
  return (
    <div className="cdlg-back" onClick={onCancel}>
      <div className="cdlg" role="alertdialog" aria-modal aria-labelledby="cdlg-t" onClick={(e) => e.stopPropagation()}>
        <span className="cdlg-ic"><Icon name="trash" size={22} /></span>
        <b id="cdlg-t">{title}</b>
        <p>{text}</p>
        <div className="cdlg-b">
          <button type="button" className="btn ghost" autoFocus onClick={onCancel}>Seguir aquí</button>
          <button type="button" className="btn red" onClick={onOk}>{ok}</button>
        </div>
      </div>
    </div>
  )
}

function CashierBadge({ device, cashier }: { device: string; cashier: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.cash-who')) setOpen(false) }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('click', close); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('click', close); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="cash-who">
      <button type="button" className="ibtn" aria-label={`Caja: ${device}. Atiende: ${cashier || 'sin nombre'}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="smile" /></button>
      {open ? (
        <div className="cash-pop" role="dialog" aria-label="Caja actual">
          <span className="cash-pop-ic"><Icon name="smile" size={22} /></span>
          <div><small>Atiende</small><b>{cashier || 'Sin nombre'}</b></div>
          <div><small>Caja</small><b>{device}</b></div>
        </div>
      ) : null}
    </div>
  )
}

function PosPanel({ inline, title, head, foot, onClose, children }: { inline?: boolean; title: string; head?: ReactNode; foot?: ReactNode; onClose: () => void; children: ReactNode }) {
  if (inline) {
    return (
      <aside className="pos-side">
        <div className="pos-side-h">{title}</div>
        {head ? <div className="pos-side-head">{head}</div> : null}
        <div className="pos-side-body">{children}</div>
        {foot ? <div className="pos-side-foot wfoot">{foot}</div> : null}
      </aside>
    )
  }
  return <Sheet title={title} onClose={onClose} top={40} head={head} footer={foot} tall>{children}</Sheet>
}
