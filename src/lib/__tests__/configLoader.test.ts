import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadConfig, resetConfigCache, type CalinoConfig } from '../configLoader'

const validConfig: CalinoConfig = {
  version: 1,
  accounts: [
    {
      name: 'Personal',
      url: { ciphertext: 'url-encrypted', iv: 'url-iv', salt: 'url-salt' },
      username: { ciphertext: 'user-encrypted', iv: 'user-iv', salt: 'user-salt' },
      password: {
        ciphertext: 'abc123',
        iv: 'def456',
        salt: 'ghi789',
      },
    },
  ],
}

// Save original global
const originalGlobal = globalThis as Record<string, unknown>

beforeEach(() => {
  resetConfigCache()
})

afterEach(() => {
  // Restore original
  if ('__CALINO_CONFIG__' in originalGlobal) {
    delete originalGlobal.__CALINO_CONFIG__
  }
})

describe('configLoader', () => {
  it('loads valid config from global', async () => {
    originalGlobal.__CALINO_CONFIG__ = validConfig

    const config = await loadConfig()
    expect(config).toEqual(validConfig)
  })

  it('returns null when no config injected', async () => {
    delete originalGlobal.__CALINO_CONFIG__

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null when global is null', async () => {
    originalGlobal.__CALINO_CONFIG__ = null

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null for invalid version', async () => {
    originalGlobal.__CALINO_CONFIG__ = { version: 2, accounts: [] }

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null for missing accounts array', async () => {
    originalGlobal.__CALINO_CONFIG__ = { version: 1 }

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null for empty accounts array', async () => {
    originalGlobal.__CALINO_CONFIG__ = { version: 1, accounts: [] }

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('skips invalid accounts and returns valid ones', async () => {
    originalGlobal.__CALINO_CONFIG__ = {
      version: 1,
      accounts: [
        { name: '', url: {}, username: {}, password: {} }, // invalid
        validConfig.accounts[0], // valid
      ],
    }

    const config = await loadConfig()
    expect(config).not.toBeNull()
    expect(config!.accounts).toHaveLength(1)
    expect(config!.accounts[0].name).toBe('Personal')
  })

  it('caches config after first load', async () => {
    originalGlobal.__CALINO_CONFIG__ = validConfig

    const a = await loadConfig()
    const b = await loadConfig()

    expect(a).toBe(b) // same reference
  })

  it('resetConfigCache clears cache', async () => {
    originalGlobal.__CALINO_CONFIG__ = validConfig

    await loadConfig()
    resetConfigCache()
    const config = await loadConfig()

    expect(config).toEqual(validConfig) // re-validated
  })
})
