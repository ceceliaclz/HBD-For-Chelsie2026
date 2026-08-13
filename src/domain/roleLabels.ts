import type { Role, Visitor } from './types'

export const ROLE_LABELS: Record<Role, { name: string; emoji: string; note: string }> = {
  rabbit: { name: '兔子', emoji: '🐰', note: '粉色足迹' },
  dog: { name: '啾啾', emoji: '🐤', note: '蓝色足迹' },
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role].name
}

export function visitorLabel(visitor: Visitor): string {
  if (visitor === 'together') return '一起'
  return ROLE_LABELS[visitor].name
}

export function visitorEmoji(visitor: Visitor): string {
  if (visitor === 'together') return '♥'
  return ROLE_LABELS[visitor].emoji
}
