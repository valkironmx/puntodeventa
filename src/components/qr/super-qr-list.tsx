'use client'
import { useState } from 'react'
import { superQrAction, superQrDestinationAction } from '@/app/actions/super'
import { Icon } from '@/components/icons'
import { Field, Seg, Sheet, useAction } from '@/components/ui'
import { QrDownload, QrSvg } from './qr-tools'

interface Row { id: string; code: string; type: string; url: string | null; scans: number; name: string; slug: string }

export function SuperQrList({ rows, base, domain }: { rows: Row[]; base: string; domain: string }) {
  const [q, setQ] = useState('')
  const [dl, setDl] = useState<Row | null>(null)
  const [ed, setEd] = useState<Row | null>(null)
  const [type, setType] = useState('catalog')
  const [url, setUrl] = useState('https://')
  const { run, busy } = useAction()
  const list = rows.filter((r) => (r.name + r.slug + r.code).toLowerCase().includes(q.toLowerCase()))
  const dest = (r: Row) => (r.type === 'catalog' ? `${domain}/${r.slug}` : r.type === 'whatsapp' ? 'WhatsApp del negocio' : r.url)
  return (
    <>
      <label className="search" style={{ marginBottom: 14 }}><Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio o código..." style={{ border: 0, outline: 0, flex: 1, font: 'inherit', background: 'transparent' }} />
      </label>
      {list.map((r) => (
        <div className="qra" key={r.id}>
          <div className="qra-t">
            <div className="qra-q"><QrSvg url={`${base}/q/${r.code}`} px={52} /></div>
            <div style={{ minWidth: 0 }}><b>{r.name}</b><small>{domain}/q/{r.code} · {r.scans} escaneos</small><small className="to">→ {dest(r)}</small></div>
          </div>
          <div className="qra-a">
            <button onClick={() => setDl(r)}><Icon name="download" size={14} /> Descargar</button>
            <button onClick={() => { setEd(r); setType(r.type); setUrl(r.url ?? 'https://') }}><Icon name="edit" size={14} /> Destino</button>
            <button disabled={busy} onClick={() => confirm(`¿Generar un QR nuevo para ${r.name}?\n\nLos QR ya impresos dejarán de funcionar.`) && run(superQrAction(r.id, 'regenerate'), 'QR nuevo generado')}><Icon name="refresh" size={14} /> Nuevo</button>
            <button className="del" disabled={busy} onClick={() => confirm(`¿Borrar el QR de ${r.name}? Dejará de funcionar.`) && run(superQrAction(r.id, 'delete'), 'QR borrado')} aria-label="Borrar"><Icon name="trash" size={14} /></button>
          </div>
        </div>
      ))}
      {list.length === 0 ? <div className="empty">Sin resultados.</div> : null}
      {dl ? <Sheet title={dl.name} onClose={() => setDl(null)}><QrDownload url={`${base}/q/${dl.code}`} name={dl.slug} /></Sheet> : null}
      {ed ? (
        <Sheet title="Destino del QR" onClose={() => setEd(null)} top={260}>
          <Seg value={type} options={[['catalog', 'Catálogo'], ['whatsapp', 'WhatsApp'], ['custom', 'Otro enlace']]} onChange={setType} />
          {type === 'custom' ? <div style={{ marginTop: 12 }}><Field label="Enlace (https://)"><input className="inp" value={url} onChange={(e) => setUrl(e.target.value)} /></Field></div> : null}
          <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={async () => { if (await run(superQrDestinationAction(ed.id, type, type === 'custom' ? url : null), 'Destino actualizado')) setEd(null) }}>Guardar</button>
        </Sheet>
      ) : null}
    </>
  )
}
