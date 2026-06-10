import { isMasterEncryptedData, type MasterEncryptedData } from './crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PreconfiguredAccount {
  name: string
  url: string
  username: string
  password: MasterEncryptedData
}

export interface CalinoConfig {
  version: number
  accounts: PreconfiguredAccount[]
}

// ─── Config loading ──────────────────────────────────────────────────────────

let cachedConfig: CalinoConfig | null | undefined

/**
 * Load self-hosted config from /calino.config.json.
 * Returns null if file doesn't exist or is invalid (not self-hosted mode).
 * Silent failure — no errors thrown for missing config.
 */
export async function loadConfig(): Promise<CalinoConfig | null> {
  // Return cached result if already loaded
  if (cachedConfig !== undefined) {
    return cachedConfig
  }

  try {
    const response = await fetch('/calino.config.json', {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      // File doesn't exist — not self-hosted mode
      cachedConfig = null
      return null
    }

    const data = await response.json()
    const config = validateConfig(data)

    if (!config) {
      console.warn('[configLoader] Invalid config file, ignoring')
      cachedConfig = null
      return null
    }

    cachedConfig = config
    return config
  } catch {
    // Network error, invalid JSON, etc. — silent failure
    cachedConfig = null
    return null
  }
}

/**
 * Reset cached config (for testing).
 */
export function resetConfigCache(): void {
  cachedConfig = undefined
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateConfig(data: unknown): CalinoConfig | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }

  const obj = data as Record<string, unknown>

  // Version must be 1
  if (obj.version !== 1) {
    return null
  }

  // Accounts must be an array
  if (!Array.isArray(obj.accounts)) {
    return null
  }

  const accounts: PreconfiguredAccount[] = []

  for (const account of obj.accounts) {
    const validated = validateAccount(account)
    if (!validated) {
      console.warn('[configLoader] Skipping invalid account entry')
      continue
    }
    accounts.push(validated)
  }

  if (accounts.length === 0) {
    return null
  }

  return { version: 1, accounts }
}

function validateAccount(data: unknown): PreconfiguredAccount | null {
  if (typeof data !== 'object' || data === null) {
    return null
  }

  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    return null
  }

  if (typeof obj.url !== 'string' || obj.url.trim() === '') {
    return null
  }

  if (typeof obj.username !== 'string' || obj.username.trim() === '') {
    return null
  }

  if (!isMasterEncryptedData(obj.password)) {
    return null
  }

  return {
    name: obj.name.trim(),
    url: obj.url.trim(),
    username: obj.username.trim(),
    password: obj.password,
  }
}
