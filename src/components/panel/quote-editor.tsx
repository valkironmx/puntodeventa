'use client'
import { PhoneInput } from '@/components/inputs'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { saveQuoteAction, type QuoteInput } from '@/app/actions/sales'
import { Icon } from '@/components/icons'
import { Field, Seg, Sheet, SwRow, useAction } from '@/components/ui'
import { qtyLabel } from '@/lib/format'
import { centsMoney, toCents } from '@/lib/money'
import { calcLine, sumLines } from '@/lib/tax'

type Item = { product_id: string | null; title: string; description: string; unit_price: string; qty: string; sale_unit: string }
export interface QuoteData { id: string; client_name: string; client_phone: string; client_email: string; status: string; valid_days: number; prices_plus_tax: boolean; custom_fields: { label: string; value: string }[]; notes: string; items: Item[] }

export function QuoteEditor({ quote, products, rate }: { quote: QuoteData | null; products: { id: string; name: string; description: string; price: string; unit: string }[]; rate: number }) {
  const router = useRouter()
  const { run, busy } = useAction()
  const [f, setF] = useState({ client_name: quote?.client_name ?? '', client_phone: quote?.client_phone ?? '', client_email: quote?.client_email ?? '', valid_days: String(quote?.valid_days ?? 15),
    prices_plus_tax: quote?.prices_plus_tax ?? false, notes: quote?.notes ?? '', status: quote && ['draft', 'pending', 'accepted', 'rejected', 'cancelled'].includes(quote.status) ? quote.status : 'pending' })
  const [items, setItems] = useState<Item[]>(quote?.items ?? [])
  const [fields, setFields] = useState(quote?.custom_fields ?? [])
  const [pick, setPick] = useState(false)
  const [q, setQ] = useState('')
  const [free, setFree] = useState<Item | null>(null)
  const mode = f.prices_plus_tax ? 'plus' : 'included'
  const doc = sumLines(items.map((i) => calcLine(toCents(i.unit_price), Number(i.qty) || 0, mode, rate)))
  const upd = (i: number, patch: Partial<Item>) => setItems((a) => a.map((y, j) => (j === i ? { ...y, ...patch } : y)))
  const save = async (status: string) => {
    const payload: QuoteInput = { id: quote?.id, ...f, status: status as 'pending', valid_days: Number(f.valid_days) || 15, custom_fields: fields.filter((x) => x.label.trim()),
      items: items.map((i) => ({ ...i, unit_price: i.unit_price || '0', qty: i.qty || '1' })) }
    const id = await run(saveQuoteAction(payload), 'Cotización guardada')
    if (id && id !== true) router.push(`/app/cotizaciones/${id}`)
  }
  return (
    <>
      <div className="scroll pad">
        <div className="cols"><div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Cliente</div>
        <Field label="Nombre"><input className="inp" value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} maxLength={120} /></Field>
        <div className="g2">
          <Field label="Teléfono (10 dígitos)"><PhoneInput value={f.client_phone} onChange={(v) => setF({ ...f, client_phone: v })} /></Field>
          <Field label="Correo"><input className="inp" type="email" value={f.client_email} onChange={(e) => setF({ ...f, client_email: e.target.value })} /></Field>
        </div>
        <div className="sec">Campos especiales</div>
        {fields.map((x, i) => (
          <div className="cf" key={i}>
            <input className="inp" value={x.label} placeholder="Etiqueta" onChange={(e) => setFields((a) => a.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
            <input className="inp" value={x.value} placeholder="Valor" onChange={(e) => setFields((a) => a.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
            <button type="button" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--mut)' }} onClick={() => setFields((a) => a.filter((_, j) => j !== i))} aria-label="Quitar"><Icon name="x" size={16} /></button>
          </div>
        ))}
        <button type="button" className="addl" style={{ border: 0, background: 'none' }} onClick={() => setFields((a) => [...a, { label: a.length ? '' : 'Lugar de entrega', value: '' }])}><Icon name="plus" size={16} /> Agregar campo</button>

        <div className="g2">
          <Field label="Vigencia (días)"><input className="inp" inputMode="numeric" value={f.valid_days} onChange={(e) => setF({ ...f, valid_days: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></Field>
          <Field label="Estatus"><Seg value={f.status === 'draft' ? 'draft' : 'pending'} options={[['draft', 'Borrador'], ['pending', 'En espera']]} onChange={(v) => setF({ ...f, status: v })} /></Field>
        </div>
        <Field label="Notas"><textarea className="inp" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} /></Field>
        </div><div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Partidas</div>
        <div className="box">
          {items.length === 0 ? <div className="mut">Agrega productos del catálogo o un concepto libre.</div> : null}
          {items.map((it, i) => (
            <div className="qline" key={i} style={{ flexWrap: 'wrap' }}>
              <div className="n"><b>{it.title}{it.product_id ? null : <span className="free">Libre</span>}</b><small>{it.description}</small></div>
              <div className="r"><b>{centsMoney(calcLine(toCents(it.unit_price), Number(it.qty) || 0, mode, rate).total)}</b></div>
              <div style={{ flexBasis: '100%', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="inp" style={{ height: 38, flex: '0 0 30%' }} inputMode="decimal" value={it.qty} aria-label="Cantidad" onChange={(e) => /^\d*\.?\d{0,3}$/.test(e.target.value) && upd(i, { qty: e.target.value })} />
                <span className="mut">{it.sale_unit === 'pieza' ? '×' : `${it.sale_unit} ×`}</span>
                <div className="money" style={{ flex: 1 }}><input className="inp" style={{ height: 38 }} inputMode="decimal" value={it.unit_price} aria-label="Precio unitario" onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && upd(i, { unit_price: e.target.value })} /></div>
                <button type="button" className="ibtn sm" onClick={() => setItems((a) => a.filter((_, j) => j !== i))} aria-label="Quitar partida"><Icon name="trash" size={15} /></button>
              </div>
            </div>
          ))}
          <div className="rowbtn" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={() => setPick(true)}><Icon name="grid" size={15} /> Del catálogo</button>
            <button className="btn ghost sm" onClick={() => setFree({ product_id: null, title: '', description: '', unit_price: '', qty: '1', sale_unit: 'pieza' })}><Icon name="plus" size={15} /> Concepto libre</button>
          </div>
        </div>
        <div className="box">
          <SwRow title="Precios + IVA" hint="Encendido: el IVA se suma a los precios. Apagado: precios con IVA incluido." on={f.prices_plus_tax} onChange={(v) => setF({ ...f, prices_plus_tax: v })} />
          <div className="calc">
            <div><span>Subtotal</span><b>{centsMoney(doc.subtotal)}</b></div>
            <div><span>IVA {rate}%</span><b>{centsMoney(doc.iva)}</b></div>
            <div className="tt"><span>Total</span><b>{centsMoney(doc.total)}</b></div>
          </div>
        </div>
        </div></div>
      </div>
      <div className="sticky"><button className="btn" disabled={busy || items.length === 0} onClick={() => save(f.status)}><Icon name="check" /> Guardar cotización</button></div>

      {pick ? (
        <Sheet title="Agregar del catálogo" onClose={() => setPick(false)}>
          <label className="search" style={{ marginBottom: 12 }}><Icon name="search" size={18} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." style={{ border: 0, outline: 0, flex: 1, font: 'inherit', background: 'transparent' }} /></label>
          {products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).map((p) => (
            <button key={p.id} className="svc" onClick={() => { setItems((a) => [...a, { product_id: p.id, title: p.name, description: p.description.slice(0, 200), unit_price: p.price, qty: '1', sale_unit: p.unit }]); setPick(false); setQ('') }}>
              <span style={{ textAlign: 'left', flex: 1 }}><b>{p.name}</b><small>{centsMoney(toCents(p.price), true)}{p.unit === 'pieza' ? '' : ` / ${qtyLabel(1, p.unit).replace('1 ', '')}`}</small></span>
              <Icon name="plus" size={18} />
            </button>
          ))}
        </Sheet>
      ) : null}
      {free ? (
        <Sheet title="Concepto libre" onClose={() => setFree(null)} top={160}>
          <Field label="Título"><input className="inp" autoFocus value={free.title} onChange={(e) => setFree({ ...free, title: e.target.value })} maxLength={160} /></Field>
          <Field label="Descripción"><textarea className="inp" value={free.description} onChange={(e) => setFree({ ...free, description: e.target.value })} maxLength={400} /></Field>
          <div className="g2">
            <Field label="Precio"><div className="money"><input className="inp" inputMode="decimal" value={free.unit_price} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setFree({ ...free, unit_price: e.target.value })} /></div></Field>
            <Field label="Cantidad"><input className="inp" inputMode="decimal" value={free.qty} onChange={(e) => /^\d*\.?\d{0,3}$/.test(e.target.value) && setFree({ ...free, qty: e.target.value })} /></Field>
          </div>
          <button className="btn" disabled={!free.title.trim() || !(Number(free.unit_price) > 0)} onClick={() => { setItems((a) => [...a, free]); setFree(null) }}>Agregar partida</button>
        </Sheet>
      ) : null}
    </>
  )
}
