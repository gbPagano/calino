import { useState, useCallback, useEffect } from 'react'
import { toast as sonnerToast } from 'sonner'
import type { CalDAVCredentials } from '@/features/caldav/types'
import type { AddressBook, Contact, CardDAVSyncState } from '../types'
import { createCardDAVClient, CardDAVClient } from '../client/CardDAVClient'
import { useContactStore } from '@/store/contactStore'
import { useCalendarStore } from '@/store/calendarStore'
import { getCredentialById } from '@/features/caldav/client/credentials'
import * as storage from '@/features/caldav/sync/accountStorage'

function showToast(message: string): void {
  sonnerToast(message)
}

interface UseCardDAVReturn {
  addressBooks: AddressBook[]
  contacts: Contact[]
  syncState: CardDAVSyncState
  syncAccount: (accountId: string) => Promise<void>
  hasAddressBooks: (accountId: string) => Promise<boolean>
}

export function useCardDAV(): UseCardDAVReturn {
  const [syncState, setSyncState] = useState<CardDAVSyncState>({
    status: 'idle',
    lastSyncAt: null,
    error: null,
    pendingChanges: 0,
  })

  const storeAddressBooks = useContactStore((state) => state.addressBooks)
  const storeContacts = useContactStore((state) => state.contacts)
  const addAddressBook = useContactStore((state) => state.addAddressBook)
  const addContact = useContactStore((state) => state.addContact)
  const updateContact = useContactStore((state) => state.updateContact)
  const setAddressBooks = useContactStore((state) => state.setAddressBooks)
  const setContacts = useContactStore((state) => state.setContacts)

  // Auto-sync contacts from all accounts on mount
  useEffect(() => {
    const syncAllAccounts = async () => {
      const accounts = storage.getAllAccounts()
      for (const account of accounts) {
        try {
          await syncAccount(account.id)
        } catch (err) {
          console.warn('[CardDAV] Failed to sync account:', account.name, err)
        }
      }
    }
    syncAllAccounts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if an account has address books
  const hasAddressBooks = useCallback(async (accountId: string): Promise<boolean> => {
    const account = storage.getAccountById(accountId)
    if (!account) return false

    const credential = await getCredentialById(account.credentialId)
    if (!credential) return false

    try {
      const client = await createCardDAVClient(account.serverUrl, credential, account.proxyUrl)
      const addressBooks = await client.fetchAddressBooks()
      return addressBooks.length > 0
    } catch {
      return false
    }
  }, [])

  // Sync contacts from a CalDAV account
  const syncAccount = useCallback(async (accountId: string): Promise<void> => {
    const account = storage.getAccountById(accountId)
    if (!account) return

    setSyncState((prev) => ({ ...prev, status: 'syncing', error: null }))

    try {
      const credential = await getCredentialById(account.credentialId)
      if (!credential) {
        throw new Error('Credentials not found')
      }

      const client = await createCardDAVClient(account.serverUrl, credential, account.proxyUrl)
      const serverAddressBooks = await client.fetchAddressBooks()

      // Update address books in store
      const newAddressBooks: AddressBook[] = serverAddressBooks.map((ab) => ({
        ...ab,
        accountId,
      }))
      
      // Merge with existing address books
      const existingAddressBooks = useContactStore.getState().addressBooks
      const mergedAddressBooks = [...existingAddressBooks]
      
      for (const newAb of newAddressBooks) {
        const existingIndex = mergedAddressBooks.findIndex((ab) => ab.url === newAb.url)
        if (existingIndex >= 0) {
          // Update existing
          mergedAddressBooks[existingIndex] = {
            ...mergedAddressBooks[existingIndex],
            name: newAb.name,
            ctag: newAb.ctag,
            syncToken: newAb.syncToken,
          }
        } else {
          // Add new
          mergedAddressBooks.push(newAb)
        }
      }
      
      setAddressBooks(mergedAddressBooks)

      // Fetch contacts from each address book
      const allContacts: Contact[] = []
      
      for (const addressBook of newAddressBooks) {
        try {
          const contacts = await client.fetchContacts(addressBook)
          allContacts.push(...contacts)
        } catch (err) {
          console.warn(`[CardDAV] Failed to fetch contacts from ${addressBook.name}:`, err)
        }
      }

      // Merge with existing contacts
      const existingContacts = useContactStore.getState().contacts
      const mergedContacts = [...existingContacts]
      
      for (const newContact of allContacts) {
        const existingIndex = mergedContacts.findIndex((c) => c.id === newContact.id)
        if (existingIndex >= 0) {
          // Update existing
          mergedContacts[existingIndex] = {
            ...mergedContacts[existingIndex],
            ...newContact,
          }
        } else {
          // Add new
          mergedContacts.push(newContact)
        }
      }
      
      setContacts(mergedContacts)

      setSyncState((prev) => ({
        ...prev,
        status: 'idle',
        lastSyncAt: new Date().toISOString(),
      }))

      console.log(`[CardDAV] Synced ${allContacts.length} contacts from ${newAddressBooks.length} address books`)
    } catch (error) {
      console.error('[CardDAV] syncAccount failed:', error)
      setSyncState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Sync failed',
      }))
    }
  }, [setAddressBooks, setContacts])

  return {
    addressBooks: storeAddressBooks,
    contacts: storeContacts,
    syncState,
    syncAccount,
    hasAddressBooks,
  }
}
