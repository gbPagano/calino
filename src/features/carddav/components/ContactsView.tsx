import type { JSX } from 'react'
import { useContactStore } from '@/store/contactStore'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ContactList } from './ContactList'
import { ContactDetail } from './ContactDetail'
import styles from './ContactsView.module.css'

export function ContactsView(): JSX.Element {
  const selectedContactId = useContactStore((s) => s.selectedContactId)
  const getContactById = useContactStore((s) => s.getContactById)
  const setSelectedContactId = useContactStore((s) => s.setSelectedContactId)
  const isMobile = useIsMobile()

  const selectedContact = selectedContactId
    ? getContactById(selectedContactId)
    : null

  const showDetail = isMobile && selectedContact !== null

  const handleBack = (): void => {
    setSelectedContactId(null)
  }

  return (
    <div
      className={`${styles.container} ${showDetail ? styles.showDetail : ''}`}
    >
      <div className={styles.listPanel}>
        <ContactList />
      </div>

      <div className={styles.detailPanel}>
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
          <ContactDetail contact={selectedContact} />
        ) : (
          !isMobile && (
            <div className={styles.detailEmpty}>
              <div className={styles.detailEmptyIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Select a contact to view details</span>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
