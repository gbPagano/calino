import type { Contact, PendingContactChange } from '@/features/carddav/types'
import { showToast } from './toast'

interface DeleteContactWithUndoOptions {
  contact: Contact
  deleteContact: (id: string) => void
  addContact: (contact: Contact) => void
  addPendingChange: (change: PendingContactChange) => void
  syncAccount?: (accountId: string) => Promise<void>
  onAfterDelete?: () => void
}

export function deleteContactWithUndo({
  contact,
  deleteContact,
  addContact,
  addPendingChange,
  syncAccount,
  onAfterDelete,
}: DeleteContactWithUndoOptions): void {
  // Save full contact for potential restore
  const savedContact = { ...contact }

  // Optimistic local delete
  deleteContact(contact.id)
  onAfterDelete?.()

  // Queue pending delete for CardDAV sync
  addPendingChange({
    id: crypto.randomUUID(),
    type: 'delete',
    contactId: contact.id,
    addressBookId: contact.addressBookId,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  })

  // Show undo toast
  showToast('Contact deleted', {
    duration: 8000,
    onUndo: () => {
      // Restore the contact
      addContact(savedContact)

      // Queue a create to re-sync the restored contact
      addPendingChange({
        id: crypto.randomUUID(),
        type: 'create',
        contactId: savedContact.id,
        addressBookId: savedContact.addressBookId,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      })

      // Sync in background
      syncAccount?.(savedContact.accountId)
    },
  })
}
