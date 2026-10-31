import type { CoupleBook, Member, Place, Role } from '../domain/types'
import {
  listPlaces,
  loadBook,
  loadMember,
  replaceAllPlaces,
} from '../storage/localDb'
import { isWish, mergeSamePlace } from '../domain/wishes'
import { getSupabase } from './supabaseClient'

interface BookRow {
  id: string
  invite_code: string
  marker_pack: CoupleBook['markerPack']
  created_at: string
}

interface MemberRow {
  id: string
  book_id: string
  role: Role
  device_token: string
  joined_at: string
}

interface PlaceRow {
  id: string
  book_id: string
  place_type: Place['placeType']
  name: string
  country_code: string
  lat: number
  lng: number
  visitor: Place['visitor']
  visited_on: string | null
  status?: Place['status']
  wish_note?: string | null
  updated_at: string
}

interface SupabaseErrorLike {
  code?: string
  message?: string
  details?: string
}

export class RoleTakenError extends Error {
  constructor(role: Role) {
    super(`Role "${role}" is already taken`)
    this.name = 'RoleTakenError'
  }
}

export class BookFullError extends Error {
  constructor() {
    super('This couple book already has two members')
    this.name = 'BookFullError'
  }
}

export const SHARED_INVITE_CODE = 'X5MPHP'
export const SHARED_BOOK_ID = 'f2ff5404-a824-466d-920e-052a6368fd1f'
export const ORIGINAL_COUPLE_BOOK_ID = 'e5913c24-8892-45e9-a134-1951e064ea12'

export async function resumeSharedBook(input: {
  role: Role
  deviceToken: string
}): Promise<{ book: CoupleBook; member: Member; places: Place[] }> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('云端还没连上')

  const { data: bookData, error: bookError } = await supabase
    .from('couple_books')
    .select('*')
    .eq('invite_code', SHARED_INVITE_CODE)
    .maybeSingle()
  if (bookError) throw bookError
  if (!bookData) throw new Error('没有找到你们一起的地图')

  const book = toBook(bookData as BookRow)
  const { data: memberData, error: membersError } = await supabase
    .from('members')
    .select('*')
    .eq('book_id', book.id)
  if (membersError) throw membersError

  const members = (memberData as MemberRow[]).map(toMember)
  let seat = members.find((member) => member.role === input.role)
  const mine = members.find((member) =>
    member.deviceToken === input.deviceToken && member.id !== seat?.id,
  )

  if (!seat) {
    seat = {
      id: crypto.randomUUID(),
      bookId: book.id,
      role: input.role,
      deviceToken: input.deviceToken,
      joinedAt: new Date().toISOString(),
    }
    const { error } = await supabase.from('members').insert({
      id: seat.id,
      book_id: seat.bookId,
      role: seat.role,
      device_token: seat.deviceToken,
      joined_at: seat.joinedAt,
    })
    if (error) throw error
  } else if (seat.deviceToken !== input.deviceToken) {
    if (mine) {
      const { error } = await supabase
        .from('members')
        .update({ device_token: crypto.randomUUID() })
        .eq('id', mine.id)
      if (error) throw error
    }
    const { error } = await supabase
      .from('members')
      .update({ device_token: input.deviceToken })
      .eq('id', seat.id)
    if (error) throw error
    seat = { ...seat, deviceToken: input.deviceToken }
  }

  return { book, member: seat, places: await pullPlaces(book.id) }
}

function toBook(row: BookRow): CoupleBook {
  return {
    id: row.id,
    inviteCode: row.invite_code,
    markerPack: row.marker_pack,
    createdAt: row.created_at,
  }
}

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    bookId: row.book_id,
    role: row.role,
    deviceToken: row.device_token,
    joinedAt: row.joined_at,
  }
}

