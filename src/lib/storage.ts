const APP_KEY_PREFIX = 'calino-'

function handleStorageError(key: string, e: unknown): void {
  if (e instanceof DOMException) {
    const message =
      e.name === 'QuotaExceededError'
        ? 'Storage is full. Your data may not be saved.'
        : 'Storage error. Your data may not be saved.'
    console.error(`Storage error for key "${key}":`, e)
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message },
      })
    )
  } else {
    console.error(`Storage error for key "${key}":`, e)
  }
}

export const safeLocalStorage: Storage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      handleStorageError(key, e)
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  clear(): void {
    try {
      // Only clear keys belonging to this app, not all localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(APP_KEY_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
    } catch {
      /* ignore */
    }
  },
  get length(): number {
    try {
      return localStorage.length
    } catch {
      return 0
    }
  },
  key(index: number): string | null {
    try {
      return localStorage.key(index)
    } catch {
      return null
    }
  },
}
