import type { Visitor } from './types'

export function mergeVisitor(existing: Visitor | null, incoming: Visitor): Visitor {
  if (!existing) return incoming
  if (existing === 'together' || incoming === 'together') return 'together'
  if (existing === incoming) return existing
  return 'together'
}
