'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { deleteProductAction, saveProductAction, type ProductInput } from '@/app/actions/catalog'
import { Icon } from '@/components/icons'
import { Field, Seg, SwRow, useAction, useToast } from '@/components/ui'
import { storageUrl, unitSuffix } from '@/lib/format'
import { uploadImage } from '@/lib/image'
import type { Features } from '@/lib/mode-defaults'
import { centsMoney, toCents } from '@/lib/money'
import { calcLine, effectiveMode, type ProductTaxMode } from '@/lib/tax'
import type { Terms } from '@/lib/terms'

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = ProductInput['groups'][number]
const num = (v: any) => (v === null || v === undefined ? '' : String(Number(v)))

export function ProductForm({ product, cats, terms, features, mode, businessId, units, suggested, tax, canDelete }: {
  product: any; cats: { id: string; name: string }[]; terms: Terms; features: Features; mode: string; businessId: string
  units: string[]; suggested: string[]; tax: { mode: 'included' | 'plus'; rate: number }; canDelete: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const { run, busy } = useAction()
  const fileRef = useRef<HTMLInputElement>(null)
  const p = product
  const [f, setF] = useState({
    name: p?.name ?? '', category_id: p?.category_id ?? '', description: p?.description ?? '', emoji: p?.emoji ?? '',
    kind: (p?.kind ?? (mode === 'service' ? 'service' : 'product')) as 'product' | 'service',
    sale_unit: p?.sale_unit ?? 'pieza', price: num(p?.price), sale_price: num(p?.sale_price),
    price_from: p?.price_from ?? false, duration_min: p?.duration_min ? String(p.duration_min) : mode === 'service' ? '30' : '',
    tax_mode: (p?.tax_mode ?? 'global') as ProductTaxMode,
    track_stock: p ? p.track_stock : features.inventory && mode !== 'service', stock: p ? num(p.stock) : '0',
    show_in_catalog: p?.show_in_catalog ?? true, active: p?.active ?? true, featured: p?.featured ?? false,
  })
  const [images, setImages] = useState<string[]>(p?.images ?? [])
  const [fields, setFields] = useState<{ label: string; value: string }[]>(p?.custom_fields ?? [])
  const [groups, setGroups] = useState<G[]>((p?.groups ?? []).map((g: any) => ({
    id: g.id, name: g.name, type: g.type, options: g.options.map((o: any) => ({ id: o.id, label: o.label, price_delta: num(o.price_delta), track_stock: o.track_stock, stock: num(o.stock), sku: null })),
  })))
  const [uploading, setUploading] = useState(false)
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }))
  const isService = f.kind === 'service'
  const eff = effectiveMode(f.tax_mode, tax.mode)
  const line = calcLine(toCents(f.sale_price || f.price), 1, eff, tax.rate)
  const variantType: 'modifier' | 'variant' = features.variants && !isService ? 'variant' : 'modifier'

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - images.length)
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try { for (const file of files) { const path = await uploadImage(file, 'product', businessId); setImages((x) => [...x, path].slice(0, 3)) } }
    catch (err) { toast(err instanceof Error ? err.message : 'No se pudo subir', true) }
    setUploading(false)
  }
  const move = (i: number, d: number) => setImages((x) => { const n = [...x]; const j = i + d; if (j < 0 || j >= n.length) return x; [n[i], n[j]] = [n[j], n[i]]; return n })
  const setGroup = (gi: number, g: G) => setGroups((x) => x.map((y, i) => (i === gi ? g : y)))

  const save = async () => {
    const payload: ProductInput = {
      id: p?.id, name: f.name, category_id: f.category_id || null, description: f.description || null, emoji: f.emoji || null, kind: f.kind,
      sale_unit: isService ? 'pieza' : f.sale_unit, price: f.price || '0', sale_price: f.sale_price || null, price_from: isService && f.price_from,
      duration_min: isService && f.duration_min ? Number(f.duration_min) : null, tax_mode: f.tax_mode,
      track_stock: !isService && f.track_stock, stock: f.stock || '0', show_in_catalog: f.show_in_catalog, active: f.active, featured: f.featured,
      custom_fields: fields.filter((x) => x.label.trim()), images,
      groups: groups.map((g) => ({ ...g, options: g.options.filter((o) => o.label.trim()).map((o) => ({ ...o, price_delta: o.price_delta || '0', stock: o.stock || '0' })) })),
    }
    if (await run(saveProductAction(payload), 'Guardado')) router.push('/app/catalogo')
  }
  const del = async () => {
    if (!confirm(`¿Eliminar "${f.name}"? Ya no aparecerá en el sistema.`)) return
    if (await run(deleteProductAction(p.id), 'Eliminado')) router.push('/app/catalogo')
  }

  return (
    <>
      <div className="scroll pad">
        <div className="cols"><div className="col">
        <div className="sec" style={{ marginTop: 4 }}>Fotos <small className="mut">{images.length}/3 · la primera es la principal</small></div>
        <div className="slots">
          {[0, 1, 2].map((i) => images[i] ? (
            <div className="slot" key={i} style={{ borderStyle: 'solid' }}>
              <div className="ph"><img src={storageUrl(images[i])!} alt="" /></div>
              {i === 0 ? <span className="pt">Principal</span> : <button type="button" className="pt" style={{ border: 0, cursor: 'pointer' }} onClick={() => move(i, -1)}>← Mover</button>}
              <button type="button" className="rm" style={{ border: 0, cursor: 'pointer' }} onClick={() => setImages((x) => x.filter((_, j) => j !== i))} aria-label="Quitar foto"><Icon name="x" size={12} /></button>
            </div>
          ) : (
            <button type="button" className="slot" key={i} onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Icon name="image" size={22} />{uploading && i === images.length ? 'Subiendo…' : 'Agregar'}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />

        <div style={{ height: 16 }} />
        {mode === 'service' ? <div className="field"><Seg value={f.kind} options={[['service', 'Servicio'], ['product', 'Producto']]} onChange={(v) => set('kind', v)} /></div> : null}
        <Field label="Nombre"><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} /></Field>
        <Field label="Categoría">
          <select className="inp" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">Sin categoría</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Descripción"><textarea className="inp" value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={1000} /></Field>

        <div className="sec">Visibilidad</div>
        <div className="box">
          <SwRow title="Mostrar en el catálogo público" hint="Apagado: solo aparece en punto de venta, cotizaciones y el panel." on={f.show_in_catalog} onChange={(v) => set('show_in_catalog', v)} />
          <SwRow title="Destacado" hint="Aparece primero en la página pública." on={f.featured} onChange={(v) => set('featured', v)} />
          <SwRow title="Activo" hint="Apagado lo desactiva en todo el sistema, sin borrarlo." on={f.active} onChange={(v) => set('active', v)} />
        </div>
        {p && canDelete ? <div className="danger"><button type="button" className="del" onClick={del}><Icon name="trash" size={15} /> Eliminar {terms.item}</button></div> : null}
        </div><div className="col">
        <div className="box">
          {!isService && features.units ? (
            <Field label="Unidad de venta" hint="El precio es por unidad (ej. $18 por m, $380 por kg).">
              <Seg value={f.sale_unit} options={units.map((u) => [u, u === 'l' ? 'L' : u] as [string, string])} onChange={(v) => set('sale_unit', v)} />
            </Field>
          ) : null}
          {isService ? (
            <div className="g2">
              <Field label="Duración (min)"><input className="inp" inputMode="numeric" value={f.duration_min} onChange={(e) => set('duration_min', e.target.value.replace(/\D/g, ''))} /></Field>
              <Field label="Tipo de precio"><Seg value={f.price_from ? 'from' : 'fixed'} options={[['fixed', 'Fijo'], ['from', 'Desde']]} onChange={(v) => set('price_from', v === 'from')} /></Field>
            </div>
          ) : null}
          <div className="g2">
            <Field label={`Precio normal${unitSuffix(isService ? 'pieza' : f.sale_unit)}`}><div className="money"><input className="inp" inputMode="decimal" value={f.price} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && set('price', e.target.value)} /></div></Field>
            <Field label="Precio rebajado"><div className="money"><input className="inp" inputMode="decimal" value={f.sale_price} placeholder="Opcional" onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && set('sale_price', e.target.value)} /></div></Field>
          </div>
          <Field label="IVA">
            <Seg value={f.tax_mode} options={[['global', 'Global'], ['included', 'Incluido'], ['plus', '+ IVA'], ['exempt', 'Exento']]} onChange={(v) => set('tax_mode', v)} />
          </Field>
          <div className="calc">
            <div><span>Subtotal</span><b>{centsMoney(line.base)}</b></div>
            <div><span>IVA {eff === 'exempt' ? '(exento)' : `${tax.rate}%`}</span><b>{centsMoney(line.iva)}</b></div>
            <div className="tt"><span>Precio al público</span><b>{f.price_from && isService ? 'Desde ' : ''}{centsMoney(line.total)}{unitSuffix(isService ? 'pieza' : f.sale_unit)}</b></div>
          </div>
        </div>

        {!isService ? (
          <div className="box">
            <SwRow title="Controlar existencias" hint="Se marca “Agotado” automáticamente al llegar a 0." on={f.track_stock} onChange={(v) => set('track_stock', v)} />
            {f.track_stock && !groups.some((g) => g.options.some((o) => o.track_stock)) ? (
              <Field label={`Existencias (${f.sale_unit})`}><input className="inp" inputMode="decimal" value={f.stock} onChange={(e) => /^\d*\.?\d{0,3}$/.test(e.target.value) && set('stock', e.target.value)} /></Field>
            ) : null}
          </div>
        ) : null}

        <div className="sec">{terms.optionsTitle}</div>
        {groups.map((g, gi) => (
          <div className="box" key={gi}>
            <div className="cf">
              <input className="inp" value={g.name} placeholder="Nombre del grupo" onChange={(e) => setGroup(gi, { ...g, name: e.target.value })} />
              <select className="inp" value={g.type} onChange={(e) => setGroup(gi, { ...g, type: e.target.value as G['type'] })}>
                <option value="modifier">Modificador / extra</option><option value="variant">Variante</option>
              </select>
              <button type="button" className="ibtn" style={{ height: 42, width: 42 }} onClick={() => setGroups((x) => x.filter((_, i) => i !== gi))} aria-label="Quitar grupo"><Icon name="trash" size={16} /></button>
            </div>
            {g.options.map((o, oi) => {
              const setO = (patch: Partial<G['options'][number]>) => setGroup(gi, { ...g, options: g.options.map((y, i) => (i === oi ? { ...y, ...patch } : y)) })
              return (
                <div className="cf" key={oi}>
                  <input className="inp" style={{ flex: '1 1 40%' }} value={o.label} placeholder="Opción" onChange={(e) => setO({ label: e.target.value })} />
                  <input className="inp" style={{ flex: '0 0 26%' }} inputMode="decimal" value={o.price_delta} placeholder="+$" aria-label="Precio extra" onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setO({ price_delta: e.target.value })} />
                  {g.type === 'variant' && f.track_stock ? (
                    <input className="inp" style={{ flex: '0 0 22%' }} inputMode="decimal" value={o.stock} placeholder="Stock" aria-label="Existencias de la variante" onChange={(e) => /^\d*\.?\d{0,3}$/.test(e.target.value) && setO({ stock: e.target.value, track_stock: true })} />
                  ) : null}
                  <button type="button" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--mut)' }} onClick={() => setGroup(gi, { ...g, options: g.options.filter((_, i) => i !== oi) })} aria-label="Quitar opción"><Icon name="x" size={16} /></button>
                </div>
              )
            })}
            <button type="button" className="addl" style={{ border: 0, background: 'none' }} onClick={() => setGroup(gi, { ...g, options: [...g.options, { label: '', price_delta: '', track_stock: g.type === 'variant' && f.track_stock, stock: '0', sku: null }] })}><Icon name="plus" size={16} /> Agregar opción</button>
          </div>
        ))}
        <button type="button" className="addl" style={{ border: 0, background: 'none' }} onClick={() => setGroups((x) => [...x, { name: terms.optionsGroup, type: variantType, options: [{ label: '', price_delta: '', track_stock: variantType === 'variant' && f.track_stock, stock: '0', sku: null }] }])}><Icon name="plus" size={16} /> Agregar grupo de opciones</button>

        <div className="sec">Campos personalizados</div>
        {fields.map((x, i) => (
          <div className="cf" key={i}>
            <input className="inp" value={x.label} placeholder="Etiqueta" list="cf-sug" onChange={(e) => setFields((a) => a.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
            <input className="inp" value={x.value} placeholder="Valor" onChange={(e) => setFields((a) => a.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
            <button type="button" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--mut)' }} onClick={() => setFields((a) => a.filter((_, j) => j !== i))} aria-label="Quitar campo"><Icon name="x" size={16} /></button>
          </div>
        ))}
        <datalist id="cf-sug">{suggested.map((s) => <option key={s} value={s} />)}</datalist>
        <button type="button" className="addl" style={{ border: 0, background: 'none' }} onClick={() => setFields((a) => [...a, { label: suggested[a.length] ?? '', value: '' }])}><Icon name="plus" size={16} /> Agregar campo</button>

        
        </div></div>
      </div>
      <div className="sticky"><button className="btn" disabled={busy || uploading} onClick={save}><Icon name="check" /> Guardar {terms.item}</button></div>
    </>
  )
}
