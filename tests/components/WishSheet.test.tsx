import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WishSheet } from '../../src/components/WishSheet'
import type { Place } from '../../src/domain/types'

const wish: Place = {
  id: 'w1',
  bookId: 'b1',
  placeType: 'city',
  name: '京都',
  countryCode: 'JP',
  lat: 35,
  lng: 135,
  visitor: 'rabbit',
  status: 'wish',
  wishNote: '想看红叶',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

describe('WishSheet', () => {
  it('lists wishes and does not use the light-up action', () => {
    render(
      <WishSheet
        open
        places={[wish]}
        onClose={() => undefined}
        onAdd={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: '心愿单' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /京都/ })).toHaveTextContent('想去')
    expect(screen.getByRole('button', { name: /京都/ })).toHaveTextContent('想看红叶')
    expect(screen.queryByRole('button', { name: '点亮' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '点亮新地方' })).not.toBeInTheDocument()
  })

  it('adds a wish from its own form', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(
      <WishSheet
        open
        places={[]}
        memberRole="rabbit"
        onClose={() => undefined}
        onAdd={onAdd}
        onOpen={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '添加心愿' }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tok' } })
    fireEvent.click(screen.getByRole('button', { name: /Tokyo/ }))
    fireEvent.change(screen.getByLabelText('为什么想去（可选）'), { target: { value: '想看夜景' } })
    fireEvent.click(screen.getByRole('button', { name: '记下心愿' }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tokyo', countryCode: 'JP' }),
        'rabbit',
        '想看夜景',
      )
    })
    expect(screen.getByRole('heading', { name: '心愿单' })).toBeInTheDocument()
  })
})
