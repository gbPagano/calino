import { useState, useCallback, useEffect } from 'react'
import { addDays } from 'date-fns'
import type { CalendarEvent } from '@/types'
import type { CalDAVAccount, CalDAVCalendar, SyncState } from '../types'
import { createCalDAVClient } from '../client/CalDAVClient'
import { testConnection, discoverServerUrl } from '../client/discovery'
import { saveCredentials, getCredentialById, deleteCredential } from '../client/credentials'
import { parseICALData, isUUID } from '../adapter/iCalendarAdapter'
import * as storage from '../sync/accountStorage'
import { SyncEngine } from '../sync/syncEngine'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { EVENT_COLORS } from '@/store/settingsStore'
import {
  selectAddEvent,
  selectUpdateEvent,
  selectDeleteEvent,
  selectAddCalendar,
  selectDeleteCalendar,
  selectUpdateCalendar,
  selectCalendars,
  selectAddCategory,
} from '@/store/calendarStore'

const selectCalDavDebugMode = (state: { caldavDebugMode: boolean }) => state.caldavDebugMode
const selectConflictResolution = (state: { conflictResolution: string }) => state.conflictResolution

function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message } }))
}

interface UseCalDAVReturn {
  accounts: CalDAVAccount[]
  calendars: CalDAVCalendar[]
  syncState: SyncState
  addAccount: (
    serverUrl: string,
    username: string,
    password: string,
    name: string,
    proxyUrl?: string | null
  ) => Promise<void>
  removeAccount: (accountId: string) => Promise<void>
  syncAccount: (accountId: string) => Promise<void>
  syncAll: () => Promise<void>
  createEvent: (calendarId: string, event: CalendarEvent) => Promise<void>
  updateEvent: (calendarId: string, event: CalendarEvent) => Promise<void>
  deleteEvent: (calendarId: string, eventId: string) => Promise<void>
}

