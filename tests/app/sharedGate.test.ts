import { describe, expect, it } from 'vitest'
import { canShowSharedMap } from '../../src/sharedGate'
import { SHARED_INVITE_CODE } from '../../src/sync/syncEngine'

describe('canShowSharedMap', () => {
  it('shows the shared map as soon as this device already has it', () => {
    expect(canShowSharedMap(true, SHARED_INVITE_CODE)).toBe(true)
  })

  it('does not replace a missing or different book with the map', () => {
    expect(canShowSharedMap(false, SHARED_INVITE_CODE)).toBe(false)
    expect(canShowSharedMap(true, null)).toBe(false)
    expect(canShowSharedMap(true, 'GDTSRR')).toBe(false)
  })
})
