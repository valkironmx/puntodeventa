import { describe, expect, it } from 'vitest'
import { isReserved, slugify, suggestSlug } from './slug'

describe('slug', () => {
  it('quita acentos, espacios y símbolos', () => {
    expect(slugify('Café La Luna')).toBe('cafelaluna')
    expect(slugify('Tacos El Güero')).toBe('tacoselguero')
    expect(slugify('  Nómada-Store #1 ')).toBe('nomadastore1')
  })
  it('reservados', () => {
    expect(isReserved('app')).toBe(true)
    expect(isReserved('super')).toBe(true)
    expect(isReserved('cafelaluna')).toBe(false)
  })
  it('sugiere slug2, slug3…', () => {
    const taken = new Set(['cafelaluna', 'cafelaluna2'])
    expect(suggestSlug('cafelaluna', (s) => taken.has(s))).toBe('cafelaluna3')
    expect(suggestSlug('app', () => false)).toBe('app2')
    expect(suggestSlug('libre', () => false)).toBe('libre')
  })
})
