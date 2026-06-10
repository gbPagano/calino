import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  serializeSettings,
  deserializeSettings,
  mergeSettings,
  resolveConflict,
  SETTINGS_EVENT_UID,
  SETTINGS_CALENDAR_NAME,
  getPrimaryAccountId,
  setPrimaryAccountId,
  getEtag,
  setEtag,
  getLastModified,
  touchLastModified,
  clearSyncKeys,
  isSyncEnabled,
  SYNC_FORMAT_VERSION,
  type SettingsSyncPayload,
} from '../settingsSync'
import { useSettingsStore } from '@/store/settingsStore'

describe('settingsSync', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    storage.clear()
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => storage.get(key) ?? null)
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => { storage.set(key, value) })
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { storage.delete(key) })
    vi.mocked(localStorage.clear).mockImplementation(() => { storage.clear() })
    useSettingsStore.getState().resetSettings()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('serializeSettings', () => {
    it('should produce valid JSON with version and syncedAt', () => {
      const json = serializeSettings()
      const parsed = JSON.parse(json) as SettingsSyncPayload
      expect(parsed.version).toBe(SYNC_FORMAT_VERSION)
      expect(parsed.syncedAt).toBeDefined()
      expect(parsed.settings).toBeDefined()
    })

    it('should only include syncable fields', () => {
      const parsed = JSON.parse(serializeSettings()) as SettingsSyncPayload
      expect(parsed.settings.timezone).toBeDefined()
      expect(parsed.settings.syncEnabled).toBeUndefined()
      expect(parsed.settings.caldavDebugMode).toBeUndefined()
    })

    it('should reflect current store values', () => {
      useSettingsStore.getState().updateSettings({ timezone: 'Asia/Tokyo', themeMode: 'dark' })
      const parsed = JSON.parse(serializeSettings()) as SettingsSyncPayload
      expect(parsed.settings.timezone).toBe('Asia/Tokyo')
      expect(parsed.settings.themeMode).toBe('dark')
    })
  })

  describe('deserializeSettings', () => {
    it('should parse valid JSON', () => {
      const payload: SettingsSyncPayload = {
        version: SYNC_FORMAT_VERSION,
        syncedAt: '2025-01-01T00:00:00Z',
        settings: { timezone: 'UTC' },
      }
      const result = deserializeSettings(JSON.stringify(payload))
      expect(result).not.toBeNull()
      expect(result?.settings.timezone).toBe('UTC')
    })

    it('should return null for wrong version', () => {
      const payload = { version: 999, syncedAt: '', settings: {} }
      expect(deserializeSettings(JSON.stringify(payload))).toBeNull()
    })

    it('should return null for invalid JSON', () => {
      expect(deserializeSettings('not json')).toBeNull()
    })

    it('should return null for missing settings', () => {
      const payload = { version: SYNC_FORMAT_VERSION, syncedAt: '' }
      expect(deserializeSettings(JSON.stringify(payload))).toBeNull()
    })
  })

  describe('mergeSettings', () => {
    it('should overlay remote syncable fields onto local', () => {
      const local = useSettingsStore.getState()
      const remote = { timezone: 'Pacific/Auckland', themeMode: 'light' as const }
      const merged = mergeSettings(local, remote)
      expect(merged.timezone).toBe('Pacific/Auckland')
      expect(merged.themeMode).toBe('light')
      expect(merged.dateFormat).toBe(local.dateFormat)
    })

    it('should ignore non-syncable remote fields', () => {
      const local = useSettingsStore.getState()
      const remote = { syncEnabled: false, caldavDebugMode: true } as Record<string, unknown>
      const merged = mergeSettings(local, remote as Parameters<typeof mergeSettings>[1])
      expect(merged.syncEnabled).toBe(local.syncEnabled)
      expect(merged.caldavDebugMode).toBe(local.caldavDebugMode)
    })
  })

  describe('resolveConflict', () => {
    it('should pick remote when remote is more recent', () => {
      expect(resolveConflict('2025-01-01T00:00:00Z', '2025-06-01T00:00:00Z')).toBe('remote')
    })
    it('should pick local when local is more recent', () => {
      expect(resolveConflict('2025-06-01T00:00:00Z', '2025-01-01T00:00:00Z')).toBe('local')
    })
    it('should return equal when timestamps match', () => {
      expect(resolveConflict('2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')).toBe('equal')
    })
  })

  describe('constants', () => {
    it('should have the fixed settings UID', () => {
      expect(SETTINGS_EVENT_UID).toBe('00000000-calino-0000-calino-000000000000')
    })
    it('should have the calendar internal name', () => {
      expect(SETTINGS_CALENDAR_NAME).toBe('calino-settings')
    })
  })

  describe('localStorage helpers', () => {
    it('should manage primaryAccountId', () => {
      expect(getPrimaryAccountId()).toBeNull()
      setPrimaryAccountId('abc')
      expect(getPrimaryAccountId()).toBe('abc')
      setPrimaryAccountId(null)
      expect(getPrimaryAccountId()).toBeNull()
    })

    it('should manage etag', () => {
      expect(getEtag()).toBeNull()
      setEtag('"xyz"')
      expect(getEtag()).toBe('"xyz"')
      setEtag(null)
      expect(getEtag()).toBeNull()
    })

    it('should manage lastModified', () => {
      expect(getLastModified()).toBe(0)
      touchLastModified()
      expect(getLastModified()).toBeGreaterThan(0)
    })

    it('should clear all sync keys', () => {
      setPrimaryAccountId('x')
      setEtag('"y"')
      touchLastModified()
      clearSyncKeys()
      expect(getPrimaryAccountId()).toBeNull()
      expect(getEtag()).toBeNull()
      expect(getLastModified()).toBe(0)
    })

    it('isSyncEnabled should reflect primaryAccountId', () => {
      expect(isSyncEnabled()).toBe(false)
      setPrimaryAccountId('x')
      expect(isSyncEnabled()).toBe(true)
      setPrimaryAccountId(null)
      expect(isSyncEnabled()).toBe(false)
    })
  })
})
