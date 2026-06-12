import localforage from 'localforage'
import { toast as sonnerToast } from 'sonner'

const APP_KEY_PREFIX = 'calino-'
const STORAGE_NAME = 'calino'

let store: LocalForage | null = null
let driverReady: Promise<void> | null = null

function getStore(): LocalForage {
  if (!store) {
    store = localforage.createInstance({
      name: STORAGE_NAME,
      storeName: STORAGE_NAME,
      description: 'Calino persistent key-value storage',
    })
    // localforage's default driver order is [WEBSQL, INDEXEDDB, LOCALSTORAGE].
    // We use localStorage as the primary driver so the synchronous facade
    // below works (zustand's createJSONStorage requires a sync `getItem`).
    // IndexedDB remains an automatic fallback for quota-exceeded errors.
    driverReady = store.setDriver([
      localforage.LOCALSTORAGE,
      localforage.INDEXEDDB,
    ])
  }
  return store
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function handleStorageError(key: string, e: unknown): void {
  if (e instanceof DOMException || e instanceof Error) {
    const message =
      e instanceof DOMException && e.name === 'QuotaExceededError'
        ? 'Storage is full. Your data may not be saved.'
        : 'Storage error. Your data may not be saved.'
    console.error(`Storage error for key "${key}":`, e)
    sonnerToast.error(message)
  } else {
    console.error(`Storage error for key "${key}":`, e)
  }
}

/**
 * Storage facade that mirrors the Web Storage `Storage` interface so it
 * can be passed directly to zustand's `createJSONStorage(() => safeLocalStorage)`.
 * Delegates to `localforage` for the underlying driver, which gives us a
 * uniform API and a graceful IndexedDB fallback when localStorage is full.
 */
export const safeLocalStorage: Storage = {
  getItem(key: string): string | null {
    // Warm the localforage instance (sets drivers, runs migration). The actual
    // read goes straight to localStorage so the call is synchronous.
    getStore()
    const ls = getLocalStorage()
    if (!ls) return null
    try {
      return ls.getItem(key)
    } catch {
      return null
    }
  },

  setItem(key: string, value: string): void {
    getStore()
    const ls = getLocalStorage()
    if (!ls) return
    try {
      ls.setItem(key, value)
    } catch (e) {
      handleStorageError(key, e)
    }
  },

  removeItem(key: string): void {
    getStore()
    const ls = getLocalStorage()
    if (!ls) return
    try {
      ls.removeItem(key)
    } catch {
      /* ignore */
    }
  },

  clear(): void {
    getStore()
    const ls = getLocalStorage()
    if (!ls) return
    try {
      // Only clear keys belonging to this app, not all localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i)
        if (key && key.startsWith(APP_KEY_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => ls.removeItem(key))
    } catch {
      /* ignore */
    }
  },

  get length(): number {
    const ls = getLocalStorage()
    if (!ls) return 0
    try {
      return ls.length
    } catch {
      return 0
    }
  },

  key(index: number): string | null {
    const ls = getLocalStorage()
    if (!ls) return null
    try {
      return ls.key(index)
    } catch {
      return null
    }
  },
}

// Ensure the localforage driver configuration kicks off at module load
// so that any subsequent IndexedDB fallback is ready before the first quota
// error occurs. This is fire-and-forget; the sync facade does not wait.
void driverReady
