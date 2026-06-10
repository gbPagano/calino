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
  encodeBase64,
  deriveCalendarHomeUrl,
  dtstampToISO,
  getPrimaryAccountId,
  setPrimaryAccountId,
  getEtag,
  setEtag,
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
  discoverSettings: (accountId: string) => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettingsSync(): UseSettingsSyncReturn {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<CalDAVAccount[]>([])
  const [, forceRender] = useState(0)

  const enabled = getPrimaryAccountId() !== null

  const isMountedRef = useRef(true)
  const inFlightRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => { isMountedRef.current = false }
  }, [])

  // Load accounts on mount
  useEffect(() => {
    setAccounts(accountStorage.getAllAccounts())
  }, [])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function resolveSettingsCalendarUrl(accountId: string): Promise<string | null> {
    const account = accountStorage.getAccountById(accountId)
    if (!account) return null
    const credential = await getCredentialById(account.credentialId)
    if (!credential) return null
    const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
    const calendars = accountStorage.getCalendarsByAccountId(accountId)
    if (calendars.length === 0) return null
    const calendarHomeUrl = deriveCalendarHomeUrl(account.serverUrl, calendars[0].url)
    const discovered = await client.discoverSettingsCalendar(calendarHomeUrl)
    return discovered?.url ?? null
  }

  function resolveAndMerge(
    localSettings: ReturnType<typeof useSettingsStore.getState>,
    remoteSettings: { settings: Partial<ReturnType<typeof useSettingsStore.getState>>; syncedAt: string },
    remoteDtstamp: string,
  ): ReturnType<typeof useSettingsStore.getState> {
    const lastSynced = getLastSyncedAt() || '1970-01-01T00:00:00Z'
    const winner = resolveConflict(lastSynced, remoteDtstamp || remoteSettings.syncedAt)
    if (winner === 'remote') {
      return { ...localSettings, ...mergeSettings(localSettings, remoteSettings.settings) }
    }
    return localSettings
  }

  // ── Core operations ─────────────────────────────────────────────────────────

  // pull is defined before push so push can reference it in its dependency array
  const pull = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return
    const accountId = getPrimaryAccountId()
    if (!accountId) { setError('Sync not properly configured'); return }

    inFlightRef.current = true
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
        if (useSettingsStore.getState().caldavDebugMode) console.warn('[SettingsSync] No remote settings event found — nothing to pull')
        return
      }

      const json = client.extractSettingsFromVEVENT(remote.data)
      if (!json) {
        if (useSettingsStore.getState().caldavDebugMode) console.warn('[SettingsSync] Could not extract settings from remote VEVENT')
        return
      }

      const parsed = deserializeSettings(json)
      if (!parsed) {
        if (useSettingsStore.getState().caldavDebugMode) console.warn('[SettingsSync] Remote settings payload invalid or unsupported version')
        return
      }

      const dtstampIso = dtstampToISO(remote.dtstamp)
      const localSettings = useSettingsStore.getState()
      const merged = resolveAndMerge(localSettings, parsed, dtstampIso)
      useSettingsStore.getState().updateSettings(merged)
      setEtag(remote.etag)
      // Store the actual DTSTAMP from the server — shows when settings were truly last written
      setLastSyncedAt(dtstampIso || new Date().toISOString())
      if (isMountedRef.current) forceRender((n) => n + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed'
      console.error('[SettingsSync] Pull failed:', err)
      if (isMountedRef.current) setError(msg)
    } finally {
      inFlightRef.current = false
      setSyncing(false)
    }
  }, [])

  const push = useCallback(async (retryDepth = 0): Promise<void> => {
    if (inFlightRef.current) { if (useSettingsStore.getState().caldavDebugMode) console.warn('[SettingsSync] Push skipped — already in flight'); return }
    const accountId = getPrimaryAccountId()
    if (!accountId) { setError('Sync not properly configured'); return }

    inFlightRef.current = true
    setSyncing(true); setError(null)
    try {
      if (useSettingsStore.getState().caldavDebugMode) console.log('[SettingsSync] Push: resolving calendar URL...')
      const calUrl = await resolveSettingsCalendarUrl(accountId)
      if (!calUrl) { setError('Settings calendar not found'); return }
      if (useSettingsStore.getState().caldavDebugMode) console.log('[SettingsSync] Push: calendar URL =', calUrl)

      const account = accountStorage.getAccountById(accountId)
      if (!account) { setError('Account not found'); return }
      const credential = await getCredentialById(account.credentialId)
      if (!credential) { setError('Credentials not found'); return }

      const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
      const json = serializeSettings()
      const base64 = encodeBase64(json)
      const storedEtag = getEtag()
      if (useSettingsStore.getState().caldavDebugMode) console.log('[SettingsSync] Push: putting settings event, etag =', storedEtag)
      const newEtag = await client.putSettingsEvent(calUrl, base64, storedEtag ?? undefined)
      if (useSettingsStore.getState().caldavDebugMode) console.log('[SettingsSync] Push: success, new etag =', newEtag)
      if (newEtag) setEtag(newEtag)
      touchLastModified()
      setLastSyncedAt(new Date().toISOString())
      if (isMountedRef.current) {
        forceRender((n) => n + 1)
        showToast('Settings saved to server.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      console.error('[SettingsSync] Push failed:', err)
      if (isMountedRef.current) setError(msg)
      const is412 = msg.includes('412') || msg.includes('If-Match') || msg.includes('Precondition')
      if (retryDepth < 1 && is412) {
        if (useSettingsStore.getState().caldavDebugMode) console.log('[SettingsSync] Push: 412 detected, pulling then retrying...')
        // Temporarily release inFlightRef so pull() can run
        inFlightRef.current = false
        await pull()
        inFlightRef.current = true
        try {
          const calUrl = await resolveSettingsCalendarUrl(getPrimaryAccountId()!)
          const account = accountStorage.getAccountById(getPrimaryAccountId()!)
          if (calUrl && account) {
            const credential = await getCredentialById(account.credentialId)
            if (credential) {
              const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
              const base64 = encodeBase64(serializeSettings())
              const newEtag = await client.putSettingsEvent(calUrl, base64, getEtag() || undefined)
              setEtag(newEtag)
              touchLastModified()
              if (isMountedRef.current) setError(null)
            }
          }
        } catch { /* give up */ }
      }
    } finally {
      inFlightRef.current = false
      setSyncing(false)
    }
  }, [pull])

  // ── Enable / Disable ───────────────────────────────────────────────────────

  const enable = useCallback(async (accountId: string): Promise<void> => {
    setSyncing(true); setError(null)
    try {
      const account = accountStorage.getAccountById(accountId)
      if (!account) throw new Error('Account not found')
      const credential = await getCredentialById(account.credentialId)
      if (!credential) throw new Error('Credentials not found')

      const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
      const calendars = accountStorage.getCalendarsByAccountId(accountId)
      if (calendars.length === 0) throw new Error('No calendars found')
      const calendarHomeUrl = deriveCalendarHomeUrl(account.serverUrl, calendars[0].url)

      let settingsCal = await client.discoverSettingsCalendar(calendarHomeUrl)
      let hasExistingSettings = false

      if (!settingsCal) {
        const newCalUrl = await client.createSettingsCalendar(calendarHomeUrl)
        settingsCal = { url: newCalUrl }
      } else {
        const existing = await client.fetchSettingsEvent(settingsCal.url)
        hasExistingSettings = !!existing
      }

      setPrimaryAccountId(accountId)

      if (hasExistingSettings) {
        await pull()
      } else {
        const json = serializeSettings()
        const base64 = encodeBase64(json)
        const newEtag = await client.putSettingsEvent(settingsCal!.url, base64, undefined, null)
        if (newEtag) setEtag(newEtag)
        touchLastModified()
      }

      showToast('Settings sync enabled.')
      if (isMountedRef.current) forceRender((n) => n + 1)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable sync'
      console.error('[SettingsSync] Enable failed:', err)
      if (isMountedRef.current) setError(msg)
      clearSyncKeys()
      throw err
    } finally {
      setSyncing(false)
    }
  }, [pull])

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
    if (isMountedRef.current) forceRender((n) => n + 1)
  }, [])

  // ── Auto-discovery on account add ──────────────────────────────────────────

  const discoverSettings = useCallback(async (accountId: string): Promise<void> => {
    if (getPrimaryAccountId()) return

    try {
      const account = accountStorage.getAccountById(accountId)
      if (!account) return
      const credential = await getCredentialById(account.credentialId)
      if (!credential) return

      const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
      const calendars = accountStorage.getCalendarsByAccountId(accountId)
      if (calendars.length === 0) return
      const calendarHomeUrl = deriveCalendarHomeUrl(account.serverUrl, calendars[0].url)

      const discovered = await client.discoverSettingsCalendar(calendarHomeUrl)
      if (!discovered) return

      setPrimaryAccountId(accountId)
      await pull()

      const remote = await client.fetchSettingsEvent(discovered.url)
      if (remote) {
        setEtag(remote.etag)
      }
      if (isMountedRef.current) forceRender((n) => n + 1)

      showToast('Calino Settings found — sync enabled automatically.')
    } catch (err) {
      console.warn('[SettingsSync] Auto-discovery failed:', err)
    }
  }, [pull])

  return {
    enabled,
    syncing,
    lastSyncAt: getLastSyncedAt() || null,
    error,
    accounts,
    enable,
    disable,
    push,
    pull,
    discoverSettings,
  }
}
