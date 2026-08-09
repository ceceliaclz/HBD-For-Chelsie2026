import { describe, it, expect } from 'vitest'
import { mergeVisitor } from '../../src/domain/visitorUpgrade'

describe('mergeVisitor', () => {
  it('keeps first visitor when same', () => {
    expect(mergeVisitor('rabbit', 'rabbit')).toBe('rabbit')
  })
  it('upgrades rabbit+dog to together', () => {
    expect(mergeVisitor('rabbit', 'dog')).toBe('together')
    expect(mergeVisitor('dog', 'rabbit')).toBe('together')
  })
  it('together stays together', () => {
    expect(mergeVisitor('together', 'rabbit')).toBe('together')
  })
  it('null existing uses incoming', () => {
    expect(mergeVisitor(null, 'dog')).toBe('dog')
  })
})
