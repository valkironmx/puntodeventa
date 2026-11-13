'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { convertQuoteAction, duplicateQuoteAction, setQuoteStatusAction, trashQuoteAction } from '@/app/actions/sales'
import { Icon } from '@/components/icons'
import { Field, Seg, Sheet, useAction, useToast } from '@/components/ui'
import { exportJpg } from '@/lib/export-image'
import { folio, initials, qtyLabel } from '@/lib/format'
import { money } from '@/lib/money'
import { QUOTE_ST } from '@/lib/quote-status'

interface Q { id: string; folio: number; status: string; client_name: string | null; client_phone: string | null; client_email: string | null; issued: string; expires: string; valid_days: number; plus: boolean
  custom_fields: { label: string; value: string }[]; notes: string | null; subtotal: string; tax: string; total: string; sale_id: string | null; deleted: boolean }
interface Item { product_id: string | null; title: string; description: string; unit_price: string; qty: string; sale_unit: string; line_total: string }

export function QuoteDetail({ q, items, business, rate, canDelete }: { q: Q; items: Item[]; business: { name: string; logo: string | null; address: string | null; phone: string | null; accent: string }; rate: number; canDelete: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const { run, busy } = useAction()
  const doc = useRef<HTMLDivElement>(null)
  const [conv, setConv] = useState(false)
  const [adv, setAdv] = useState('')
  const [method, setMethod] = useState('cash')
  const editable = !q.deleted && q.status !== 'converted'
  const file = `cotizacion-${folio('COT', q.folio)}.jpg`
  const jpg = (share: boolean) => doc.current && exportJpg(doc.current, file, share).catch(() => toast('No se pudo generar la imagen', true))
  return (
    <>
      <div className="scroll pad narrow">
        {q.status === 'pending' || q.status === 'draft' ? <div className="vbox"><Icon name="clock" size={18} /> Vigente {q.valid_days} días · vence el {q.expires}. Al vencer cambia sola a “Vencida”.</div> : null}
        {q.deleted ? <div className="vbox"><Icon name="trash" size={18} /> En la papelera. Se borra definitivamente a los 30 días.</div> : null}
        <div className="box">
          <div className="kv"><span>Estatus</span><span className={`st ${QUOTE_ST[q.status][0]}`}>{QUOTE_ST[q.status][1]}</span></div>
          <div className="kv"><span>Cliente</span><b>{q.client_name || '—'}</b></div>
          {q.client_phone ? <div className="kv"><span>Teléfono</span><b>{q.client_phone}</b></div> : null}
          {q.client_email ? <div className="kv"><span>Correo</span><b>{q.client_email}</b></div> : null}
          <div className="kv"><span>Fecha</span><b>{q.issued}</b></div>
          {q.custom_fields.map((f, i) => <div className="kv" key={i}><span>{f.label}</span><b>{f.value}</b></div>)}
        </div>
        <div className="box">
          {items.map((it, i) => (
            <div className="qline" key={i}>
              <div className="n"><b>{it.title}{it.product_id ? null : <span className="free">Libre</span>}</b><small>{it.description}</small></div>
              <div className="r">{qtyLabel(it.qty, it.sale_unit)} × {money(it.unit_price)}<br /><b>{money(it.line_total)}</b></div>
            </div>
          ))}
          <div className="kv"><span>Subtotal</span><b>{money(q.subtotal)}</b></div>
          <div className="kv"><span>IVA {rate}%{q.plus ? '' : ' (incluido)'}</span><b>{money(q.tax)}</b></div>
          <div className="kv big"><span>Total</span><b>{money(q.total)}</b></div>
        </div>
        {q.notes ? <div className="box"><b style={{ fontSize: 13 }}>Notas</b><p className="mut" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{q.notes}</p></div> : null}

        {q.status === 'converted' && q.sale_id ? <Link href={`/app/ventas/${q.sale_id}`} className="btn dark"><Icon name="receipt" /> Ver venta y pagos</Link> : null}
        {editable && ['pending', 'accepted', 'draft', 'expired'].includes(q.status) ? <button className="btn" onClick={() => setConv(true)}><Icon name="swap" /> Convertir en venta</button> : null}
        <div className="rowbtn" style={{ marginTop: 10 }}>
          <button className="btn ghost sm" onClick={() => jpg(false)}><Icon name="download" size={16} /> Descargar JPG</button>
          <button className="btn wa sm" onClick={() => jpg(true)}><Icon name="wa" size={16} /> WhatsApp</button>
        </div>
        {editable ? (
          <>
            <div className="sec">Cambiar estatus</div>
            <div className="chips" style={{ padding: 0, flexWrap: 'wrap' }}>
              {(['pending', 'accepted', 'rejected', 'cancelled'] as const).map((s) => <button key={s} disabled={busy} className={`chip ${q.status === s ? 'on' : ''}`} onClick={() => run(setQuoteStatusAction(q.id, s), 'Estatus actualizado')}>{QUOTE_ST[s][1]}</button>)}
            </div>
          </>
        ) : null}
        <div className="danger">
          <button disabled={busy} onClick={async () => { const id = await run(duplicateQuoteAction(q.id), 'Cotización duplicada'); if (id && id !== true) router.push(`/app/cotizaciones/${id}?editar=1`) }}><Icon name="copy" size={15} /> Duplicar</button>
          {editable ? <Link href={`/app/cotizaciones/${q.id}?editar=1`} style={{ flex: 1 }}><button style={{ width: '100%' }}><Icon name="edit" size={15} /> Editar</button></Link> : null}
          {canDelete ? (q.deleted
            ? <button disabled={busy} onClick={() => run(trashQuoteAction(q.id, true), 'Restaurada')}><Icon name="refresh" size={15} /> Restaurar</button>
            : <button className="del" disabled={busy} onClick={async () => { if (confirm('¿Enviar a la papelera? Se conserva 30 días.') && await run(trashQuoteAction(q.id), 'Enviada a la papelera')) router.push('/app/cotizaciones') }}><Icon name="trash" size={15} /> Eliminar</button>) : null}
        </div>

        {/* Render dedicado a exportar como imagen (1080 px) */}
        <div style={{ position: 'absolute', left: -9999, top: 0 }}>
          <div ref={doc} style={{ width: 540, background: '#fff', padding: 34, color: '#16211D' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', borderBottom: `3px solid ${business.accent}`, paddingBottom: 16 }}>
              <div className="logo" style={business.logo ? { background: `#fff url(${business.logo}) center/cover`, boxShadow: 'none' } : { background: business.accent, color: '#fff', boxShadow: 'none' }}>{business.logo ? '' : initials(business.name)}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 20, fontWeight: 800 }}>{business.name}</div><div style={{ fontSize: 11.5, color: '#6B7A74' }}>{[business.address, business.phone].filter(Boolean).join(' · ')}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, fontWeight: 800, color: '#6B7A74', letterSpacing: '.08em' }}>COTIZACIÓN</div><div style={{ fontSize: 18, fontWeight: 800 }}>{folio('COT', q.folio)}</div></div>
            </div>
            <div style={{ margin: '14px 0' }}>
              <div className="kv"><span>Cliente</span><b>{q.client_name || '—'}</b></div>
              <div className="kv"><span>Fecha</span><b>{q.issued}</b></div>
              <div className="kv"><span>Vigencia</span><b>{q.valid_days} días · hasta {q.expires}</b></div>
              {q.custom_fields.map((f, i) => <div className="kv" key={i}><span>{f.label}</span><b>{f.value}</b></div>)}
            </div>
            {items.map((it, i) => (
              <div className="qline" key={i}>
                <div className="n"><b>{it.title}</b><small>{it.description}</small></div>
                <div className="r">{qtyLabel(it.qty, it.sale_unit)} × {money(it.unit_price)}<br /><b>{money(it.line_total)}</b></div>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <div className="kv"><span>Subtotal</span><b>{money(q.subtotal)}</b></div>
              <div className="kv"><span>IVA {rate}%</span><b>{money(q.tax)}</b></div>
              <div className="kv big"><span>Total</span><b style={{ color: business.accent }}>{money(q.total)}</b></div>
            </div>
            {q.notes ? <p style={{ fontSize: 11.5, color: '#6B7A74', whiteSpace: 'pre-wrap' }}>{q.notes}</p> : null}
          </div>
        </div>
      </div>
      {conv ? (
        <Sheet title="Convertir en venta" onClose={() => setConv(false)} top={200}>
          <p className="mut" style={{ marginTop: 0 }}>Se crea la venta por {money(q.total)}, se descuentan existencias y la cotización queda “Convertida”.</p>
          <Field label="Anticipo (opcional)"><div className="money"><input className="inp" inputMode="decimal" value={adv} onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setAdv(e.target.value)} placeholder="0.00" /></div></Field>
          <div className="rowbtn" style={{ marginBottom: 12 }}>
            <button className="chip" onClick={() => setAdv((Number(q.total) / 2).toFixed(2))}>50%</button>
            <button className="chip" onClick={() => setAdv(String(Number(q.total)))}>Total</button>
            <button className="chip" onClick={() => setAdv('')}>Sin anticipo</button>
          </div>
          {Number(adv) > 0 ? <Field label="Método"><Seg value={method} options={[['cash', 'Efectivo'], ['card', 'Tarjeta'], ['transfer', 'Transferencia']]} onChange={setMethod} /></Field> : null}
          <button className="btn" disabled={busy} onClick={async () => { const r = await run(convertQuoteAction(q.id, Number(adv) > 0 ? { amount: adv, method } : null), 'Venta creada'); if (r && r !== true) router.push(`/app/ventas/${r.sale_id}`) }}>Crear venta</button>
        </Sheet>
      ) : null}
    </>
  )
}
