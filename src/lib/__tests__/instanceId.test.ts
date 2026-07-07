import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Tests for getInstanceId — the per-browser-instance UUID used to derive
 * the Calino settings event UID.
 *
 * The implementation reads/writes `calino.instanceId` via `safeLocalStorage`,
 * so we mock `@/lib/storage` with a Map-backed shim. We intentionally do
 * NOT use `createLocalStorageMock` here because the real `safeLocalStorage.clear()`
 * filters by the `calino-` prefix and our shim needs to mirror that behavior
 * to keep Test 2 meaningful.
 */
const memoryStore = new Map<string, string>()

vi.mock('@/lib/storage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value)
    },
    removeItem: (key: string) => {
      memoryStore.delete(key)
    },
    // Mirror the real impl: only remove `calino-`-prefixed keys so the
    // instanceId (stored under `calino.instanceId`, with a dot) survives.
    clear: () => {
      for (const key of [...memoryStore.keys()]) {
        if (key.startsWith('calino-')) {
          memoryStore.delete(key)
        }
      }
    },
    get length() {
      return memoryStore.size
    },
    key: (index: number) => [...memoryStore.keys()][index] ?? null,
  },
}))

const { getInstanceId } = await import('../instanceId')
const { safeLocalStorage } = await import('@/lib/storage')

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('getInstanceId', () => {
  beforeEach(() => {
    memoryStore.clear()
  })

  it('returns the same value across two calls within a session', () => {
    // Arrange / Act
    const first = getInstanceId()
    const second = getInstanceId()

    // Assert: stable for the lifetime of one browser instance
    expect(second).toBe(first)
    // And the second call did not write a new value
    expect(memoryStore.size).toBe(1)
  })

  it('persists when safeLocalStorage.clear() is called (calino- prefix only)', () => {
    // Arrange: first call writes the instanceId under `calino.instanceId`
    // (note: a DOT, not a hyphen). safeLocalStorage.clear() only removes
    // keys with the `calino-` prefix (HYPHEN), so this key must survive.
    const first = getInstanceId()
    expect(memoryStore.get('calino.instanceId')).toBe(first)

    // Act
    safeLocalStorage.clear()

    // Assert: the instanceId key is untouched, and the next call returns
    // the same value (no fresh UUID generated)
    expect(memoryStore.get('calino.instanceId')).toBe(first)
    expect(getInstanceId()).toBe(first)
  })

  it('returns a fresh UUID after the underlying storage is fully cleared', () => {
    // Arrange: first call writes the instanceId
    const first = getInstanceId()

    // Act: simulate a fresh browser profile by wiping the backing Map
    memoryStore.clear()

    const second = getInstanceId()

    // Assert: a new UUID was generated
    expect(second).not.toBe(first)
    expect(second).toMatch(UUID_V4_RE)
  })

  it('returns a UUID v4 on first generation', () => {
    // Act
    const id = getInstanceId()

    // Assert: strict UUID v4 format — version nibble = 4, variant high bits = 8/9/a/b
    expect(id).toMatch(UUID_V4_RE)
  })

  it('produces different IDs for two separate storage states', () => {
    // Arrange / Act: each "browser profile" starts from a clean Map
    memoryStore.clear()
    const idA = getInstanceId()

    memoryStore.clear()
    const idB = getInstanceId()

    // Assert: independent storage states generate independent IDs
    expect(idA).not.toBe(idB)
    expect(idA).toMatch(UUID_V4_RE)
    expect(idB).toMatch(UUID_V4_RE)
  })
})