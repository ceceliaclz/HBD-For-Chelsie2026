import type { MarkerPack, Visitor } from './types'

const GLYPHS: Record<MarkerPack, Record<Visitor, string>> = {
  stars: { rabbit: '⭐', dog: '🌟', together: '💖' },
  stamps: { rabbit: '🎫', dog: '📮', together: '💌' },
  animals: { rabbit: '🐰', dog: '🐕', together: '💕' },
}

export function markerGlyph(pack: MarkerPack, visitor: Visitor): string {
  return GLYPHS[pack][visitor]
}
