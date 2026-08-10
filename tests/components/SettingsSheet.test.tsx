import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clipboardWriteText = vi.hoisted(() => vi.fn())

vi.mock('../../src/sync/supabaseClient', () => ({
  getSupabase: () => ({}),
}))

vi.mock('../../src/sync/syncEngine', () => ({
  updateBookRemote: vi.fn(),
}))

import { SettingsSheet } from '../../src/components/SettingsSheet'

describe('SettingsSheet', () => {
  beforeEach(() => {
    clipboardWriteText.mockReset()
    clipboardWriteText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    })
  })

  it('copies the invite code separately from the share link', async () => {
    render(
      <SettingsSheet
        open
        book={{
          id: 'book-1',
          inviteCode: 'MAP7YK',
          markerPack: 'stars',
          createdAt: '2026-08-10T00:00:00.000Z',
        }}
        member={{
          id: 'member-1',
          bookId: 'book-1',
          role: 'rabbit',
          deviceToken: 'device-1',
          joinedAt: '2026-08-10T00:00:00.000Z',
        }}
        onClose={() => undefined}
        onBookChange={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '复制邀请码' }))
    await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith('MAP7YK'))

    fireEvent.click(screen.getByRole('button', { name: '复制邀请链接' }))
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenLastCalledWith(`${window.location.origin}/join/MAP7YK`)
    })
  })
})
