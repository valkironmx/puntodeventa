'use client'
import { useRef, useState } from 'react'
import { deletePromotionAction, savePromotionAction, togglePromotionAction } from '@/app/actions/business'
import { PromoBanner } from '@/components/catalog/promo-banner'
import { Icon } from '@/components/icons'
import { Field, Sheet, Sw, SwRow, useAction, useToast } from '@/components/ui'
import { storageUrl } from '@/lib/format'
import { uploadImage } from '@/lib/image'

interface Promo { id?: string; title: string; description: string | null; image_path: string | null; button_label: string; product_id: string | null; active: boolean }
const EMPTY: Promo = { title: '', description: '', image_path: null, button_label: 'Agregar', product_id: null, active: true }

export function PromoManager({ promos, products, businessId, canDelete, item }: { promos: Promo[]; products: { id: string; name: string }[]; businessId: string; canDelete: boolean; item: string }) {
  const [ed, setEd] = useState<Promo | null>(null)
  const [up, setUp] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const { run, busy } = useAction()
  const toast = useToast()
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !ed) return
    setUp(true)
    try { const path = await uploadImage(f, 'promo', businessId); setEd((x) => x && { ...x, image_path: path }) }
    catch (err) { toast(err instanceof Error ? err.message : 'No se pudo subir', true) }
    setUp(false)
  }
  return (
    <>
      <p className="mut" style={{ marginTop: 0 }}>Aparecen arriba de tu página pública como banners deslizables. Cada una lleva imagen, título, descripción y un botón que agrega el {item} al pedido. Actívalas o desactívalas cuando quieras.</p>
      {promos.map((p) => (
        <div key={p.id} style={{ marginBottom: 14 }}>
          <PromoBanner title={p.title} description={p.description} image={storageUrl(p.image_path)} button={p.button_label} dim={!p.active} />
          <div className="promo-admin">
            <Sw on={p.active} label="Activa" onChange={(v) => run(togglePromotionAction(p.id!, v), v ? 'Promoción activada' : 'Promoción desactivada')} />
            <span>{p.active ? 'Activa en tu página' : 'Desactivada'}{p.product_id ? ` · ${products.find((x) => x.id === p.product_id)?.name ?? ''}` : ' · sin producto ligado'}</span>
            <button className="ibtn sm" onClick={() => setEd(p)} aria-label="Editar promoción"><Icon name="edit" size={15} /></button>
            {canDelete ? <button className="ibtn sm" style={{ color: '#C53030' }} disabled={busy} onClick={() => confirm(`¿Eliminar la promoción "${p.title}"?`) && run(deletePromotionAction(p.id!), 'Promoción eliminada')} aria-label="Eliminar promoción"><Icon name="trash" size={15} /></button> : null}
          </div>
        </div>
      ))}
      {promos.length === 0 ? <div className="empty">Aún no tienes promociones.</div> : null}
      <button className="btn" onClick={() => setEd({ ...EMPTY })}><Icon name="plus" /> Nueva promoción</button>

      {ed ? (
        <Sheet title={ed.id ? 'Editar promoción' : 'Nueva promoción'} onClose={() => setEd(null)} top={40}>
          <PromoBanner title={ed.title || 'Título de tu promoción'} description={ed.description} image={storageUrl(ed.image_path)} button={ed.button_label} />
          <div className="rowbtn" style={{ margin: '10px 0 14px' }}>
            <button className="btn ghost sm" disabled={up} onClick={() => file.current?.click()}><Icon name="image" size={16} /> {up ? 'Subiendo…' : ed.image_path ? 'Cambiar imagen' : 'Subir imagen'}</button>
            {ed.image_path ? <button className="btn ghost sm" onClick={() => setEd({ ...ed, image_path: null })}>Quitar imagen</button> : null}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
          <Field label="Título"><input className="inp" value={ed.title} maxLength={60} onChange={(e) => setEd({ ...ed, title: e.target.value })} placeholder="Ej. 2×1 en frappés" /></Field>
          <Field label="Descripción"><textarea className="inp" value={ed.description ?? ''} maxLength={160} onChange={(e) => setEd({ ...ed, description: e.target.value })} placeholder="Una línea que antoje." /></Field>
          <Field label={`¿Qué ${item} agrega el botón?`} hint="Si no eliges ninguno, el banner se muestra sin botón.">
            <select className="inp" value={ed.product_id ?? ''} onChange={(e) => setEd({ ...ed, product_id: e.target.value || null })}>
              <option value="">Sin botón</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Texto del botón"><input className="inp" value={ed.button_label} maxLength={28} onChange={(e) => setEd({ ...ed, button_label: e.target.value })} /></Field>
          <SwRow title="Promoción activa" hint="Apagada no se muestra al público." on={ed.active} onChange={(v) => setEd({ ...ed, active: v })} />
          <button className="btn" style={{ marginTop: 12 }} disabled={busy || up} onClick={async () => { if (await run(savePromotionAction({ ...ed, description: ed.description || null }), 'Promoción guardada')) setEd(null) }}><Icon name="check" /> Guardar promoción</button>
        </Sheet>
      ) : null}
    </>
  )
}
