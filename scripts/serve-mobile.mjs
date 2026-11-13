// Sirve mobile/www para probar la app del teléfono en el navegador (http://localhost:3010)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../mobile/www')
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' }
http.createServer((req, res) => {
  const p = path.normalize(path.join(dir, decodeURIComponent((req.url ?? '/').split('?')[0])))
  const f = p.startsWith(dir) && fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(dir, 'index.html')
  res.writeHead(200, { 'content-type': T[path.extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  fs.createReadStream(f).pipe(res)
}).listen(3010, '127.0.0.1', () => console.log('App del teléfono en http://localhost:3010'))
