'use client'
import { useState } from 'react'
import { deleteCategoryAction, moveCategoryAction, saveCategoryAction } from '@/app/actions/catalog'
import { Icon } from '@/components/icons'
import { Sw, useAction } from '@/components/ui'

export function CategoryList({ cats, canDelete, items }: { cats: { id: string; name: string; visible: boolean; n: number }[]; canDelete: boolean; items: string }) {
  const { run, busy } = useAction()
  const [name, setName] = useState('')
  const rename = (c: { id: string; name: string; visible: boolean }) => {
    const n = prompt('Nombre de la categoría', c.name)
    if (n && n.trim()) run(saveCategoryAction({ id: c.id, name: n, visible: c.visible }), 'Guardado')
  }
  return (
    <>
      <div className="cf">
        <input className="inp" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría" maxLength={40} />
        <button className="btn sm" style={{ width: 110 }} disabled={busy || !name.trim()} onClick={async () => { if (await run(saveCategoryAction({ name, visible: true }), 'Categoría agregada')) setName('') }}>Agregar</button>
      </div>
      {cats.map((c, i) => (
        <div className="lrow" key={c.id} style={{ padding: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button disabled={i === 0} onClick={() => run(moveCategoryAction(c.id, -1))} style={{ border: 0, background: 'none', cursor: 'pointer', opacity: i === 0 ? 0.25 : 1 }} aria-label="Subir"><Icon name="back" size={15} style={{ transform: 'rotate(90deg)' }} /></button>
            <button disabled={i === cats.length - 1} onClick={() => run(moveCategoryAction(c.id, 1))} style={{ border: 0, background: 'none', cursor: 'pointer', opacity: i === cats.length - 1 ? 0.25 : 1 }} aria-label="Bajar"><Icon name="back" size={15} style={{ transform: 'rotate(-90deg)' }} /></button>
          </div>
          <div className="li"><b>{c.name}</b><div className="meta">{c.n} {items}{c.visible ? '' : ' · oculta'}</div></div>
          <button className="ibtn sm" onClick={() => rename(c)} aria-label="Renombrar"><Icon name="edit" size={15} /></button>
          {canDelete ? <button className="ibtn sm" style={{ color: '#C53030' }} onClick={() => confirm(`¿Eliminar la categoría "${c.name}"?`) && run(deleteCategoryAction(c.id), 'Eliminada')} aria-label="Eliminar"><Icon name="trash" size={15} /></button> : null}
          <Sw on={c.visible} label="Visible" onChange={(v) => run(saveCategoryAction({ id: c.id, name: c.name, visible: v }))} />
        </div>
      ))}
      {cats.length === 0 ? <div className="empty">Aún no hay categorías.</div> : null}
    </>
  )
}
