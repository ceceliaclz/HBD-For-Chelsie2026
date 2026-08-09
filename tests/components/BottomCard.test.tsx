import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomCard } from '../../src/components/BottomCard'
import type { Place } from '../../src/domain/types'

const base = {
  bookId: 'b1',
  lat: 0,
  lng: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const places: Place[] = [
  { ...base, id: '1', placeType: 'city', name: 'Tokyo', countryCode: 'JP', visitor: 'together' },
  { ...base, id: '2', placeType: 'city', name: 'Osaka', countryCode: 'JP', visitor: 'rabbit' },
  { ...base, id: '3', placeType: 'country', name: 'France', countryCode: 'FR', visitor: 'dog' },
]

describe('BottomCard', () => {
  it('shows travel stats and updates the selected filter', () => {
    const onFilterChange = vi.fn()

    render(
      <BottomCard
        places={places}
        filter="all"
        onFilterChange={onFilterChange}
      />,
    )

    expect(screen.getByLabelText('旅行统计')).toHaveTextContent('2 个国家')
    expect(screen.getByLabelText('旅行统计')).toHaveTextContent('2 座城市')
    expect(screen.getByLabelText('旅行统计')).toHaveTextContent('1 次一起')

    fireEvent.click(screen.getByRole('button', { name: '兔子' }))
    expect(onFilterChange).toHaveBeenCalledWith('rabbit')
  })
})
