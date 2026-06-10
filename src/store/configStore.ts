import { create } from 'zustand'
import { loadConfig, type CalinoConfig } from '../lib/configLoader'
import {
  decryptWithMasterPassword,
  encryptPassword,
  decryptPassword,
  isEncryptedPassword,
} from '../lib/crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DecryptedCredential {
  url: string
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
  decryptedCredentials: DecryptedCredential[]

  // Derived state
  isUnlocked: boolean
  hasPreconfiguredAccounts: boolean

  // Actions
  loadConfigFile: () => Promise<void>
  unlock: (masterPassword: string) => Promise<boolean>
  lock: () => Promise<void>
  getCredential: (accountUrl: string, username: string) => DecryptedCredential | null
  getDecryptedCredentials: () => DecryptedCredential[]
}

// ─── localStorage helpers (encrypted at rest) ───────────────────────────────

const MASTER_PASSWORD_KEY = 'calino.masterPassword'

async function getStoredMasterPassword(): Promise<string | null> {
  try {
    const raw = localStorage.getItem(MASTER_PASSWORD_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (isEncryptedPassword(parsed)) {
      return await decryptPassword(parsed)
    }
    return null
  } catch {
    return null
  }
}

async function setStoredMasterPassword(password: string | null): Promise<void> {
  try {
    if (password) {
      const encrypted = await encryptPassword(password)
      localStorage.setItem(MASTER_PASSWORD_KEY, JSON.stringify(encrypted))
    } else {
      localStorage.removeItem(MASTER_PASSWORD_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  config: null,
  configLoaded: false,
  masterPassword: null, // loaded async in loadConfigFile
  decryptedCredentials: [],
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
    const storedPassword = await getStoredMasterPassword()
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
      const decrypted: DecryptedCredential[] = []

      for (const account of config.accounts) {
        const [url, username, password] = await Promise.all([
          decryptWithMasterPassword(account.url, masterPassword),
          decryptWithMasterPassword(account.username, masterPassword),
          decryptWithMasterPassword(account.password, masterPassword),
        ])

        decrypted.push({ url, username, password })
      }

      // All decrypted successfully
      await setMasterPassword(masterPassword)
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
  lock: async () => {
    await setMasterPassword(null)
    set({
      masterPassword: null,
      decryptedCredentials: [],
      isUnlocked: false,
    })
  },

  /**
   * Get decrypted credential for an account (by URL + username).
   */
  getCredential: (accountUrl: string, username: string) => {
    const { decryptedCredentials } = get()
    return decryptedCredentials.find(
      (c) => c.url === accountUrl && c.username === username
    ) ?? null
  },

  /**
   * Get all decrypted credentials.
   */
  getDecryptedCredentials: () => {
    return get().decryptedCredentials
  },
}))

// ─── Persist master password ─────────────────────────────────────────────────

async function setMasterPassword(password: string | null): Promise<void> {
  await setStoredMasterPassword(password)
}
