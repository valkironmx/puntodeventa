// Levanta Postgres embebido + Next.js en el puerto 3006 (sin Docker).
import { spawn } from 'node:child_process'
import { startDb, migrate } from './db.mjs'

const started = await startDb()
await migrate()
console.log('Base de datos lista. Iniciando Next.js en http://localhost:3006 …')
const next = spawn('npx', ['next', 'dev', '-p', '3006'], { stdio: 'inherit' })
const stop = async () => { next.kill('SIGTERM'); if (started) await started.stop(); process.exit(0) }
process.on('SIGINT', stop); process.on('SIGTERM', stop)
next.on('exit', async (c) => { if (started) await started.stop(); process.exit(c ?? 0) })
