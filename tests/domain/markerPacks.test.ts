import { describe, expect, it } from 'vitest'
import { markerGlyph } from '../../src/domain/markerPacks'

describe('markerGlyph', () => {
  it('returns the configured glyph for each marker pack and visitor', () => {
    expect(markerGlyph('stars', 'together')).toBe('💖')
    expect(markerGlyph('stars', 'rabbit')).toMatch(/⭐|🌟/)
    expect(markerGlyph('animals', 'dog')).toBe('🐕')
  })
})
