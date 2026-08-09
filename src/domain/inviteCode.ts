const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateInviteCode(): string {
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (let i = 0; i < 6; i++) out += ALPHABET[bytes[i]! % ALPHABET.length]
  return out
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function isValidInviteCode(code: string): boolean {
  const c = normalizeInviteCode(code)
  return /^[A-Z2-9]{6}$/.test(c) && !/[0O1I]/.test(c)
}
