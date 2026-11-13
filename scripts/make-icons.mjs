// Íconos PNG para notificaciones (Android no muestra SVG en notificaciones).
import fs from 'node:fs'
import zlib from 'node:zlib'
function png(w, draw) {
  const raw = Buffer.alloc((w * 4 + 1) * w)
  for (let y = 0; y < w; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b, a] = draw(x / w, y / w); const i = y * (w * 4 + 1) + 1 + x * 4; raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a } }
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } let r = 0xffffffff; for (const b of buf) r = t[(r ^ b) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(w, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
// Bolsa blanca sobre verde (mismo dibujo que icon.svg)
const bag = (x, y) => (y > 0.38 && y < 0.76 && x > 0.29 + (y - 0.38) * 0.07 && x < 0.71 - (y - 0.38) * 0.07) || (Math.hypot(x - 0.5, y - 0.34) < 0.13 && Math.hypot(x - 0.5, y - 0.34) > 0.08 && y < 0.38)
fs.writeFileSync('public/icon-192.png', png(192, (x, y) => {
  const r = 0.22, inCorner = (cx, cy) => Math.hypot(x - cx, y - cy) > r
  const out = (x < r && y < r && inCorner(r, r)) || (x > 1 - r && y < r && inCorner(1 - r, r)) || (x < r && y > 1 - r && inCorner(r, 1 - r)) || (x > 1 - r && y > 1 - r && inCorner(1 - r, 1 - r))
  if (out) return [0, 0, 0, 0]
  return bag(x, y) ? [255, 255, 255, 255] : [31, 138, 107, 255]
}))
fs.writeFileSync('public/badge-72.png', png(72, (x, y) => (bag(x, y) ? [255, 255, 255, 255] : [0, 0, 0, 0])))
console.log('íconos creados')
