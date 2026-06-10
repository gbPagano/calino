import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadConfig, resetConfigCache, type CalinoConfig } from '../configLoader'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  resetConfigCache()
})

const validConfig: CalinoConfig = {
  version: 1,
  accounts: [
    {
      name: 'Personal',
      url: 'https://caldav.example.com/dav.php',
      username: 'user@example.com',
      password: {
        ciphertext: 'abc123',
        iv: 'def456',
        salt: 'ghi789',
      },
    },
  ],
}

describe('configLoader', () => {
  it('loads valid config', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validConfig),
    })

    const config = await loadConfig()
    expect(config).toEqual(validConfig)
    expect(mockFetch).toHaveBeenCalledWith('/calino.config.json', {
      headers: { Accept: 'application/json' },
    })
  })

  it('returns null when file not found', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null for invalid version', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: 2, accounts: [] }),
    })

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null for missing accounts array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: 1 }),
    })

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('returns null for empty accounts array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: 1, accounts: [] }),
    })

    const config = await loadConfig()
    expect(config).toBeNull()
  })

  it('skips invalid accounts and returns valid ones', async () => {
    const configWithInvalid = {
      version: 1,
      accounts: [
        { name: '', url: '', username: '', password: {} }, // invalid
        validConfig.accounts[0], // valid
      ],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(configWithInvalid),
    })

    const config = await loadConfig()
    expect(config).not.toBeNull()
    expect(config!.accounts).toHaveLength(1)
    expect(config!.accounts[0].name).toBe('Personal')
  })

  it('caches config after first load', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(validConfig),
    })

    await loadConfig()
    await loadConfig() // second call

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('caches null result for missing file', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    await loadConfig()
    await loadConfig() // second call

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('resetConfigCache clears cache', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validConfig),
    })

    await loadConfig()
    resetConfigCache()
    await loadConfig()

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
