'use client'
import { useState } from 'react'
import { setQrDestinationAction } from '@/app/actions/business'
import { Icon } from '@/components/icons'
import { Field, Seg, useAction } from '@/components/ui'
import { QrDownload } from './qr-tools'

export function QrPanel({ qr, base, domain, slug, hasWhatsapp, catalogWord }: {
  qr: { id: string; code: string; type: string; url: string | null; scans: number }; base: string; domain: string; slug: string; hasWhatsapp: boolean; catalogWord: string
}) {
  const [type, setType] = useState(qr.type)
  const [url, setUrl] = useState(qr.url ?? 'https://')
  const { run, busy } = useAction()
  const dirty = type !== qr.type || (type === 'custom' && url !== qr.url)
  return (
    <>
      <QrDownload url={`${base}/q/${qr.code}`} name={slug} />
      <div className="box" style={{ marginTop: 16 }}>
        <div className="kv"><span>Enlace impreso</span><b>{domain}/q/{qr.code}</b></div>
        <div className="kv"><span>Escaneos</span><b>{qr.scans}</b></div>
      </div>
      <div className="sec">¿A dónde lleva tu QR?</div>
      <Seg value={type} options={[['catalog', `Mi ${catalogWord.split(' ')[0]}`], ['whatsapp', 'WhatsApp'], ['custom', 'Otro enlace']]} onChange={setType} />
      {type === 'custom' ? <div style={{ marginTop: 12 }}><Field label="Enlace (https://)"><input className="inp" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" /></Field></div> : null}
      {type === 'whatsapp' && !hasWhatsapp ? <div className="vbox" style={{ marginTop: 12 }}>Agrega tu WhatsApp en Personalizar para usar este destino.</div> : null}
      <div className="hint">Es dinámico: puedes cambiar el destino cuando quieras sin volver a imprimir. El código nunca cambia.</div>
      {dirty ? <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={() => run(setQrDestinationAction(qr.id, type, type === 'custom' ? url : null), 'Destino actualizado')}><Icon name="check" /> Guardar destino</button> : null}
    </>
  )
}
