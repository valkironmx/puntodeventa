// Íconos y pantalla de inicio de la app Android (bolsa blanca sobre verde, igual que icon.svg).
// Uso: node scripts/android-icons.mjs   (después de `npx cap add android`)
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const RES = 'android/app/src/main/res'
const GREEN = [31, 138, 107]
function png(w, h, draw) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  const S = 3 // suavizado de bordes
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const [cr, cg, cb, ca] = draw((x + (sx + 0.5) / S) / w, (y + (sy + 0.5) / S) / h)
        r += cr * ca; g += cg * ca; b += cb * ca; a += ca
      }
      const i = y * (w * 4 + 1) + 1 + x * 4
      raw[i] = a ? r / a : 0; raw[i + 1] = a ? g / a : 0; raw[i + 2] = a ? b / a : 0; raw[i + 3] = Math.round((255 * a) / (S * S))
    }
  }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0 }
  const crc = (buf) => { let r = 0xffffffff; for (const v of buf) r = crcT[(r ^ v) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
// Bolsa dentro de un cuadro unitario
const bag = (x, y) => (y > 0.38 && y < 0.76 && x > 0.29 + (y - 0.38) * 0.07 && x < 0.71 - (y - 0.38) * 0.07) || (Math.hypot(x - 0.5, y - 0.34) < 0.13 && Math.hypot(x - 0.5, y - 0.34) > 0.08 && y < 0.38)
// Bolsa escalada alrededor del centro
const bagAt = (x, y, scale) => bag(0.5 + (x - 0.5) / scale, 0.5 + (y - 0.5) / scale)
const W = [255, 255, 255, 1], G = [...GREEN, 1], T = [0, 0, 0, 0]
const roundRect = (x, y, r) => { const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r); return Math.hypot(x - cx, y - cy) <= r }
const write = (rel, buf) => { fs.mkdirSync(path.dirname(path.join(RES, rel)), { recursive: true }); fs.writeFileSync(path.join(RES, rel), buf) }

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(dens)) {
  const s = Math.round(48 * k), f = Math.round(108 * k)
  write(`mipmap-${d}/ic_launcher.png`, png(s, s, (x, y) => (!roundRect(x, y, 0.2) ? T : bagAt(x, y, 1.05) ? W : G)))
  write(`mipmap-${d}/ic_launcher_round.png`, png(s, s, (x, y) => (Math.hypot(x - 0.5, y - 0.5) > 0.5 ? T : bagAt(x, y, 0.95) ? W : G)))
  // Ícono adaptable: la bolsa dentro de la zona segura (66 de 108)
  write(`mipmap-${d}/ic_launcher_foreground.png`, png(f, f, (x, y) => (bagAt(x, y, 0.66) ? W : T)))
}
fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F8A6B</color>\n</resources>\n')

// Pantallas de inicio: verde con la bolsa al centro
for (const dir of fs.readdirSync(RES).filter((n) => n.startsWith('drawable'))) {
  const file = path.join(RES, dir, 'splash.png')
  if (!fs.existsSync(file)) continue
  const b = fs.readFileSync(file), w = b.readUInt32BE(16), h = b.readUInt32BE(20)
  const m = Math.min(w, h), size = 0.34 * m
  write(path.join(dir, 'splash.png'), png(w, h, (x, y) => {
    const ux = 0.5 + ((x - 0.5) * w) / size, uy = 0.5 + ((y - 0.5) * h) / size
    return ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1 && bag(ux, uy) ? W : G
  }))
}
console.log('Íconos y pantallas de inicio de Android listos')