function toPlace(row: PlaceRow): Place {
  return {
    id: row.id,
    bookId: row.book_id,
    placeType: row.place_type,
    name: row.name,
    countryCode: row.country_code,
    lat: row.lat,
    lng: row.lng,
    visitor: row.visitor,
    ...(row.status === 'wish' ? { status: 'wish' as const } : {}),
    ...(row.wish_note ? { wishNote: row.wish_note } : {}),
    ...(row.visited_on ? { visitedOn: row.visited_on } : {}),
    updatedAt: row.updated_at,
  }
}

function placeKey(place: Place): string {
  return `${place.placeType}:${place.countryCode}:${place.name}`
}

function isUniqueViolation(error: SupabaseErrorLike): boolean {
  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return error.code === '23505' || text.includes('unique constraint') || text.includes('duplicate key')
}

function isRoleUniqueViolation(error: SupabaseErrorLike): boolean {
  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
  return text.includes('members_book_id_role') || text.includes('(book_id, role)')
}

export function mergePlacesByUpdatedAt(
  localPlaces: Place[],
  remotePlaces: Place[],
): Place[] {
  const merged = new Map<string, Place>()

  for (const place of [...localPlaces, ...remotePlaces]) {
    const key = placeKey(place)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, place)
      continue
    }
    const incomingWins = Date.parse(place.updatedAt) > Date.parse(existing.updatedAt)
    if (isWish(existing) || isWish(place)) {
      const newer = incomingWins ? place : existing
      const older = incomingWins ? existing : place
      merged.set(key, mergeSamePlace(older, newer))
      continue
    }
    const winner = incomingWins ? place : existing
    const other = incomingWins ? existing : place
    const photos = winner.photos?.length ? winner.photos : other.photos
    merged.set(key, photos?.length ? { ...winner, photos } : winner)
  }

  return [...merged.values()]
}

export function rebindPlacesToBook(
  places: Place[],
  bookId: string,
): Place[] {
  return places.map((place) => ({ ...place, bookId }))
}

export async function ensureSessionRemote(input: {
  book: CoupleBook
  member: Member
}): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')

  const { book, member } = input
  const { error: bookError } = await supabase.from('couple_books').upsert({
    id: book.id,
    invite_code: book.inviteCode,
    marker_pack: book.markerPack,
    created_at: book.createdAt,
  }, { onConflict: 'id' })
  if (bookError) throw bookError

  const { error: memberError } = await supabase.from('members').upsert({
    id: member.id,
    book_id: book.id,
    role: member.role,
    device_token: member.deviceToken,
    joined_at: member.joinedAt,
  }, { onConflict: 'id' })
  if (memberError) throw memberError
}

export async function createBookRemote(input: {
  book: CoupleBook
  member: Member
}): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')

  const { book, member } = input
  const { error: bookError } = await supabase.from('couple_books').insert({
    id: book.id,
    invite_code: book.inviteCode,
    marker_pack: book.markerPack,
    created_at: book.createdAt,
  })
  if (bookError) throw bookError

  const { error: memberError } = await supabase.from('members').insert({
    id: member.id,
    book_id: member.bookId,
    role: member.role,
    device_token: member.deviceToken,
    joined_at: member.joinedAt,
  })
  if (memberError) {
    try {
      await supabase.from('couple_books').delete().eq('id', book.id)
    } catch {
      // Preserve the member insert error; orphan cleanup is best-effort.
    }
    throw memberError
  }
}

