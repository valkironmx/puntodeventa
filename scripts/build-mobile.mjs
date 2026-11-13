// Empaqueta la app del teléfono (funciona sin internet) en mobile/www, reutilizando los componentes del panel.
// Uso: node scripts/build-mobile.mjs   (CAP_SERVER_URL=https://tu-dominio.com para producción)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as esbuild from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'

const root = process.cwd()
const out = path.join(root, 'mobile/www')
const tmp = path.join(root, 'mobile/.build')

export function serverUrl() {
  if (process.env.CAP_SERVER_URL) return process.env.CAP_SERVER_URL.replace(/\/$/, '')
  for (const list of Object.values(os.networkInterfaces())) for (const n of list ?? [])
    if (n.family === 'IPv4' && !n.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(n.address)) return `http://${n.address}:3006`
  return 'http://192.168.1.10:3006'
}

function publicEnv() {
  const out = {}
  const f = path.join(root, '.env.local')
  const lines = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n') : []
  for (const l of lines) { const m = /^(NEXT_PUBLIC_[A-Z_]+)=(.*)$/.exec(l.trim()); if (m && !/VAPID/.test(m[1])) out[`process.env.${m[1]}`] = JSON.stringify(m[2].replace(/^["']|["']$/g, '')) }
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith('NEXT_PUBLIC_') && !/VAPID/.test(k)) out[`process.env.${k}`] = JSON.stringify(v)
  return out
}

export async function buildMobile() {
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(tmp, { recursive: true })
  // 1) Estilos del panel (Tailwind + CSS propio)
  const cssIn = path.join(root, 'src/app/globals.css')
  const css = await postcss([tailwind({ base: root })]).process(fs.readFileSync(cssIn, 'utf8'), { from: cssIn, to: path.join(tmp, 'app.css') })
  fs.writeFileSync(path.join(tmp, 'app.css'), css.css)
  // 2) JavaScript: componentes del panel con acciones y navegación de la app del teléfono
  const shim = (f) => path.join(root, 'src/mobile', f)
  const alias = { 'next/link': shim('shims/next-link.tsx'), 'next/navigation': shim('shims/next-navigation.ts') }
  const server = serverUrl()
  await esbuild.build({
    entryPoints: { app: path.join(root, 'src/mobile/main.tsx') },
    outdir: out, bundle: true, minify: true, format: 'iife', target: ['chrome89', 'safari15'], jsx: 'automatic', legalComments: 'none',
    loader: { '.woff2': 'file', '.woff': 'file' }, assetNames: 'assets/[name]-[hash]',
    tsconfig: path.join(root, 'tsconfig.json'),
    define: { __SERVER__: JSON.stringify(server), 'process.env.NODE_ENV': '"production"', ...publicEnv() },
    banner: { js: 'var process=globalThis.process||{env:{}};' },
    logLevel: 'warning',
    plugins: [{ name: 'app-movil', setup(b) {
      b.onResolve({ filter: /^(next\/link|next\/navigation)$/ }, (a) => ({ path: alias[a.path] }))
      // Acciones del servidor → puente de la app (con conexión al momento, sin conexión en cola)
      b.onResolve({ filter: /^@\/app\/actions\/[a-z]+$/ }, (a) => ({ path: a.path.split('/').pop(), namespace: 'acciones' }))
      b.onLoad({ filter: /.*/, namespace: 'acciones' }, (a) => {
        const src = fs.readFileSync(path.join(root, 'src/app/actions', `${a.path}.ts`), 'utf8')
        const names = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1])
        const custom = a.path === 'sales' ? [...fs.readFileSync(shim('actions-sales.ts'), 'utf8').matchAll(/export async function (\w+)/g)].map((m) => m[1]) : []
        const proxy = JSON.stringify(shim('actions-proxy.ts'))
        const code = [`import { makeAction } from ${proxy}`,
          ...names.filter((n) => !custom.includes(n)).map((n) => `export const ${n} = makeAction(${JSON.stringify(a.path)}, ${JSON.stringify(n)})`),
          ...(custom.length ? [`export { ${custom.join(', ')} } from ${JSON.stringify(shim('actions-sales.ts'))}`] : [])].join('\n')
        return { contents: code, loader: 'ts', resolveDir: root }
      })
    } }],
  })
  fs.copyFileSync(path.join(root, 'src/mobile/index.html'), path.join(out, 'index.html'))
  return server
}

if (process.argv[1]?.endsWith('build-mobile.mjs')) {
  const s = await buildMobile()
  const kb = (f) => Math.round(fs.statSync(path.join(out, f)).size / 1024)
  console.log(`App del teléfono lista en mobile/www (app.js ${kb('app.js')} KB, app.css ${kb('app.css')} KB). Servidor: ${s}`)
}
