// En local sustituye a pg_cron (ver instrumentation-node.ts). Solo se carga en el runtime de Node.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
