'use client'
import { useState } from 'react'
import { saveCustomFieldLabelsAction, saveTaxAction } from '@/app/actions/business'
import { Icon } from '@/components/icons'
import { Field, Seg, useAction } from '@/components/ui'
import { centsMoney } from '@/lib/money'
import { calcLine } from '@/lib/tax'

export function TaxForm({ mode, rate }: { mode: 'included' | 'plus'; rate: number }) {
  const [m, setM] = useState(mode)
  const [r, setR] = useState(String(rate))
  const { run, busy } = useAction()
  const ex = calcLine(10000, 1, m, Number(r))
  return (
    <>
      <Field label="Los precios que capturas…" hint="Cada producto puede usar este modo global o definir el suyo (Incluido, + IVA o Exento).">
        <Seg value={m} options={[['included', 'Ya incluyen IVA'], ['plus', 'Son + IVA']]} onChange={setM} />
      </Field>
      <Field label="Tasa de IVA"><Seg value={r} options={[['16', '16%'], ['8', '8% (frontera)'], ['0', '0%']]} onChange={setR} /></Field>
      <div className="calc" style={{ marginBottom: 16 }}>
        <div><span>Ejemplo: precio capturado</span><b>$100.00</b></div>
        <div><span>Subtotal</span><b>{centsMoney(ex.base)}</b></div><div><span>IVA {r}%</span><b>{centsMoney(ex.iva)}</b></div>
        <div className="tt"><span>Precio al público</span><b>{centsMoney(ex.total)}</b></div>
      </div>
      <button className="btn" disabled={busy} onClick={() => run(saveTaxAction(m, Number(r)), 'Impuestos guardados')}><Icon name="check" /> Guardar</button>
    </>
  )
}

export function FieldLabelsForm({ labels, item }: { labels: string[]; item: string }) {
  const [l, setL] = useState(labels)
  const { run, busy } = useAction()
  return (
    <>
      <p className="mut" style={{ marginTop: 0 }}>Etiquetas que se sugieren al agregar campos a un {item} (ej. “Preparación: 5 min”).</p>
      {l.map((x, i) => (
        <div className="cf" key={i}>
          <input className="inp" style={{ flex: 1 }} value={x} onChange={(e) => setL((a) => a.map((y, j) => (j === i ? e.target.value : y)))} maxLength={40} />
          <button className="ibtn" style={{ height: 42, width: 42 }} onClick={() => setL((a) => a.filter((_, j) => j !== i))} aria-label="Quitar"><Icon name="trash" size={16} /></button>
        </div>
      ))}
      <button className="addl" style={{ border: 0, background: 'none' }} onClick={() => setL((a) => [...a, ''])}><Icon name="plus" size={16} /> Agregar etiqueta</button>
      <button className="btn" style={{ marginTop: 12 }} disabled={busy} onClick={() => run(saveCustomFieldLabelsAction(l.filter((x) => x.trim())), 'Guardado')}><Icon name="check" /> Guardar</button>
    </>
  )
}
