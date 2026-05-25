function handleQuotaError(key: string, e: unknown): void {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') {
    console.error(`LocalStorage quota exceeded for key "${key}"`)
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message: 'Storage is full. Your data may not be saved.' },
      })
    )
  } else {
    throw e
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
      handleQuotaError(key, e)
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
      localStorage.clear()
    } catch {
      /* ignore */
    }
  },
  get length(): number {
    return localStorage.length
  },
  key(index: number): string | null {
    try {
      return localStorage.key(index)
    } catch {
      return null
    }
  },
}
