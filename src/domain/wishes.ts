import type { Place, PlaceStatus } from './types'
import { mergeVisitor } from './visitorUpgrade'

export function isWish(place: Place): boolean {
  return place.status === 'wish'
}

export function wishMark(place: Place): string {
  return place.visitor === 'together' ? '都想去' : '想去'
}

function keptNote(place: Place): string | undefined {
  const note = place.wishNote?.trim()
  return note || undefined
}

/** A visit always wins over a wish for the same place. Two wishes combine. */
export function mergeSamePlace(existing: Place, incoming: Place): Place {
  const existingVisit = !isWish(existing)
  const incomingVisit = !isWish(incoming)
  if (existingVisit || incomingVisit) {
    const visit = existingVisit ? existing : incoming
    const other = visit === existing ? incoming : existing
    const status: PlaceStatus = 'visited'
    const wishNote = keptNote(visit) ?? keptNote(other)
    return {
      ...visit,
      id: existing.id,
      status,
      visitor: visit.visitor,
      ...(wishNote ? { wishNote } : {}),
      photos: visit.photos?.length ? visit.photos : other.photos,
      visitedOn: visit.visitedOn ?? other.visitedOn,
      updatedAt: incoming.updatedAt,
    }
  }

  const wishNote = keptNote(incoming) ?? keptNote(existing)
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    status: 'wish',
    visitor: mergeVisitor(existing.visitor, incoming.visitor),
    ...(wishNote ? { wishNote } : {}),
    updatedAt: incoming.updatedAt,
  }
}