export function useCalDAV(): UseCalDAVReturn {
  const [accounts, setAccounts] = useState<CalDAVAccount[]>([])
  const [calendars, setCalendars] = useState<CalDAVCalendar[]>([])
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncAt: null,
    error: null,
    pendingChanges: 0,
  })

  const storeAddEvent = useCalendarStore(selectAddEvent)
  const storeUpdateEvent = useCalendarStore(selectUpdateEvent)
  const storeDeleteEvent = useCalendarStore(selectDeleteEvent)
  const storeAddCalendar = useCalendarStore(selectAddCalendar)
  const storeDeleteCalendar = useCalendarStore(selectDeleteCalendar)
  const storeUpdateCalendar = useCalendarStore(selectUpdateCalendar)
  const storeCalendars = useCalendarStore(selectCalendars)
  const storeAddCategory = useCalendarStore(selectAddCategory)
  const caldavDebugMode = useSettingsStore(selectCalDavDebugMode)
  const conflictResolution = useSettingsStore(selectConflictResolution)

  // Process any pending changes that failed in previous sessions
  const processPendingChanges = useCallback(async (): Promise<void> => {
    const changes = storage.getPendingChanges()
    if (changes.length === 0) return

    console.log(`[CalDAV] Processing ${changes.length} pending changes...`)

    const allCalendars = storage.getAllCalendars()
    const allAccounts = storage.getAllAccounts()

    let succeeded = 0
    let failed = 0

    for (const change of changes) {
      try {
        const calendar = allCalendars.find((c) => c.id === change.calendarId)
        const account = allAccounts.find((a) => a.id === calendar?.accountId)

        if (!calendar || !account) {
          failed++
          storage.updatePendingChangeRetry(change.id)
          continue
        }

        const credential = getCredentialById(account.credentialId)
        if (!credential) {
          failed++
          storage.updatePendingChangeRetry(change.id)
          continue
        }

        const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
        const engine = new SyncEngine(client, change.calendarId)

        switch (change.type) {
          case 'create': {
            const event = JSON.parse(change.data || '{}') as CalendarEvent
            await engine.pushEvent({ ...event, sequence: 0 })
            break
          }
          case 'update': {
            const event = JSON.parse(change.data || '{}') as CalendarEvent
            await engine.updateEvent(event, event.etag || '')
            break
          }
          case 'delete': {
            const eventUrl = `${calendar.url}${change.eventId}.ics`
            await engine.deleteEvent(eventUrl, '')
            break
          }
        }

        storage.removePendingChange(change.id)
        succeeded++
      } catch {
        storage.updatePendingChangeRetry(change.id)
        failed++
      }
    }

    const remaining = storage.getPendingChanges()
    setSyncState((prev) => ({ ...prev, pendingChanges: remaining.length }))

    console.log(
      `[CalDAV] Pending changes processed: ${succeeded} succeeded, ${failed} failed, ${remaining.length} remaining`
    )
  }, [])

  // Retry pending changes on mount and on a 30-second interval
  useEffect(() => {
    processPendingChanges()

    const interval = setInterval(() => {
      processPendingChanges()
    }, 30000)
    return () => clearInterval(interval)
  }, [processPendingChanges])

  useEffect(() => {
    const loadedAccounts = storage.getAllAccounts()
    const loadedCalendars = storage.getAllCalendars()
    setAccounts(loadedAccounts)
    setCalendars(loadedCalendars)

    const existingIds = storeCalendars.map((c) => c.id)
    for (const cal of loadedCalendars) {
      if (!existingIds.includes(cal.id)) {
        storeAddCalendar({
          id: cal.id,
          name: cal.name,
          color: cal.color,
          isVisible: cal.isVisible,
          isDefault: cal.isDefault,
          accountId: cal.accountId,
          showTasksInViews: true,
        })
      }
    }

    const pending = storage.getPendingChanges()
    setSyncState((prev) => ({ ...prev, pendingChanges: pending.length }))
  }, [])

  const addAccount = useCallback(
    async (
      serverUrl: string,
      username: string,
      password: string,
      name: string,
      proxyUrl?: string | null
    ): Promise<void> => {
      setSyncState((prev) => ({ ...prev, status: 'syncing', error: null }))

      try {
        const discoveredUrl = await discoverServerUrl(serverUrl, proxyUrl ?? undefined)

        const connected = await testConnection(discoveredUrl, { username, password }, proxyUrl)

        if (!connected) {
          throw new Error('Failed to connect to server. Please check your credentials.')
        }

        const credential = saveCredentials({
          serverUrl: discoveredUrl,
          username,
          password,
        })

        const client = await createCalDAVClient(discoveredUrl, credential, proxyUrl)
        const serverCalendars = await client.fetchCalendars()

        const newAccount = storage.saveAccount({
          name,
          serverUrl: discoveredUrl,
          proxyUrl: proxyUrl || null,
          username,
          credentialId: credential.id,
        })

        for (const cal of serverCalendars) {
          storage.saveCalendar({
            ...cal,
            accountId: newAccount.id,
          })
          storeAddCalendar({
            id: cal.id,
            name: cal.name,
            color: cal.color,
            isVisible: cal.isVisible,
            isDefault: cal.isDefault,
            accountId: newAccount.id,
            showTasksInViews: true,
          })
        }

        const storedCalendars = storage.getAllCalendars()
        const allCalendarsInStore = useCalendarStore.getState().calendars
        if (serverCalendars.length > 0) {
          for (const cal of allCalendarsInStore) {
            if (cal.isDefault) {
              storeUpdateCalendar(cal.id, { isDefault: false })
            }
          }
          for (const cal of storedCalendars) {
            if (cal.isDefault) {
              storage.updateCalendar(cal.id, { isDefault: false })
            }
          }
          const firstCal = serverCalendars[0]
          const storeCalId = storedCalendars.find((c) => c.url === firstCal.url)?.id
          if (storeCalId) {
            storeUpdateCalendar(storeCalId, { isDefault: true })
            storage.updateCalendar(storeCalId, { isDefault: true })
          }
        }

        setAccounts(storage.getAllAccounts())
        setCalendars(storage.getAllCalendars())

        // Read fresh state at call time to avoid stale closures
        const accountState = useCalendarStore.getState()
        const accountExistingEvents = accountState.events
        const accountStoreCategories = accountState.categories

        const start = '1970-01-01T00:00:00.000Z'
        const end = addDays(new Date(), 365).toISOString()
        const newCategoryNames: string[] = []

        for (const cal of serverCalendars) {
          const fetchedEvents = await client.fetchEvents(cal.url, start, end)

          for (const eventData of fetchedEvents) {
            if (eventData.data) {
              const parsedEvents = parseICALData(eventData.data, cal.id)

              for (const parsedEvent of parsedEvents) {
                if (parsedEvent.categories) {
                  for (const catName of parsedEvent.categories) {
                    if (isUUID(catName)) continue
                    const existingCat = accountStoreCategories.find((c) => c.name === catName)
                    if (!existingCat && !newCategoryNames.includes(catName)) {
                      newCategoryNames.push(catName)
                    }
                  }
                }

                const existingIndex = accountExistingEvents.findIndex((e) => e.id === parsedEvent.id)

                if (existingIndex >= 0) {
                  storeUpdateEvent(parsedEvent.id, parsedEvent)
                } else {
                  storeAddEvent(parsedEvent)
                }
              }
            }
          }
        }

        for (const catName of newCategoryNames) {
          storeAddCategory({
            id: crypto.randomUUID(),
            name: catName,
            color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
          })
        }

        storage.updateAccountLastSync(newAccount.id)
        processPendingChanges()

        setSyncState((prev) => ({
          ...prev,
          status: 'idle',
          lastSyncAt: new Date().toISOString(),
        }))
      } catch (error) {
        setSyncState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to add account',
        }))
        throw error
      }
    },
    [storeAddEvent, storeUpdateEvent]
  )

  const removeAccount = useCallback(async (accountId: string): Promise<void> => {
    const account = storage.getAccountById(accountId)
    if (account) {
      deleteCredential(account.credentialId)
      const accountCalendars = storage.getCalendarsByAccountId(accountId)
      for (const cal of accountCalendars) {
        storeDeleteCalendar(cal.id)
      }
      storage.deleteCalendarsByAccountId(accountId)
      storage.deleteAccount(accountId)

      setAccounts(storage.getAllAccounts())
      setCalendars(storage.getAllCalendars())
    }
  }, [])

  const syncAccount = useCallback(
    async (accountId: string): Promise<void> => {
      const account = storage.getAccountById(accountId)
      if (!account) {
        return
      }

      setSyncState((prev) => ({ ...prev, status: 'syncing', error: null }))

      try {
        const credential = getCredentialById(account.credentialId)
        if (!credential) {
          throw new Error('Credentials not found')
        }

        const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
        const accountCalendars = storage.getCalendarsByAccountId(accountId)

        const start = '1970-01-01T00:00:00.000Z'
        const end = addDays(new Date(), 365).toISOString()

        // Read fresh state at call time to avoid stale closures
        const state = useCalendarStore.getState()
        const currentEvents = state.events
        const currentCategories = state.categories

        for (const cal of accountCalendars) {
          const fetchedEvents = await client.fetchEvents(cal.url, start, end)

          // Get events that belong to this calendar
          const calendarEvents = currentEvents.filter((e) => e.calendarId === cal.id)
          const serverEventIds = new Set<string>()
          const newCategoryNames: string[] = []

          for (const eventData of fetchedEvents) {
            if (eventData.data) {
              const parsedEvents = parseICALData(eventData.data, cal.id)

              for (const parsedEvent of parsedEvents) {
                serverEventIds.add(parsedEvent.id)

                // Collect category names for auto-creation
                if (parsedEvent.categories) {
                  for (const catName of parsedEvent.categories) {
                    if (isUUID(catName)) continue
                    const existingCat = currentCategories.find((c) => c.name === catName)
                    if (!existingCat && !newCategoryNames.includes(catName)) {
                      newCategoryNames.push(catName)
                    }
                  }
                }

                const existingIndex = calendarEvents.findIndex((e) => e.id === parsedEvent.id)
                const existingEvent = existingIndex >= 0 ? calendarEvents[existingIndex] : null

                if (existingEvent) {
                  const serverSeq = parsedEvent.sequence ?? 0
                  const localSeq = existingEvent.sequence ?? 0

                  let shouldUpdate = false

                  if (serverSeq > localSeq) {
                    shouldUpdate = conflictResolution === 'server-wins'
                  } else if (localSeq > serverSeq) {
                    shouldUpdate = conflictResolution === 'local-wins'
                  } else {
                    shouldUpdate = true
                  }

                  if (shouldUpdate) {
                    const cleanedCategories = parsedEvent.categories?.filter((c) => !isUUID(c))
                    storeUpdateEvent(parsedEvent.id, { ...parsedEvent, categories: cleanedCategories })
                  }
                } else {
                  const cleanedCategories = parsedEvent.categories?.filter((c) => !isUUID(c))
                  storeAddEvent({ ...parsedEvent, categories: cleanedCategories })
                }
              }
            }
          }

          // Auto-create categories from server
          for (const catName of newCategoryNames) {
            storeAddCategory({
              id: crypto.randomUUID(),
              name: catName,
              color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
            })
          }

          // Delete events that exist locally but not on server,
          // but ONLY events whose start date falls within the queried range.
          // Events outside this range may not have been returned by the server
          // (pagination, date-filter truncation, far-future recurrence instances).
          for (const localEvent of calendarEvents) {
            if (!serverEventIds.has(localEvent.id)) {
              const eventStart = localEvent.start
              if (eventStart >= start && eventStart <= end) {
                storeDeleteEvent(localEvent.id)
              }
            }
          }
        }

        storage.updateAccountLastSync(accountId)
        processPendingChanges()

        setSyncState((prev) => ({
          ...prev,
          status: 'idle',
          lastSyncAt: new Date().toISOString(),
        }))
      } catch (error) {
        setSyncState((prev) => ({
          ...prev,
          status: 'error',
          error: error instanceof Error ? error.message : 'Sync failed',
        }))
        throw error
      }
    },
    [conflictResolution]
  )

  const syncAll = useCallback(async (): Promise<void> => {
    for (const account of accounts) {
      await syncAccount(account.id)
    }
  }, [accounts, syncAccount])

  const createEvent = useCallback(
    async (calendarId: string, event: CalendarEvent): Promise<void> => {
      if (caldavDebugMode) {
        console.log('[CalDAV] createEvent called:', {
          calendarId,
          eventId: event.id,
          eventTitle: event.title,
        })
      }

      const allCalendars = storage.getAllCalendars()
      const allAccounts = storage.getAllAccounts()
      const calendar = allCalendars.find((c) => c.id === calendarId)
      const account = allAccounts.find((a) => a.id === calendar?.accountId)

      if (caldavDebugMode) {
        console.log('[CalDAV] Looking up calendar:', {
          calendarId,
          foundCalendar: !!calendar,
          calendar,
          accountId: calendar?.accountId,
        })
        console.log(
          '[CalDAV] Available calendars:',
          allCalendars.map((c) => ({ id: c.id, accountId: c.accountId, name: c.name }))
        )
        console.log(
          '[CalDAV] Available accounts:',
          allAccounts.map((a) => ({ id: a.id, name: a.name }))
        )
      }

      if (!calendar || !account) {
        console.warn('[CalDAV] createEvent: No calendar or account found', {
          calendarId,
          calendarFound: !!calendar,
          accountFound: !!account,
        })
        showToast('Failed to sync event with CalDAV server. It will be retried.')
        return
      }

      try {
        const credential = getCredentialById(account.credentialId)
        if (!credential) {
          throw new Error('Credentials not found')
        }

        const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
        const engine = new SyncEngine(client, calendarId)

        const eventWithSequence: CalendarEvent = {
          ...event,
          sequence: 0,
        }

        if (caldavDebugMode) {
          console.log('[CalDAV] Pushing event to server...')
        }

        await engine.pushEvent(eventWithSequence)

        if (caldavDebugMode) {
          console.log('[CalDAV] Event pushed successfully!')
        }

        storage.updateAccountLastSync(account.id)
        processPendingChanges()
      } catch (error) {
        if (caldavDebugMode) {
          console.log('[CalDAV] createEvent failed, adding to pending changes:', error)
        }
        storage.addPendingChange({
          type: 'create',
          eventId: event.id,
          calendarId,
          data: JSON.stringify(event),
        })
        setSyncState((prev) => ({
          ...prev,
          pendingChanges: prev.pendingChanges + 1,
        }))
        throw error
      }
    },
    [caldavDebugMode]
  )

  const updateEventFn = useCallback(
    async (calendarId: string, event: CalendarEvent): Promise<void> => {
      if (caldavDebugMode) {
        console.log('[CalDAV] updateEvent called:', {
          calendarId,
          eventId: event.id,
          eventTitle: event.title,
        })
      }

      const allCalendars = storage.getAllCalendars()
      const allAccounts = storage.getAllAccounts()
      const calendar = allCalendars.find((c) => c.id === calendarId)
      const account = allAccounts.find((a) => a.id === calendar?.accountId)

      if (!calendar || !account) {
        console.warn('[CalDAV] updateEvent: No calendar or account found', {
          calendarId,
          calendarFound: !!calendar,
          accountFound: !!account,
        })
        showToast('Failed to sync event with CalDAV server. It will be retried.')
        return
      }

      try {
        const credential = getCredentialById(account.credentialId)
        if (!credential) {
          throw new Error('Credentials not found')
        }

        const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
        const engine = new SyncEngine(client, calendarId)

        const currentSequence = event.sequence ?? 0
        const eventWithSequence: CalendarEvent = {
          ...event,
          sequence: currentSequence + 1,
        }

        if (caldavDebugMode) {
          console.log('[CalDAV] Updating event on server...')
        }

        await engine.updateEvent(eventWithSequence, event.etag ?? '')

        if (caldavDebugMode) {
          console.log('[CalDAV] Event updated successfully!')
        }

        storage.updateAccountLastSync(account.id)
        processPendingChanges()
      } catch (error) {
        if (caldavDebugMode) {
          console.log('[CalDAV] updateEvent failed, adding to pending changes:', error)
        }
        storage.addPendingChange({
          type: 'update',
          eventId: event.id,
          calendarId,
          data: JSON.stringify(event),
        })
        setSyncState((prev) => ({
          ...prev,
          pendingChanges: prev.pendingChanges + 1,
        }))
        throw error
      }
    },
    [caldavDebugMode]
  )

  const deleteEventFn = useCallback(
    async (calendarId: string, eventId: string): Promise<void> => {
      if (caldavDebugMode) {
        console.log('[CalDAV] deleteEvent called:', { calendarId, eventId })
      }

      const allCalendars = storage.getAllCalendars()
      const allAccounts = storage.getAllAccounts()
      const calendar = allCalendars.find((c) => c.id === calendarId)
      const account = allAccounts.find((a) => a.id === calendar?.accountId)

      if (!calendar || !account) {
        console.warn('[CalDAV] deleteEvent: No calendar or account found', {
          calendarId,
          calendarFound: !!calendar,
          accountFound: !!account,
        })
        showToast('Failed to sync event with CalDAV server. It will be retried.')
        return
      }

      try {
        const credential = getCredentialById(account.credentialId)
        if (!credential) {
          throw new Error('Credentials not found')
        }

        const client = await createCalDAVClient(account.serverUrl, credential, account.proxyUrl)
        const engine = new SyncEngine(client, calendarId)

        if (caldavDebugMode) {
          console.log('[CalDAV] Deleting event from server...')
        }

        const eventUrl = `${calendar.url}${eventId}.ics`
        await engine.deleteEvent(eventUrl, '')

        storeDeleteEvent(eventId)

        if (caldavDebugMode) {
          console.log('[CalDAV] Event deleted successfully!')
        }

        storage.updateAccountLastSync(account.id)
        processPendingChanges()
      } catch (error) {
        if (caldavDebugMode) {
          console.log('[CalDAV] deleteEvent failed, adding to pending changes:', error)
        }
        storage.addPendingChange({
          type: 'delete',
          eventId,
          calendarId,
        })
        setSyncState((prev) => ({
          ...prev,
          pendingChanges: prev.pendingChanges + 1,
        }))
        throw error
      }
    },
    [storeDeleteEvent, caldavDebugMode]
  )

  return {
    accounts,
    calendars,
    syncState,
    addAccount,
    removeAccount,
    syncAccount,
    syncAll,
    createEvent,
    updateEvent: updateEventFn,
    deleteEvent: deleteEventFn,
  }
}
