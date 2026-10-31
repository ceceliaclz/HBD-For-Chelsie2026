import { SHARED_INVITE_CODE } from './sync/syncEngine'

/** The shared book is already on this device, so the map can paint before the cloud answers. */
export function canShowSharedMap(
  ready: boolean,
  inviteCode: string | null | undefined,
): boolean {
  return ready && inviteCode === SHARED_INVITE_CODE
}
