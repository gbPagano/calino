import { v4 as uuidv4 } from 'uuid'
import { safeLocalStorage } from './storage'

/**
 * localStorage key under which the per-instance UUID is persisted.
 *
 * Note: uses a DOT separator (`calino.instanceId`), not a hyphen like the
 * `calino-` prefix that `safeLocalStorage.clear()` filters by. This is
 * intentional — a partial reset that only wipes `calino-`-prefixed keys
 * (e.g. clearing only app data) should NOT regenerate the instance ID,
 * or every shared CalDAV server would accumulate orphan settings events
 * from this user. The `Reset app` action uses raw `localStorage.clear()`
 * (see DataSettings.tsx) and DOES wipe this key, which is the only path
 * where regenerating the instance ID is acceptable.
 */
export const STORAGE_KEY_INSTANCE_ID = 'calino.instanceId'

/**
 * Stable per-instance identifier for Calino.
 *
 * Generated on first call and persisted to localStorage. Used to derive
 * per-instance UIDs (e.g. the SETTINGS_EVENT_UID) so two Calino instances
 * syncing to the same CalDAV server don't clobber each other's settings
 * events.
 *
 * If localStorage is unavailable (SSR / privacy-mode quota), falls back
 * to a fresh UUID per call — NOT shared across calls, NOT persisted. This
 * is intentionally degraded: without persistence the caller cannot
 * guarantee stability, but it also cannot accidentally collide with
 * another instance on the same server.
 */
export function getInstanceId(): string {
  try {
    const existing = safeLocalStorage.getItem(STORAGE_KEY_INSTANCE_ID)
    if (existing) return existing
    const fresh = uuidv4()
    safeLocalStorage.setItem(STORAGE_KEY_INSTANCE_ID, fresh)
    return fresh
  } catch {
    // Storage failure — at least give each call a unique value so two
    // users in this degraded state don't collide. The UID won't survive
    // reload, but that's the best we can do without storage.
    return uuidv4()
  }
}