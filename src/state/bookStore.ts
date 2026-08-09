import { useCallback, useEffect, useState } from 'react'
import type { Place, Visitor } from '../domain/types'
import type { CityHit } from '../geo/citySearch'
import { newId } from '../lib/id'
import { listPlaces, loadBook, upsertPlace } from '../storage/localDb'

const DEV_BOOK_ID = 'local-dev-book'

export function useBookStore(initialPlaces?: Place[]) {
  const [places, setPlaces] = useState<Place[]>(initialPlaces ?? [])
  const [ready, setReady] = useState(initialPlaces !== undefined)

  useEffect(() => {
    let active = true
    if (initialPlaces !== undefined) {
      setPlaces(initialPlaces)
      setReady(true)
      return () => {
        active = false
      }
    }

    void listPlaces().then((savedPlaces) => {
      if (active) {
        setPlaces(savedPlaces)
        setReady(true)
      }
    })
    return () => {
      active = false
    }
  }, [initialPlaces])

  const addCity = useCallback(async (
    hit: CityHit,
    visitor: Visitor,
    visitedOn?: string,
  ) => {
    const book = await loadBook()
    await upsertPlace({
      id: newId(),
      bookId: book?.id ?? DEV_BOOK_ID,
      placeType: 'city',
      name: hit.name,
      countryCode: hit.countryCode,
      lat: hit.lat,
      lng: hit.lng,
      visitor,
      ...(visitedOn ? { visitedOn } : {}),
      updatedAt: new Date().toISOString(),
    })
    setPlaces(await listPlaces())
  }, [])

  return { places, ready, addCity }
}
