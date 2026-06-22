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
      className={`${styles.contactsPage} ${showDetail ? styles.showDetail : ''}`}
    >
      <div className={styles.clist}>
        <ContactList />
      </div>

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
          <ContactDetail contact={selectedContact} />
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
    </div>
  )
}
