// Cálculo único de IVA (PLAN §6.1). Misma lógica que public.calc_line en SQL. Todo en centavos.
export type TaxMode = 'included' | 'plus' | 'exempt'
export type ProductTaxMode = TaxMode | 'global'
export interface Line { base: number; iva: number; total: number }

export function effectiveMode(productMode: ProductTaxMode, globalMode: 'included' | 'plus'): TaxMode {
  return productMode === 'global' ? globalMode : productMode
}

/** unitCents = precio unitario final capturado (rebajado si existe); qty admite 3 decimales; rate = 16 | 8 | 0 */
export function calcLine(unitCents: number, qty: number, mode: TaxMode, rate: number): Line {
  const p = Math.round(unitCents * qty)
  const r = rate / 100
  if (mode === 'plus') {
    const iva = Math.round(p * r)
    return { base: p, iva, total: p + iva }
  }
  if (mode === 'exempt') return { base: p, iva: 0, total: p }
  const base = Math.round(p / (1 + r))
  return { base, iva: p - base, total: p }
}

/** Documento: se redondea POR LÍNEA y se suma. */
export function sumLines(lines: Line[]): { subtotal: number; iva: number; total: number } {
  return lines.reduce((a, l) => ({ subtotal: a.subtotal + l.base, iva: a.iva + l.iva, total: a.total + l.total }), { subtotal: 0, iva: 0, total: 0 })
}

/** Precio final al público (con IVA) de 1 unidad */
export function publicPrice(unitCents: number, mode: TaxMode, rate: number): number {
  return calcLine(unitCents, 1, mode, rate).total
}
