/**
 * useSettingsSync — React hook for CalDAV settings sync.
 *
 * Follows the caldav-settings-sync-spec:
 *  - Uses a dedicated "Calino Settings" calendar collection
 *  - Settings stored as a single VEVENT with ATTACH;BASE64 payload
 *  - Conflict resolution via DTSTAMP comparison
 *  - Auto-discovery on account add
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import {
  serializeSettings,
  deserializeSettings,
  mergeSettings,
  resolveConflict,
  SETTINGS_CALENDAR_NAME,
  SETTINGS_EVENT_UID,
  getPrimaryAccountId,
  setPrimaryAccountId,
  getEtag,
  setEtag,
  getLastModified,
  touchLastModified,
  setLastSyncedAt,
  getLastSyncedAt,
  clearSyncKeys,
} from '@/lib/settingsSync'
import { createCalDAVClient } from '@/features/caldav/client/CalDAVClient'
import { getCredentialById } from '@/features/caldav/client/credentials'
import * as accountStorage from '@/features/caldav/sync/accountStorage'
import type { CalDAVAccount } from '@/features/caldav/types'

// ─── Toast helper ─────────────────────────────────────────────────────────────

function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message } }))
}

// ─── Return type ──────────────────────────────────────────────────────────────

interface UseSettingsSyncReturn {
  enabled: boolean
  syncing: boolean
  lastSyncAt: string | null
  error: string | null
  accounts: CalDAVAccount[]
  enable: (accountId: string) => Promise<void>
  disable: (deleteRemote?: boolean) => Promise<void>
  push: () => Promise<void>
  pull: () => Promise<void>
  /** Check for existing settings calendar on account add and auto-enable if found. */
  discoverSettings: (accountId: string) => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettingsSync(): UseSettingsSyncReturn {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<CalDAVAccount[]>([])
  const [, forceRender] = useState(0)

  const enabled = getPrimaryAccountId() !== null

  const lastLocalModRef = useRef<number>(getLastModified())
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Load accounts on mount
  useEffect(() => {
    setAccounts(accountStorage.getAllAccounts())
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Build the settings calendar URL for the given account. */
  async function resolveSettingsCalendarUrl(accountId: string): Promise<string | null> {
    const account = accountStorage.getAccountById(accountId)
    if (!account) return null
    const credential = await getCredentialById(account.credentialId)
    if (!credential) return null
    const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
    // Derive calendar home path from an existing calendar URL, then swap origin to the real server
    const calendars = accountStorage.getCalendarsByAccountId(accountId)
    if (calendars.length === 0) return null
    const storedCalUrl = new URL(calendars[0].url)
    const realServerUrl = new URL(account.serverUrl)
    const pathParts = storedCalUrl.pathname.split('/').filter(Boolean)
    pathParts.pop() // remove calendar name → gives us the calendar home path
    const homePath = '/' + pathParts.join('/') + '/'
    const calendarHomeUrl = realServerUrl.origin + homePath
    // Discover or create settings calendar
    const discovered = await client.discoverSettingsCalendar(calendarHomeUrl)
    return discovered?.url ?? null
  }

  /** Resolve conflict between local and remote, returning the winning settings. */
  function resolveAndMerge(
    localSettings: ReturnType<typeof useSettingsStore.getState>,
    remoteSettings: { settings: Partial<ReturnType<typeof useSettingsStore.getState>>; syncedAt: string },
    remoteDtstamp: string,
  ): ReturnType<typeof useSettingsStore.getState> {
    // Use lastSyncedAt (when we last successfully synced) instead of lastModified
    // This way remote wins if it was updated since our last sync
    const lastSynced = getLastSyncedAt() || '1970-01-01T00:00:00Z'
    const winner = resolveConflict(lastSynced, remoteDtstamp || remoteSettings.syncedAt)
    if (winner === 'remote') {
      return mergeSettings(localSettings, remoteSettings.settings)
    }
    return localSettings
  }

  // ── Core operations ─────────────────────────────────────────────────────────

  const push = useCallback(async (): Promise<void> => {
    if (!enabledRef.current) return
    const accountId = getPrimaryAccountId()
    if (!accountId) { setError('Sync not properly configured'); return }

    setSyncing(true); setError(null)
    try {
      const calUrl = await resolveSettingsCalendarUrl(accountId)
      if (!calUrl) { setError('Settings calendar not found'); return }

      const account = accountStorage.getAccountById(accountId)
      if (!account) { setError('Account not found'); return }
      const credential = await getCredentialById(account.credentialId)
      if (!credential) { setError('Credentials not found'); return }

      const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
      const json = serializeSettings()
      const base64 = btoa(json)
      const storedEtag = getEtag()
      const newEtag = await client.putSettingsEvent(calUrl, base64, storedEtag)
      if (newEtag) setEtag(newEtag)
      touchLastModified()
      // Don't setLastSyncedAt here — only pull sets it (represents when we last received remote)
      lastLocalModRef.current = Date.now()
      forceRender((n) => n + 1)
      console.log('[SettingsSync] Push successful')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      console.error('[SettingsSync] Push failed:', err)
      setError(msg)
      // ETag mismatch → pull then retry once
      if (msg.includes('412') || msg.includes('If-Match')) {
        await pull()
        try {
          const calUrl = await resolveSettingsCalendarUrl(getPrimaryAccountId()!)
          const account = accountStorage.getAccountById(getPrimaryAccountId()!)
          if (calUrl && account) {
            const credential = await getCredentialById(account.credentialId)
            if (credential) {
              const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
              const base64 = btoa(serializeSettings())
              const newEtag = await client.putSettingsEvent(calUrl, base64, getEtag() || undefined)
              setEtag(newEtag)
              touchLastModified()
              setError(null)
            }
          }
        } catch { /* give up */ }
      }
    } finally {
      setSyncing(false)
    }
  }, [])

  const pull = useCallback(async (): Promise<void> => {
    const accountId = getPrimaryAccountId()
    if (!accountId) { setError('Sync not properly configured'); return }

    setSyncing(true); setError(null)
    try {
      const calUrl = await resolveSettingsCalendarUrl(accountId)
      if (!calUrl) { setError('Settings calendar not found'); return }

      const account = accountStorage.getAccountById(accountId)
      if (!account) { setError('Account not found'); return }
      const credential = await getCredentialById(account.credentialId)
      if (!credential) { setError('Credentials not found'); return }

      const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
      const remote = await client.fetchSettingsEvent(calUrl)

      if (!remote) {
        // No remote event yet — push local
        await push()
        return
      }

      const json = client.extractSettingsFromVEVENT(remote.data)
      if (!json) {
        // Corrupted — push local to fix
        await push()
        return
      }

      const parsed = deserializeSettings(json)
      if (!parsed) {
        await push()
        return
      }

      // Convert iCalendar DTSTAMP (YYYYMMDDTHHMMSSZ) to ISO 8601 for Date parsing
      const dtstampIso = remote.dtstamp
        ? `${remote.dtstamp.slice(0, 4)}-${remote.dtstamp.slice(4, 6)}-${remote.dtstamp.slice(6, 8)}T${remote.dtstamp.slice(9, 11)}:${remote.dtstamp.slice(11, 13)}:${remote.dtstamp.slice(13, 15)}Z`
        : ''
      const localSettings = useSettingsStore.getState()
      const merged = resolveAndMerge(localSettings, parsed, dtstampIso)
      useSettingsStore.getState().updateSettings(merged)
      setEtag(remote.etag)
      setLastSyncedAt(new Date().toISOString())
      // Don't touchLastModified here — only when user changes settings locally
      lastLocalModRef.current = Date.now()
      forceRender((n) => n + 1)
      console.log('[SettingsSync] Pull successful')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed'
      console.error('[SettingsSync] Pull failed:', err)
      setError(msg)
    } finally {
      setSyncing(false)
    }
  }, [])

  // ── Enable / Disable ───────────────────────────────────────────────────────

  const enable = useCallback(async (accountId: string): Promise<void> => {
    setSyncing(true); setError(null)
    try {
      const account = accountStorage.getAccountById(accountId)
      if (!account) throw new Error('Account not found')
      const credential = await getCredentialById(account.credentialId)
      if (!credential) throw new Error('Credentials not found')

      const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)

      // Derive calendar home — use stored calendar URL path but real server origin
      const calendars = accountStorage.getCalendarsByAccountId(accountId)
      if (calendars.length === 0) throw new Error('No calendars found')
      const storedCalUrl = new URL(calendars[0].url)
      const realServerUrl = new URL(account.serverUrl)
      const parts = storedCalUrl.pathname.split('/').filter(Boolean)
      parts.pop()
      const homePath = '/' + parts.join('/') + '/'
      const calendarHomeUrl = realServerUrl.origin + homePath

      // Discover or create settings calendar
      let settingsCal = await client.discoverSettingsCalendar(calendarHomeUrl)
      let hasExistingSettings = false

      if (!settingsCal) {
        // Create fresh
        const newCalUrl = await client.createSettingsCalendar(calendarHomeUrl)
        settingsCal = { url: newCalUrl }
      } else {
        // Check if settings VEVENT already exists
        const existing = await client.fetchSettingsEvent(settingsCal.url)
        hasExistingSettings = !!existing
      }

      // Write the primary account ID so sync is considered active
      setPrimaryAccountId(accountId)

      if (hasExistingSettings) {
        // Pull existing remote settings first
        await pull()
      } else {
        // Push local settings
        await push()
      }

      // Store initial ETag + lastModified
      const freshRemote = await client.fetchSettingsEvent(settingsCal.url)
      if (freshRemote) {
        setEtag(freshRemote.etag)
      }
      // Don't touchLastModified here — only when user changes settings locally
      lastLocalModRef.current = Date.now()

      showToast('Settings sync enabled.')
      forceRender((n) => n + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable sync'
      console.error('[SettingsSync] Enable failed:', err)
      setError(msg)
      clearSyncKeys()
      throw err
    } finally {
      setSyncing(false)
    }
  }, [pull, push])

  const disable = useCallback(async (deleteRemote: boolean = false): Promise<void> => {
    const accountId = getPrimaryAccountId()

    if (deleteRemote && accountId) {
      try {
        const calUrl = await resolveSettingsCalendarUrl(accountId)
        const account = accountStorage.getAccountById(accountId)
        if (calUrl && account) {
          const credential = await getCredentialById(account.credentialId)
          if (credential) {
            const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
            await client.deleteSettingsCalendar(calUrl)
          }
        }
      } catch (err) {
        console.warn('[SettingsSync] Failed to delete remote calendar:', err)
      }
    }

    clearSyncKeys()
    forceRender((n) => n + 1)
    console.log('[SettingsSync] Disabled')
  }, [])

  // ── Auto-discovery on account add ──────────────────────────────────────────

  /**
   * Check if a Calino Settings calendar exists on the given account.
   * If found and sync is not yet active, auto-enable it.
   * Called from useCalDAV.addAccount after successful account creation.
   */
  const discoverSettings = useCallback(async (accountId: string): Promise<void> => {
    // Don't do anything if sync is already active
    if (getPrimaryAccountId()) return

    try {
      const account = accountStorage.getAccountById(accountId)
      if (!account) return
      const credential = await getCredentialById(account.credentialId)
      if (!credential) return

      const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)

      // Derive calendar home from stored calendar URLs but use real server origin
      const calendars = accountStorage.getCalendarsByAccountId(accountId)
      if (calendars.length === 0) return
      const storedCalUrl = new URL(calendars[0].url)
      const realServerUrl = new URL(account.serverUrl)
      const pathParts = storedCalUrl.pathname.split('/').filter(Boolean)
      pathParts.pop()
      const homePath = '/' + pathParts.join('/') + '/'
      const calendarHomeUrl = realServerUrl.origin + homePath

      const discovered = await client.discoverSettingsCalendar(calendarHomeUrl)
      if (!discovered) return

      // Settings calendar exists — auto-enable sync
      console.log('[SettingsSync] Settings calendar found, auto-enabling sync')
      setPrimaryAccountId(accountId)

      // Pull the settings
      await pull()

      // Store ETag
      const remote = await client.fetchSettingsEvent(discovered.url)
      if (remote) {
        setEtag(remote.etag)
      }
      // Don't touchLastModified here — only when user changes settings locally
      lastLocalModRef.current = Date.now()
      forceRender((n) => n + 1)

      showToast('Calino Settings found — sync enabled automatically.')
    } catch (err) {
      console.warn('[SettingsSync] Auto-discovery failed:', err)
    }
  }, [pull])

  // Note: pull is triggered from useCalDAV.syncAccount after calendar sync completes.
  // No pull-on-mount here — settings are synced as part of the normal CalDAV sync cycle.

  return {
    enabled,
    syncing,
    lastSyncAt: lastLocalModRef.current ? new Date(lastLocalModRef.current).toISOString() : null,
    error,
    accounts,
    enable,
    disable,
    push,
    pull,
    discoverSettings,
  }
}
