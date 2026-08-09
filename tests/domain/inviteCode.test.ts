import { describe, it, expect } from 'vitest'
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from '../../src/domain/inviteCode'

describe('inviteCode', () => {
  it('generates 6-char codes without ambiguous chars', () => {
    const code = generateInviteCode()
    expect(code).toMatch(/^[A-Z2-9]{6}$/)
    expect(code).not.toMatch(/[0O1I]/)
  })

  it('normalizes and validates', () => {
    expect(normalizeInviteCode(' map7yk ')).toBe('MAP7YK')
    expect(isValidInviteCode('MAP7YK')).toBe(true)
    expect(isValidInviteCode('LOVE0O')).toBe(false)
  })
})
