'use client'
import Link from 'next/link'
import { useState } from 'react'
import { toggleProductAction } from '@/app/actions/catalog'
import { Icon } from '@/components/icons'
import { Ph, Sw, useAction } from '@/components/ui'
import { qtyLabel, storageUrl, unitSuffix } from '@/lib/format'
import { moneyShort } from '@/lib/money'
import type { Terms } from '@/lib/terms'

interface Row { id: string; name: string; emoji: string | null; price: string; sale_price: string | null; unit: string; cat: string | null; track: boolean; stock: string; pub: boolean; active: boolean; img: string | null }

export function CatalogList({ cats, products, terms }: { cats: { id: string; name: string }[]; products: Row[]; terms: Terms }) {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const { run } = useAction()
  const list = products.filter((p) => (cat === 'all' || p.cat === cat) && p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <label className="search"><Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={terms.searchPh} style={{ border: 0, outline: 0, flex: 1, font: 'inherit', background: 'transparent' }} />
      </label>
      <div className="chips" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>Todos</button>
        {cats.map((c) => <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>)}
      </div>
      <div className="list-grid">
      {list.map((p) => (
        <div className="lrow" key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
          <Link href={`/app/catalogo/${p.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Ph src={storageUrl(p.img)} name={p.name} />
            <div className="li">
              <b>{p.name}</b>
              <div className="pr">{moneyShort(p.sale_price ?? p.price)}{unitSuffix(p.unit)}{p.sale_price ? <s>{moneyShort(p.price)}</s> : null}</div>
              <div className="meta">
                {!p.active ? <span className="tagh">Desactivado</span> : null}
                {!p.pub ? <span className="tagh"><Icon name="eyeOff" size={11} /> Solo en sistema</span> : null}
                {p.track ? (Number(p.stock) <= 0 ? <span className="tagx">Agotado</span> : <span>Existencias: {qtyLabel(p.stock, p.unit)}</span>) : null}
              </div>
            </div>
          </Link>
          <div className="pubsw">
            <Sw on={p.pub} label="Mostrar en el catálogo público" onChange={(v) => run(toggleProductAction(p.id, 'show_in_catalog', v), v ? 'Visible al público' : 'Oculto al público')} />
            <small>Público</small>
          </div>
        </div>
      ))}
      </div>
      {list.length === 0 ? <div className="empty">Aún no hay {terms.items}. Toca + para agregar el primero.</div> : null}
    </>
  )
}
