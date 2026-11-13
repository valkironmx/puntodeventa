import { describe, expect, it } from 'vitest'
import { qrGeometry, qrMatrix, qrRaster, qrSvg, type QrSizeCm } from './qr'

const m = qrMatrix('https://tuapp.com/q/7Kd2xQa')
const sizes: QrSizeCm[] = [3, 5, 10]

describe('qr · margen de 3 mm', () => {
  it('geometría: lado total = S×10 + 6 mm; 35 px por lado a 300 dpi', () => {
    for (const s of sizes) {
      const g = qrGeometry(s)
      expect(g.totalMm).toBe(s * 10 + 6)
      expect(g.marginPx).toBe(35)
      expect(g.totalPx).toBe(g.qrPx + 70)
    }
    expect(qrGeometry(5).qrPx).toBe(591)
    expect(qrGeometry(5, 600).marginPx).toBe(71)
  })

  it('SVG: mm, viewBox con margen, fondo blanco y nada dibujado dentro de los 3 mm', () => {
    for (const s of sizes) {
      const svg = qrSvg(m, s)
      const total = s * 10 + 6
      expect(svg).toContain(`width="${total}mm"`)
      expect(svg).toContain(`height="${total}mm"`)
      expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`)
      expect(svg).toContain(`<rect width="${total}" height="${total}" fill="#ffffff"/>`)
      const coords = [...svg.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)/g)]
      expect(coords.length).toBeGreaterThan(50)
      for (const [, x, y, w] of coords) {
        expect(Number(x)).toBeGreaterThanOrEqual(3)
        expect(Number(y)).toBeGreaterThanOrEqual(3)
        expect(Number(x) + Number(w)).toBeLessThanOrEqual(total - 3 + 1e-6)
        expect(Number(y) + Number(w)).toBeLessThanOrEqual(total - 3 + 1e-6)
      }
    }
  })

  it('PNG/JPG (raster 300 dpi): los 35 px de cada lado son blanco sólido y opaco', () => {
    for (const s of sizes) {
      const { width, height, data } = qrRaster(m, s)
      const g = qrGeometry(s)
      expect(width).toBe(g.totalPx)
      expect(height).toBe(g.totalPx)
      let dark = 0
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          expect(data[i + 3]).toBe(255) // sin transparencia
          const inMargin = x < 35 || y < 35 || x >= width - 35 || y >= height - 35
          if (inMargin && data[i] !== 255) throw new Error(`pixel oscuro en el margen (${x},${y}) tamaño ${s}`)
          if (data[i] === 0) dark++
        }
      }
      expect(dark).toBeGreaterThan(0)
      // las esquinas del QR (patrón de posición) empiezan justo después del margen
      expect(data[(35 * width + 35) * 4]).toBe(0)
    }
  })
})
