// Compresión en el cliente antes de subir (PLAN §6.4) y color dominante para el acento automático.
export async function compressImage(file: File, maxSide: number, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  const keepAlpha = file.type === 'image/png' && maxSide <= 600
  const type = keepAlpha ? 'image/png' : 'image/webp'
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, quality))
  if (blob && blob.type === type) return blob
  return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', quality))
}

export async function uploadImage(file: File, kind: 'product' | 'logo' | 'hero' | 'promo', businessId: string): Promise<string> {
  const blob = await compressImage(file, kind === 'hero' || kind === 'promo' ? 1800 : kind === 'logo' ? 600 : 1600)
  const fd = new FormData()
  fd.set('file', new File([blob], 'img', { type: blob.type }))
  fd.set('kind', kind)
  fd.set('business_id', businessId)
  const r = await fetch('/api/upload', { method: 'POST', body: fd })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error ?? 'No se pudo subir la imagen')
  return j.path as string
}

/** Color dominante (promedio saturado) de una imagen, para el acento automático */
export async function dominantColor(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = 32; c.height = 32
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, 32, 32)
  const d = ctx.getImageData(0, 0, 32, 32).data
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
    const w = (mx - mn) / 255 + 0.05
    r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w
  }
  // oscurece un poco para que el texto blanco siempre se lea
  const k = 0.78
  const hex = (v: number) => Math.round(Math.min(255, (v / n) * k)).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}
