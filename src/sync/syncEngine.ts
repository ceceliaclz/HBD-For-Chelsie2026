import type { CoupleBook, Member, Place, Role } from '../domain/types'
import { listPlaces, loadBook, replaceAllPlaces } from '../storage/localDb'
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
    if (!existing || Date.parse(place.updatedAt) > Date.parse(existing.updatedAt)) {
      merged.set(key, place)
    }
  }

  return [...merged.values()]
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

export async function pushDirtyPlaces(bookId: string, places: Place[]): Promise<void> {
  const supabase = getSupabase()
  if (!supabase || places.length === 0) return

  const rows = places.map((place) => ({
    id: place.id,
    book_id: bookId,
    place_type: place.placeType,
    name: place.name,
    country_code: place.countryCode,
    lat: place.lat,
    lng: place.lng,
    visitor: place.visitor,
    visited_on: place.visitedOn ?? null,
    updated_at: place.updatedAt,
  }))
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

export async function syncNow(): Promise<'ok' | 'offline' | 'no-book'> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'

  const book = await loadBook()
  if (!book) return 'no-book'
  if (!getSupabase()) return 'offline'

  const localPlaces = await listPlaces()
  const remotePlaces = await pullPlaces(book.id)
  const mergedPlaces = mergePlacesByUpdatedAt(localPlaces, remotePlaces)
  await replaceAllPlaces(mergedPlaces)
  await pushDirtyPlaces(book.id, mergedPlaces)
  return 'ok'
}