export async function joinBookRemote(input: {
  inviteCode: string
  member: Member
}): Promise<{ book: CoupleBook; members: Member[] }> {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')

  const { data: bookData, error: bookError } = await supabase
    .from('couple_books')
    .select('*')
    .eq('invite_code', input.inviteCode)
    .maybeSingle()
  if (bookError) throw bookError
  if (!bookData) throw new Error('Couple book not found')

  const bookRow = bookData as BookRow
  const { data: memberData, error: membersError } = await supabase
    .from('members')
    .select('*')
    .eq('book_id', bookRow.id)
  if (membersError) throw membersError

  const members = (memberData as MemberRow[]).map(toMember)
  const takenRoles = new Set(members.map((member) => member.role))
  if (takenRoles.has('rabbit') && takenRoles.has('dog')) throw new BookFullError()
  if (takenRoles.has(input.member.role)) throw new RoleTakenError(input.member.role)

  const joiningMember = { ...input.member, bookId: bookRow.id }
  const { error: insertError } = await supabase.from('members').insert({
    id: joiningMember.id,
    book_id: joiningMember.bookId,
    role: joiningMember.role,
    device_token: joiningMember.deviceToken,
    joined_at: joiningMember.joinedAt,
  })
  if (insertError) {
    if (isUniqueViolation(insertError)) {
      const { data: latestMemberData, error: latestMembersError } = await supabase
        .from('members')
        .select('*')
        .eq('book_id', bookRow.id)

      if (!latestMembersError) {
        const latestMembers = (latestMemberData as MemberRow[]).map(toMember)
        const latestRoles = new Set(latestMembers.map((member) => member.role))
        if (latestRoles.has('rabbit') && latestRoles.has('dog')) throw new BookFullError()
        if (latestRoles.has(joiningMember.role)) throw new RoleTakenError(joiningMember.role)
      }

      if (isRoleUniqueViolation(insertError)) throw new RoleTakenError(joiningMember.role)
    }
    throw insertError
  }

  return { book: toBook(bookRow), members: [...members, joiningMember] }
}

async function wishColumnsReady(supabase: NonNullable<ReturnType<typeof getSupabase>>): Promise<boolean> {
  try {
    const { error } = await supabase.from('places').select('status').limit(1)
    return !error
  } catch {
    return false
  }
}

export async function pushDirtyPlaces(bookId: string, places: Place[]): Promise<void> {
  const supabase = getSupabase()
  if (!supabase || places.length === 0) return

  const shareWishes = await wishColumnsReady(supabase)
  const rows = places
    .filter((place) => shareWishes || !isWish(place))
    .map((place) => ({
      id: place.id,
      book_id: bookId,
      place_type: place.placeType,
      name: place.name,
      country_code: place.countryCode,
      lat: place.lat,
      lng: place.lng,
      visitor: place.visitor,
      visited_on: place.visitedOn ?? null,
      ...(shareWishes ? {
        status: place.status === 'wish' ? 'wish' : 'visited',
        wish_note: place.wishNote ?? null,
      } : {}),
      updated_at: place.updatedAt,
    }))
  if (rows.length === 0) return
  const { error } = await supabase
    .from('places')
    .upsert(rows, { onConflict: 'book_id,place_type,country_code,name' })
  if (error) throw error
}

export async function pullPlaces(bookId: string): Promise<Place[]> {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase.from('places').select('*').eq('book_id', bookId)
  if (error) throw error
  return (data as PlaceRow[]).map(toPlace)
}

export async function updateBookRemote(book: CoupleBook): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false

  const { error } = await supabase
    .from('couple_books')
    .update({ marker_pack: book.markerPack })
    .eq('id', book.id)
  if (error) throw error
  return true
}

export async function syncNow(): Promise<'ok' | 'offline' | 'no-book' | 'pulled'> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'

  const [book, member] = await Promise.all([loadBook(), loadMember()])
  if (!book || !member) return 'no-book'
  if (!getSupabase()) return 'offline'

  const localPlaces = rebindPlacesToBook(await listPlaces(), book.id)
  const remotePlaces = await pullPlaces(book.id)
  const mergedPlaces = mergePlacesByUpdatedAt(localPlaces, remotePlaces)
  // Show the cloud cities even when this phone cannot upload.
  await replaceAllPlaces(mergedPlaces)
  try {
    await ensureSessionRemote({ book, member })
    await pushDirtyPlaces(book.id, mergedPlaces)
  } catch {
    return 'pulled'
  }
  return 'ok'
}
