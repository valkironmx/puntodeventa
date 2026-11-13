// QR con margen blanco de protección de 3 mm SIEMPRE (PLAN §8.5).
import QRCode from 'qrcode'

export const MARGIN_MM = 3
export type QrSizeCm = 3 | 5 | 10
export interface QrMatrix { size: number; get: (x: number, y: number) => boolean }

/** Matriz con corrección M y margen 0 (el margen lo añadimos nosotros). */
export function qrMatrix(text: string): QrMatrix {
  const q = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const size = q.modules.size
  const data = q.modules.data
  return { size, get: (x, y) => !!data[y * size + x] }
}

export const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi)

/** Lado total = S×10 + 6 mm (3 mm por lado). */
export function qrGeometry(sizeCm: QrSizeCm, dpi = 300) {
  const qrMm = sizeCm * 10
  const totalMm = qrMm + MARGIN_MM * 2
  const marginPx = mmToPx(MARGIN_MM, dpi)
  const qrPx = mmToPx(qrMm, dpi)
  return { qrMm, totalMm, marginPx, qrPx, totalPx: qrPx + marginPx * 2 }
}

/** SVG en mm, viewBox con el margen incluido y fondo blanco explícito. */
export function qrSvg(m: QrMatrix, sizeCm: QrSizeCm): string {
  const { qrMm, totalMm } = qrGeometry(sizeCm)
  const mod = qrMm / m.size
  let d = ''
  for (let y = 0; y < m.size; y++)
    for (let x = 0; x < m.size; x++)
      if (m.get(x, y)) d += `M${+(MARGIN_MM + x * mod).toFixed(4)} ${+(MARGIN_MM + y * mod).toFixed(4)}h${+mod.toFixed(4)}v${+mod.toFixed(4)}h-${+mod.toFixed(4)}z`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalMm}mm" height="${totalMm}mm" viewBox="0 0 ${totalMm} ${totalMm}" shape-rendering="crispEdges"><rect width="${totalMm}" height="${totalMm}" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>`
}

/** Píxeles RGBA a `dpi` (300 por defecto). Fondo blanco sólido, sin transparencia (sirve para PNG y JPG). */
export function qrRaster(m: QrMatrix, sizeCm: QrSizeCm, dpi = 300): { width: number; height: number; data: Uint8ClampedArray } {
  const { marginPx, qrPx, totalPx } = qrGeometry(sizeCm, dpi)
  const data = new Uint8ClampedArray(totalPx * totalPx * 4).fill(255)
  for (let y = 0; y < qrPx; y++) {
    const my = Math.min(m.size - 1, Math.floor((y * m.size) / qrPx))
    for (let x = 0; x < qrPx; x++) {
      if (m.get(Math.min(m.size - 1, Math.floor((x * m.size) / qrPx)), my)) {
        const i = ((y + marginPx) * totalPx + x + marginPx) * 4
        data[i] = data[i + 1] = data[i + 2] = 0
      }
    }
  }
  return { width: totalPx, height: totalPx, data }
}

/** SVG compacto para mostrar en pantalla (sin unidades físicas). */
export function qrInlineSvg(text: string, px: number): string {
  const m = qrMatrix(text)
  let d = ''
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(x, y)) d += `M${x} ${y}h1v1h-1z`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${m.size} ${m.size}" shape-rendering="crispEdges"><path d="${d}" fill="#000"/></svg>`
}
