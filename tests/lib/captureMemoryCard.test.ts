import { describe, expect, it } from 'vitest'
import { formatCardDate } from '../../src/lib/captureMemoryCard'

describe('formatCardDate', () => {
  it('formats local date as YYYY.MM.DD', () => {
    expect(formatCardDate(new Date(2026, 7, 13, 12, 0, 0))).toBe('2026.08.13')
  })
})
