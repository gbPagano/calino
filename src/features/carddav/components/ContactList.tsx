import type { JSX, KeyboardEvent } from 'react'
import { useMemo, useRef, useCallback } from 'react'
import { useContactStore } from '@/store/contactStore'
import type { Contact } from '../types'
import styles from './ContactList.module.css'

/** Get initials from display name (up to 2 characters). */
function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase()
}

/** Get the primary email or first email. */
function getPrimaryEmail(contact: Contact): string | null {
  const primary = contact.emails.find((e) => e.isPrimary)
  if (primary) return primary.value
  return contact.emails[0]?.value ?? null
}

/** Get a consistent color for the avatar based on name. */
function getAvatarColor(name: string): string {
  const AVATAR_COLORS = [
    '#4285F4',
    '#EA4335',
    '#34A853',
    '#FBBC05',
    '#FF6D01',
    '#46BDC6',
    '#7B1FA2',
    '#C2185B',
    '#00796B',
    '#F57C00',
    '#455A64',
    '#5D4037',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function ContactListItem({
  contact,
  isSelected,
  onSelect,
}: {
  contact: Contact
  isSelected: boolean
  onSelect: () => void
}): JSX.Element {
  const email = getPrimaryEmail(contact)
  const initials = getInitials(contact.displayName)
  const avatarColor = getAvatarColor(contact.displayName)

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  return (
    <div
      className={`${styles.contactItem} ${isSelected ? styles.selected : ''}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div
        className={styles.avatar}
        style={{ backgroundColor: avatarColor }}
      >
        {contact.photo ? (
          <img src={contact.photo} alt="" />
        ) : (
          initials
        )}
      </div>

      <div className={styles.contactInfo}>
        <div className={styles.contactName}>{contact.displayName}</div>
        {email && <div className={styles.contactEmail}>{email}</div>}
        {contact.organization && (
          <div className={styles.contactOrg}>{contact.organization}</div>
        )}
      </div>
    </div>
  )
}

export function ContactList(): JSX.Element {
  const searchQuery = useContactStore((s) => s.searchQuery)
  const setSearchQuery = useContactStore((s) => s.setSearchQuery)
  const selectedContactId = useContactStore((s) => s.selectedContactId)
  const setSelectedContactId = useContactStore((s) => s.setSelectedContactId)
  const contacts = useContactStore((s) => s.contacts)
  const addressBooks = useContactStore((s) => s.addressBooks)

  const inputRef = useRef<HTMLInputElement>(null)

  const filteredContacts = useMemo(() => {
    // Filter by visible address books
    const visibleAddressBookIds = addressBooks
      .filter((ab) => ab.isVisible)
      .map((ab) => ab.id)
    
    let filtered = contacts.filter((c) => visibleAddressBookIds.includes(c.addressBookId))
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((c) =>
        c.displayName.toLowerCase().includes(query) ||
        c.organization.toLowerCase().includes(query) ||
        c.emails.some((e) => e.value.toLowerCase().includes(query)) ||
        c.phones.some((p) => p.value.includes(query))
      )
    }
    
    // Sort by display name
    return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [contacts, addressBooks, searchQuery])

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedContactId(id)
    },
    [setSelectedContactId]
  )

  return (
    <div className={styles.container}>
      {/* Search bar */}
      <div className={styles.searchBar}>
        <svg
          className={styles.searchIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search contacts"
        />
        {searchQuery && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              setSearchQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Contact count */}
      <div className={styles.countBar}>
        <span className={styles.count}>
          {filteredContacts.length}{' '}
          {filteredContacts.length === 1 ? 'contact' : 'contacts'}
        </span>
      </div>

      {/* Contact list */}
      <div className={styles.list}>
        {filteredContacts.length === 0 ? (
          <div className={styles.emptyState}>
            {searchQuery ? (
              <>
                <span className={styles.emptyTitle}>No matches</span>
                <span>No contacts match &ldquo;{searchQuery}&rdquo;</span>
              </>
            ) : (
              <>
                <span className={styles.emptyTitle}>No contacts</span>
                <span>Sync your CardDAV account to see contacts here.</span>
              </>
            )}
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <ContactListItem
              key={contact.id}
              contact={contact}
              isSelected={contact.id === selectedContactId}
              onSelect={() => handleSelect(contact.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
