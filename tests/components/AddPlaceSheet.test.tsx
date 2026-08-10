import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AddPlaceSheet } from '../../src/components/AddPlaceSheet'

describe('AddPlaceSheet', () => {
  it('searches, selects and submits a city visit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <AddPlaceSheet
        open
        defaultVisitor="rabbit"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tok' } })
    fireEvent.click(screen.getByRole('button', { name: /Tokyo/ }))
    fireEvent.click(screen.getByRole('button', { name: '一起' }))
    fireEvent.change(screen.getByLabelText('到访日期（可选）'), {
      target: { value: '2026-08-09' },
    })
    fireEvent.click(screen.getByRole('button', { name: '点亮' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tokyo', countryCode: 'JP' }),
        'together',
        '2026-08-09',
      )
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('prefills and submits a country from a map long-press', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <AddPlaceSheet
        open
        defaultVisitor="together"
        initialPlace={{
          placeType: 'country',
          name: 'France',
          countryCode: 'FR',
          countryName: 'France',
          lat: 46.5,
          lng: 2.5,
        }}
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByRole('searchbox')).toHaveValue('France')
    fireEvent.click(screen.getByRole('button', { name: '点亮' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ placeType: 'country', countryCode: 'FR' }),
        'together',
        undefined,
      )
    })
  })
})
