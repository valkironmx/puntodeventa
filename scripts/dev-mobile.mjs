// Modo desarrollo de la app del teléfono: empaqueta, sirve en http://localhost:3010 y recarga sola
// la pantalla (emulador y navegador) cada vez que cambia algo en src/.
// Uso: node scripts/dev-mobile.mjs        (el sistema debe estar corriendo con npm run dev en el 3006)
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
// En el emulador, "localhost" llega a tu Mac gracias a adb reverse (lo configura android-dev.mjs)
process.env.CAP_SERVER_URL ??= 'http://localhost:3006'
const { buildMobile } = await import('./build-mobile.mjs')
const www = path.join(root, 'mobile/www')
const PORT = Number(process.env.PORT || 3010)
const clients = new Set()
const RELOAD = `<script>(()=>{const s=new EventSource('/__recarga');s.onmessage=()=>location.reload();})()</script>`

let building = null, again = false, version = 0
async function build(why) {
  if (building) { again = true; return }
  const t = Date.now()
  building = buildMobile().then(() => {
    version++
    console.log(`[app] lista (${((Date.now() - t) / 1000).toFixed(1)} s)${why ? ` · ${why}` : ''}`)
    for (const c of clients) c.write(`data: ${version}\n\n`)
  }).catch((e) => console.error('[app] error al empaquetar:', e.message)).finally(() => { building = null; if (again) { again = false; build('cambios pendientes') } })
  await building
}

await build('inicio')
let timer = null
fs.watch(path.join(root, 'src'), { recursive: true }, (_ev, file) => {
  if (!file || /(^|\/)\./.test(file) || file.startsWith('app/api/')) return
  clearTimeout(timer); timer = setTimeout(() => build(String(file)), 250)
})

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }
http.createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0]
  if (url === '/__recarga') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' })
    res.write(': ok\n\n'); clients.add(res); req.on('close', () => clients.delete(res)); return
  }
  const p = path.normalize(path.join(www, decodeURIComponent(url)))
  const f = p.startsWith(www) && fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(www, 'index.html')
  res.writeHead(200, { 'content-type': T[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  if (f.endsWith('index.html')) res.end(fs.readFileSync(f, 'utf8').replace('</body>', `${RELOAD}</body>`))
  else fs.createReadStream(f).pipe(res)
}).listen(PORT, () => console.log(`[app] modo desarrollo en http://localhost:${PORT} · servidor de datos ${process.env.CAP_SERVER_URL}`))
