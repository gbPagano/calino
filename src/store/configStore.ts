import { create } from 'zustand'
import { loadConfig, type CalinoConfig } from '../lib/configLoader'
import { decryptWithMasterPassword } from '../lib/crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DecryptedCredential {
  username: string
  password: string
}

interface ConfigState {
  // Config file data
  config: CalinoConfig | null
  configLoaded: boolean

  // Master password
  masterPassword: string | null

  // Decrypted credentials (memory only — never persisted)
  decryptedCredentials: Map<string, DecryptedCredential>

  // Derived state
  isUnlocked: boolean
  hasPreconfiguredAccounts: boolean

  // Actions
  loadConfigFile: () => Promise<void>
  unlock: (masterPassword: string) => Promise<boolean>
  lock: () => void
  getCredential: (accountUrl: string, username: string) => DecryptedCredential | null
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const MASTER_PASSWORD_KEY = 'calino.masterPassword'

function getStoredMasterPassword(): string | null {
  try {
    return localStorage.getItem(MASTER_PASSWORD_KEY)
  } catch {
    return null
  }
}

function setStoredMasterPassword(password: string | null): void {
  try {
    if (password) {
      localStorage.setItem(MASTER_PASSWORD_KEY, password)
    } else {
      localStorage.removeItem(MASTER_PASSWORD_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

// ─── Account key ─────────────────────────────────────────────────────────────

function accountKey(url: string, username: string): string {
  return `${url}|${username}`
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  config: null,
  configLoaded: false,
  masterPassword: getStoredMasterPassword(),
  decryptedCredentials: new Map(),
  isUnlocked: false,
  hasPreconfiguredAccounts: false,

  /**
   * Load the config file. Call once on app mount.
   */
  loadConfigFile: async () => {
    const config = await loadConfig()

    if (!config) {
      set({ config: null, configLoaded: true, hasPreconfiguredAccounts: false })
      return
    }

    set({
      config,
      configLoaded: true,
      hasPreconfiguredAccounts: config.accounts.length > 0,
    })

    // Auto-unlock if master password is stored
    const storedPassword = getStoredMasterPassword()
    if (storedPassword) {
      await get().unlock(storedPassword)
    }
  },

  /**
   * Unlock with master password. Returns true if successful.
   */
  unlock: async (masterPassword: string) => {
    const { config } = get()

    if (!config) {
      return false
    }

    try {
      // Try to decrypt all accounts
      const decrypted = new Map<string, DecryptedCredential>()

      for (const account of config.accounts) {
        const password = await decryptWithMasterPassword(
          account.password,
          masterPassword
        )

        decrypted.set(accountKey(account.url, account.username), {
          username: account.username,
          password,
        })
      }

      // All decrypted successfully
      setMasterPassword(masterPassword)
      set({
        masterPassword,
        decryptedCredentials: decrypted,
        isUnlocked: true,
      })

      return true
    } catch {
      // Wrong password or corrupted data
      return false
    }
  },

  /**
   * Lock — clear decrypted credentials from memory.
   */
  lock: () => {
    setMasterPassword(null)
    set({
      masterPassword: null,
      decryptedCredentials: new Map(),
      isUnlocked: false,
    })
  },

  /**
   * Get decrypted credential for an account.
   */
  getCredential: (accountUrl: string, username: string) => {
    const { decryptedCredentials } = get()
    return decryptedCredentials.get(accountKey(accountUrl, username)) ?? null
  },
}))

// ─── Persist master password ─────────────────────────────────────────────────

function setMasterPassword(password: string | null): void {
  setStoredMasterPassword(password)
}
