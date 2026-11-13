/* eslint-disable @typescript-eslint/no-explicit-any */
// Dentro de la app del teléfono, cada acción del panel (guardar producto, personalizar, empleados, corte…)
// pasa por aquí: con conexión se ejecuta al momento en el servidor; sin conexión se guarda y se aplica al volver la señal.
import { enqueue, getState, lastResults, removeOp, sync, callNow } from './store'
import { prepareArgs } from './local-actions'

// Necesitan respuesta inmediata del servidor (no se pueden dejar pendientes)
const LIVE = new Set(['panelSlotsAction', 'unreadNotificationsAction', 'changePasswordAction', 'deleteAccountAction', 'checkSlugAction'])

function serialize(v: unknown): unknown {
  if (typeof FormData !== 'undefined' && v instanceof FormData) {
    const entries: [string, string][] = []
    v.forEach((val, k) => { if (typeof val === 'string') entries.push([k, val]); else throw new Error('Para subir archivos necesitas conexión') })
    return { __formData: entries }
  }
  if (typeof File !== 'undefined' && v instanceof File) throw new Error('Para subir archivos necesitas conexión')
  if (Array.isArray(v)) return v.map(serialize)
  if (v instanceof Date) return v.toISOString()
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serialize(x)]))
  return v
}

export function makeAction(mod: string, fn: string) {
  return async (...raw: unknown[]): Promise<any> => {
    let args: unknown[]
    try { args = serialize(raw) as unknown[] } catch (e) { return { ok: false, error: (e as Error).message } }
    if (LIVE.has(fn)) {
      try { return (await callNow({ mod, fn, args })) ?? { ok: true } } catch (e) { return { ok: false, error: (e as Error).message } }
    }
    const ready = prepareArgs(fn, args)
    const op = await enqueue('action', { mod, fn, args: ready }, { label: fn })
    // Sin conexión: el cambio ya se ve en el teléfono; se sube después
    if (!getState().online) { void sync(); return { ok: true, data: ready[0]?.id } }
    await Promise.race([sync(), new Promise((r) => setTimeout(r, 10_000))])
    const s = getState()
    if (s.failed[op.id]) {
      // El servidor la rechazó (dato inválido): se avisa y no se deja pendiente
      const error = s.failed[op.id]
      await removeOp(op.id)
      return { ok: false, error }
    }
    if (s.outbox.some((o) => o.id === op.id)) return { ok: true, data: ready[0]?.id }
    const r = lastResults[op.id]
    return r && typeof r === 'object' && 'ok' in (r as object) ? r : { ok: true, data: r }
  }
}
