/* eslint-disable @typescript-eslint/no-explicit-any */
// Reemplazo de '@/app/actions/sales' dentro de la app del teléfono: guarda en el dispositivo y encola para subir.
import { quoteSchema, saleSchema, preorderEdit, type QuoteInput, type SaleInput, type SaleResult } from '@/lib/sale-schemas'
import { calcLine, sumLines } from '@/lib/tax'
import { fromCents, toCents } from '@/lib/money'
import { enqueue, getState, saleTotals, sync } from './store'
import type { Res } from '@/components/ui'

export type { QuoteInput, SaleInput, SaleResult }
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: (e as any)?.issues?.[0]?.message ?? (e as Error)?.message ?? 'No se pudo guardar' })
const ref = (id: string) => (id.startsWith('local:') ? { sale_client_id: id.slice(6) } : { sale_id: id })

export async function registerSaleAction(input: SaleInput): Promise<Res<SaleResult>> {
  try {
    const d = saleSchema.parse({ ...input, appointment_id: null })
    if (!d.extra && d.payments.length === 0) throw new Error('Indica cómo te pagan')
    if (d.extra && new Date(d.extra.delivery_at).getTime() < Date.now() - 60 * 60 * 1000) throw new Error('La fecha de entrega ya pasó')
    const t = saleTotals(d.items)
    const paid = d.payments.reduce((a, p) => a + toCents(p.amount), 0)
    if (d.extra && paid > toCents(t.total)) throw new Error('El anticipo no puede ser mayor al total')
    if (!d.extra && paid !== toCents(t.total)) throw new Error(`Los pagos (${fromCents(paid)}) no cuadran con el total (${t.total})`)
    const cashPaid = d.payments.find((p) => p.method === 'cash')?.amount
    const change = d.cash_received && cashPaid ? Math.max(0, toCents(d.cash_received) - toCents(cashPaid)) : 0
    const { appointment_id: _a, ...payload } = d
    const op = await enqueue('sale', payload, { ...t, change: fromCents(change) })
    return { ok: true, data: { sale_id: `local:${op.id}`, folio: 0, subtotal: t.subtotal, tax: t.tax, total: t.total, change: fromCents(change) } }
  } catch (e) { return fail(e) }
}

export async function addPaymentAction(saleId: string, amt: string, method: string, note: string): Promise<Res<{ balance: string; status: string }>> {
  try {
    if (!(Number(amt) > 0)) throw new Error('Monto inválido')
    const snap = getState().snap
    const r = [...(snap.preorders ?? []), ...(snap.sales ?? [])].find((x: any) => x.id === saleId)
    if (r && toCents(amt) > toCents(r.balance)) throw new Error(`No puedes cobrar más del saldo ($${r.balance})`)
    await enqueue('payment', { ...ref(saleId), amount: amt, method, note })
    const bal = r ? fromCents(Math.max(0, toCents(r.balance) - toCents(amt))) : '0.00'
    return { ok: true, data: { balance: bal, status: Number(bal) > 0 ? 'partial' : 'paid' } }
  } catch (e) { return fail(e) }
}

export async function setDeliveredAction(saleId: string, delivered: boolean): Promise<Res> {
  try { await enqueue('delivered', { ...ref(saleId), delivered }); return { ok: true } } catch (e) { return fail(e) }
}

export async function updatePreorderAction(saleId: string, input: unknown): Promise<Res> {
  try { const data = preorderEdit.parse(input); await enqueue('preorder_update', { ...ref(saleId), data }); return { ok: true } } catch (e) { return fail(e) }
}

export async function saveQuoteAction(input: QuoteInput): Promise<Res<string>> {
  try {
    if (getState().snap?.user?.role === 'cashier') throw new Error('Tu rol no puede hacer cotizaciones')
    const d = quoteSchema.parse(input)
    const rate = Number(getState().snap.pos.rate)
    const mode = d.prices_plus_tax ? 'plus' : 'included'
    const lines = d.items.map((i) => ({ i, c: calcLine(toCents(i.unit_price), Number(i.qty), mode, rate) }))
    const doc = sumLines(lines.map((l) => l.c))
    const items = lines.map(({ i, c }) => ({ title: i.title, description: i.description ?? null, qty: i.qty, unit_price: i.unit_price, line_total: fromCents(c.total), sale_unit: i.sale_unit ?? 'pieza' }))
    const op = await enqueue('quote', d, { subtotal: fromCents(doc.subtotal), tax: fromCents(doc.iva), total: fromCents(doc.total), items })
    return { ok: true, data: `local:${op.id}` }
  } catch (e) { return fail(e) }
}

export async function convertQuoteAction(id: string): Promise<Res> {
  try {
    await enqueue('convert_quote', id.startsWith('local:') ? { quote_client_id: id.slice(6) } : { quote_id: id })
    return { ok: true }
  } catch (e) { return fail(e) }
}

// La caja se abre sola al subir la primera venta del día
export async function openCashAction(_opening: string): Promise<Res> { void sync(); return { ok: true } }
