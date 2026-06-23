import type { JSX } from 'react'
import { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useContactStore } from '@/store/contactStore'
import { useCardDAV } from '@/features/carddav/hooks/useCardDAV'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Contact } from '../types'
import { ContactList } from './ContactList'
import { ContactDetail } from './ContactDetail'
import { ContactFormModal } from './ContactFormModal'
import styles from './ContactsView.module.css'

export function ContactsView(): JSX.Element {
  const selectedContactId = useContactStore((s) => s.selectedContactId)
  const getContactById = useContactStore((s) => s.getContactById)
  const setSelectedContactId = useContactStore((s) => s.setSelectedContactId)
  const addContact = useContactStore((s) => s.addContact)
  const updateContact = useContactStore((s) => s.updateContact)
  const deleteContact = useContactStore((s) => s.deleteContact)
  const addressBooks = useContactStore((s) => s.addressBooks)
  const addPendingChange = useContactStore((s) => s.addPendingChange)

  const { syncAccount, syncState } = useCardDAV()
  const isMobile = useIsMobile()

  // Form modal state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [pendingAccountId, setPendingAccountId] = useState<string>('')

  // Address book picker for "+ New" when >1 books
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const confirmDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const visibleAddressBooks = addressBooks.filter((ab) => ab.isVisible)

  const selectedContact = selectedContactId
    ? getContactById(selectedContactId)
    : null

  const showDetail = isMobile && selectedContact !== null

  const handleBack = (): void => {
    setSelectedContactId(null)
  }

  // "+ New" — if 1 address book go straight to form, if >1 show picker
  const handleNewClick = (): void => {
    if (visibleAddressBooks.length === 1) {
      const [ab] = visibleAddressBooks
      setEditingContact(null)
      setPendingAccountId(ab.accountId)
      setIsFormOpen(true)
      setShowPicker(false)
    } else {
      setShowPicker((prev) => !prev)
    }
  }

  const handlePickAddressBook = (_addressBookId: string, accountId: string): void => {
    setEditingContact(null)
    setPendingAccountId(accountId)
    setIsFormOpen(true)
    setShowPicker(false)
  }

  const handleEdit = useCallback(
    (contact: Contact): void => {
      setEditingContact(contact)
      setPendingAccountId(contact.accountId)
      setIsFormOpen(true)
    },
    []
  )

  const handleDelete = useCallback(
    async (contact: Contact): Promise<void> => {
      // Second click — actually delete
      if (confirmDeleteId === contact.id) {
        if (confirmDeleteTimerRef.current) {
          clearTimeout(confirmDeleteTimerRef.current)
          confirmDeleteTimerRef.current = null
        }
        setConfirmDeleteId(null)

        const ab = addressBooks.find((a) => a.id === contact.addressBookId)
        const now = new Date().toISOString()

        // Optimistic delete from store
        deleteContact(contact.id)

        // Queue pending delete
        addPendingChange({
          id: uuidv4(),
          type: 'delete',
          contactId: contact.id,
          addressBookId: contact.addressBookId,
          timestamp: now,
          retryCount: 0,
        })

        // Deselect if this was the selected contact
        if (selectedContactId === contact.id) {
          setSelectedContactId(null)
        }

        // Sync the account
        if (ab?.accountId) {
          await syncAccount(ab.accountId)
        }
        return
      }

      // First click — show confirm
      setConfirmDeleteId(contact.id)

      // Auto-reset after 3 seconds
      if (confirmDeleteTimerRef.current) {
        clearTimeout(confirmDeleteTimerRef.current)
      }
      confirmDeleteTimerRef.current = setTimeout(() => {
        setConfirmDeleteId(null)
        confirmDeleteTimerRef.current = null
      }, 3000)
    },
    [addressBooks, deleteContact, addPendingChange, selectedContactId, setSelectedContactId, syncAccount, confirmDeleteId]
  )

  const handleFieldSave = useCallback(
    async (contact: Contact, field: string, value: unknown): Promise<void> => {
      const ab = addressBooks.find((a) => a.id === contact.addressBookId)
      const now = new Date().toISOString()

      // Update store optimistically
      updateContact(contact.id, { [field]: value, lastModified: now, syncStatus: 'pending' })

      // Queue pending update
      addPendingChange({
        id: uuidv4(),
        type: 'update',
        contactId: contact.id,
        addressBookId: contact.addressBookId,
        timestamp: now,
        retryCount: 0,
      })

      // Sync the account
      if (ab?.accountId) {
        await syncAccount(ab.accountId)
      }
    },
    [addressBooks, updateContact, addPendingChange, syncAccount]
  )

  const handleFormSave = useCallback(
    async (contact: Contact): Promise<void> => {
      const now = new Date().toISOString()
      const existingContact = useContactStore.getState().contacts.find((c) => c.id === contact.id)
      const isNew = !existingContact

      if (isNew) {
        // Optimistic add to store
        addContact(contact)

        // Queue pending create
        addPendingChange({
          id: uuidv4(),
          type: 'create',
          contactId: contact.id,
          addressBookId: contact.addressBookId,
          timestamp: now,
          retryCount: 0,
        })

        // Select the new contact
        setSelectedContactId(contact.id)

        // Sync in background
        syncAccount(pendingAccountId).catch(() => {})
      } else {
        // Optimistic update in store
        updateContact(contact.id, { ...contact, lastModified: now, syncStatus: 'pending' })

        // Queue pending update
        addPendingChange({
          id: uuidv4(),
          type: 'update',
          contactId: contact.id,
          addressBookId: contact.addressBookId,
          timestamp: now,
          retryCount: 0,
        })

        // Sync in background — don't await, let the optimistic update stay visible
        syncAccount(contact.accountId).catch(() => {})
      }

      setIsFormOpen(false)
      setEditingContact(null)
    },
    [addContact, updateContact, addPendingChange, setSelectedContactId, syncAccount, pendingAccountId]
  )

  const handleFormClose = (): void => {
    setIsFormOpen(false)
    setEditingContact(null)
    setShowPicker(false)
  }

  return (
    <div
      className={`${styles.contactsPage} ${showDetail ? styles.showDetail : ''}`}
    >
      {/* Left panel */}
      <div className={styles.clist}>
        <ContactList onNewContact={handleNewClick} loading={syncState.status === 'syncing'} />
      </div>

      {/* Address book picker dropdown */}
      {showPicker && visibleAddressBooks.length > 1 && (
        <div className={styles.addressBookPicker} ref={pickerRef}>
          <div className={styles.addressBookPickerLabel}>Choose address book</div>
          {visibleAddressBooks.map((ab) => (
            <button
              key={ab.id}
              type="button"
              className={styles.addressBookPickerItem}
              onClick={() => handlePickAddressBook(ab.id, ab.accountId)}
            >
              {ab.name}
            </button>
          ))}
        </div>
      )}

      {/* Right panel */}
      <div className={styles.cdetail}>
        {showDetail && (
          <button
            type="button"
            className={styles.mobileBack}
            onClick={handleBack}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Contacts
          </button>
        )}

        {selectedContact ? (
          <ContactDetail
            contact={selectedContact}
            onEdit={() => handleEdit(selectedContact)}
            onDelete={() => handleDelete(selectedContact)}
            onFieldSave={(field, value) => handleFieldSave(selectedContact, field, value)}
            confirmDelete={confirmDeleteId === selectedContact.id}
          />
        ) : (
          !isMobile && (
            <div className={styles.cdetailEmpty}>
              <svg
                viewBox="0 0 40 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M34 35v-2a8 8 0 0 0-8-8H14a8 8 0 0 0-8 8v2" />
                <circle cx="20" cy="12" r="8" />
              </svg>
              <p>Select a contact</p>
            </div>
          )
        )}
      </div>

      {/* Contact form modal */}
      <ContactFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        contact={editingContact}
        addressBookId={editingContact?.addressBookId ?? visibleAddressBooks[0]?.id ?? ''}
        accountId={pendingAccountId}
        onSave={handleFormSave}
        onDelete={editingContact ? (c) => handleDelete(c) : undefined}
      />
    </div>
  )
}
