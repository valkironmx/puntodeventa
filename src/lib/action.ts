import 'server-only'
import { revalidatePath } from 'next/cache'
import { getCtx, type Ctx } from './auth'
import { errMsg } from './db'

export type Res<T = unknown> = { ok: true; data?: T } | { ok: false; error: string }

export function isRedirect(e: unknown): boolean {
  return !!e && typeof e === 'object' && 'digest' in e && String((e as { digest: unknown }).digest).startsWith('NEXT_')
}

/** Envoltura de Server Actions del panel: contexto + errores legibles + revalidación. */
export async function act<T>(fn: (ctx: Ctx) => Promise<T>): Promise<Res<T>> {
  try {
    const ctx = await getCtx()
    const data = await fn(ctx)
    revalidatePath('/', 'layout')
    return { ok: true, data }
  } catch (e) {
    if (isRedirect(e)) throw e
    return { ok: false, error: errMsg(e) }
  }
}

export function needManage(ctx: Ctx) {
  if (ctx.role === 'cashier') throw new Error('Tu rol no tiene permiso para esto')
}
export function needOwner(ctx: Ctx) {
  if (ctx.role !== 'owner' && ctx.role !== 'super') throw new Error('Solo el dueño puede hacer esto')
}
