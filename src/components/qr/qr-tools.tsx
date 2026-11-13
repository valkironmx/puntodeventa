'use client'
import { useMemo, useState } from 'react'
import { Icon } from '@/components/icons'
import { Seg } from '@/components/ui'
import { nativeSave } from '@/lib/native-save'
import { qrGeometry, qrInlineSvg, qrMatrix, qrRaster, qrSvg, type QrSizeCm } from '@/lib/qr'

async function save(blob: Blob, name: string) {
  if (await nativeSave(blob, name)) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Descarga PNG / SVG / JPG con margen blanco de 3 mm siempre (300 dpi). */
export function downloadQr(url: string, sizeCm: QrSizeCm, format: 'png' | 'svg' | 'jpg', name: string) {
  const m = qrMatrix(url)
  const file = `qr-${name}-${sizeCm}cm.${format}`
  if (format === 'svg') return save(new Blob([qrSvg(m, sizeCm)], { type: 'image/svg+xml' }), file)
  const r = qrRaster(m, sizeCm)
  const c = document.createElement('canvas')
  c.width = r.width; c.height = r.height
  c.getContext('2d')!.putImageData(new ImageData(r.data as Uint8ClampedArray<ArrayBuffer>, r.width, r.height), 0, 0)
  c.toBlob((b) => b && save(b, file), format === 'png' ? 'image/png' : 'image/jpeg', 0.95)
}

export function QrSvg({ url, px }: { url: string; px: number }) {
  const svg = useMemo(() => qrInlineSvg(url, px), [url, px])
  return <span style={{ lineHeight: 0, display: 'inline-block' }} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function QrDownload({ url, name }: { url: string; name: string }) {
  const [size, setSize] = useState<QrSizeCm>(5)
  const g = qrGeometry(size)
  return (
    <>
      <div className="qrbox">
        <div className="qrm"><span className="mm t">3 mm</span><span className="mm l">3 mm</span><QrSvg url={url} px={170} /></div>
      </div>
      <div className="hint" style={{ textAlign: 'center' }}>Margen blanco de protección de 3 mm incluido · {g.totalMm} × {g.totalMm} mm · {g.totalPx} px a 300 dpi</div>
      <div className="sec">Tamaño del QR</div>
      <Seg value={String(size)} options={[['3', '3 cm'], ['5', '5 cm'], ['10', '10 cm']]} onChange={(v) => setSize(Number(v) as QrSizeCm)} />
      <div className="rowbtn" style={{ marginTop: 12 }}>
        {(['png', 'svg', 'jpg'] as const).map((f) => (
          <button key={f} className="btn ghost sm" onClick={() => downloadQr(url, size, f, name)}><Icon name="download" size={15} /> {f.toUpperCase()}</button>
        ))}
      </div>
    </>
  )
}
