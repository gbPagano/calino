import { isMasterEncryptedData, type MasterEncryptedData } from './crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PreconfiguredAccount {
  name: string
  url: MasterEncryptedData
  username: MasterEncryptedData
  password: MasterEncryptedData
}

export interface CalinoConfig {
  version: number
  accounts: PreconfiguredAccount[]
}

// ─── Global constant injected at build time ──────────────────────────────────

declare const __CALINO_CONFIG__: Record<string, unknown> | null

// ─── Config loading ──────────────────────────────────────────────────────────

let cachedConfig: CalinoConfig | null | undefined

/**
 * Load self-hosted config.
 * The config is baked into the JS bundle at build time (not served as a separate file).
 * Returns null if no config was provided at build time (not self-hosted mode).
 */
export async function loadConfig(): Promise<CalinoConfig | null> {
  // Return cached result if already loaded
  if (cachedConfig !== undefined) {
    return cachedConfig
  }

  // __CALINO_CONFIG__ is injected by Vite's define at build time
  // It's null if calino.config.json doesn't exist
  if (typeof __CALINO_CONFIG__ === 'undefined' || __CALINO_CONFIG__ === null) {
    cachedConfig = null
    return null
  }

  const config = validateConfig(__CALINO_CONFIG__)

  if (!config) {
    console.warn('[configLoader] Invalid config, ignoring')
    cachedConfig = null
    return null
  }

  cachedConfig = config
  return config
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

  if (!isMasterEncryptedData(obj.url)) {
    return null
  }

  if (!isMasterEncryptedData(obj.username)) {
    return null
  }

  if (!isMasterEncryptedData(obj.password)) {
    return null
  }

  return {
    name: obj.name.trim(),
    url: obj.url,
    username: obj.username,
    password: obj.password,
  }
}
