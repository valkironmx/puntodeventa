import { describe, expect, it } from 'vitest'
import { fromCents, money, moneyShort, toCents } from './money'

describe('money', () => {
  it('convierte a centavos sin floats', () => {
    expect(toCents('19.99')).toBe(1999)
    expect(toCents('0.1') + toCents('0.2')).toBe(30)
    expect(toCents(55)).toBe(5500)
    expect(toCents('1,250.5')).toBe(125050)
    expect(toCents('')).toBe(0)
    expect(toCents('2.675')).toBe(268)
  })
  it('regresa a decimal', () => {
    expect(fromCents(1999)).toBe('19.99')
    expect(fromCents(5)).toBe('0.05')
  })
  it('formato MXN', () => {
    expect(money('155')).toBe('$155.00')
    expect(moneyShort('55.00')).toBe('$55')
    expect(moneyShort('55.5')).toBe('$55.50')
  })
})
