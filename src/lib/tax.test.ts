import { describe, expect, it } from 'vitest'
import { calcLine, effectiveMode, publicPrice, sumLines } from './tax'

describe('tax', () => {
  it('IVA incluido: total = precio, base = p / 1.16', () => {
    expect(calcLine(5500, 2, 'included', 16)).toEqual({ base: 9483, iva: 1517, total: 11000 })
  })
  it('+ IVA: base = precio, total = base + iva', () => {
    expect(calcLine(10000, 1, 'plus', 16)).toEqual({ base: 10000, iva: 1600, total: 11600 })
  })
  it('exento', () => {
    expect(calcLine(3500, 3, 'exempt', 16)).toEqual({ base: 10500, iva: 0, total: 10500 })
  })
  it('tasa frontera 8% y tasa 0', () => {
    expect(calcLine(10000, 1, 'plus', 8).total).toBe(10800)
    expect(calcLine(10000, 1, 'included', 0)).toEqual({ base: 10000, iva: 0, total: 10000 })
  })
  it('cantidades con decimales (1.5 m × $18 = $27)', () => {
    expect(calcLine(1800, 1.5, 'included', 16).total).toBe(2700)
    expect(calcLine(38000, 0.25, 'included', 16).total).toBe(9500)
  })
  it('documento: redondea por línea y suma (ticket de la maqueta: $155 → 133.62 + 21.38)', () => {
    const doc = sumLines([calcLine(5500, 2, 'included', 16), calcLine(4500, 1, 'included', 16)])
    expect(doc).toEqual({ subtotal: 13362, iva: 2138, total: 15500 })
  })
  it('modo efectivo y precio al público', () => {
    expect(effectiveMode('global', 'plus')).toBe('plus')
    expect(effectiveMode('exempt', 'plus')).toBe('exempt')
    expect(publicPrice(10000, 'plus', 16)).toBe(11600)
    expect(publicPrice(10000, 'included', 16)).toBe(10000)
  })
})
