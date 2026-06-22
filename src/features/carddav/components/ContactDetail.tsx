import type { JSX } from 'react'
import type { Contact } from '../types'
import styles from './ContactsView.module.css'

/** Get initials from display name (up to 2 characters). */
function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase()
}

/** Format a date string to a human-readable format. */
function formatDate(dateStr: string): string {
  try {
    // Handle vCard date formats: YYYYMMDD or YYYY-MM-DD
    const normalized = dateStr.replace(
      /^(\d{4})(\d{2})(\d{2})$/,
      '$1-$2-$3'
    )
    const date = new Date(normalized)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/** Format address into readable lines. */
function formatAddress(addr: Contact['addresses'][0]): string {
  const lines: string[] = []
  if (addr.street) lines.push(addr.street)
  const cityRegion: string[] = []
  if (addr.city) cityRegion.push(addr.city)
  if (addr.region) cityRegion.push(addr.region)
  if (cityRegion.length > 0) lines.push(cityRegion.join(', '))
  const postalCountry: string[] = []
  if (addr.postalCode) postalCountry.push(addr.postalCode)
  if (addr.country) postalCountry.push(addr.country)
  if (postalCountry.length > 0) lines.push(postalCountry.join(' '))
  return lines.join('\n') || addr.extended || ''
}

/** Label map for contact field types. */
const EMAIL_TYPE_LABELS: Record<string, string> = {
  home: 'Home',
  work: 'Work',
  other: 'Other',
  pref: 'Preferred',
}

const PHONE_TYPE_LABELS: Record<string, string> = {
  home: 'Home',
  work: 'Work',
  cell: 'Mobile',
  fax: 'Fax',
  other: 'Other',
  pref: 'Preferred',
}

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  home: 'Home',
  work: 'Work',
  other: 'Other',
  pref: 'Preferred',
}

interface ContactDetailProps {
  contact: Contact
}

export function ContactDetail({ contact }: ContactDetailProps): JSX.Element {
  const initials = getInitials(contact.displayName)

  return (
    <div className={styles.detailContent}>
      {/* Header: Avatar, Name, Title/Org, Actions */}
      <div className={styles.detailHeader}>
        <div className={styles.detailAvatar}>
          {contact.photo ? (
            <img src={contact.photo} alt={contact.displayName} />
          ) : (
            initials
          )}
        </div>

        <div className={styles.detailHeaderInfo}>
          <h1 className={styles.detailName}>{contact.displayName}</h1>
          {(contact.title || contact.organization) && (
            <p className={styles.detailTitleOrg}>
              {[contact.title, contact.organization]
                .filter(Boolean)
                .join(' at ')}
            </p>
          )}
        </div>

        <div className={styles.detailActions}>
          <button
            type="button"
            className={styles.detailActionBtn}
            disabled
            title="Edit contact (coming soon)"
            aria-label="Edit contact"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.detailActionBtn}
            disabled
            title="Delete contact (coming soon)"
            aria-label="Delete contact"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Email addresses */}
      {contact.emails.length > 0 && (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Email</h2>
          {contact.emails.map((email, i) => (
            <div key={`email-${i}`} className={styles.infoRow}>
              <span className={styles.infoLabel}>
                {EMAIL_TYPE_LABELS[email.type] ?? email.type}
              </span>
              <span className={styles.infoValue}>
                <a href={`mailto:${email.value}`}>{email.value}</a>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Phone numbers */}
      {contact.phones.length > 0 && (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Phone</h2>
          {contact.phones.map((phone, i) => (
            <div key={`phone-${i}`} className={styles.infoRow}>
              <span className={styles.infoLabel}>
                {PHONE_TYPE_LABELS[phone.type] ?? phone.type}
              </span>
              <span className={styles.infoValue}>
                <a href={`tel:${phone.value}`}>{phone.value}</a>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Addresses */}
      {contact.addresses.length > 0 && (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Address</h2>
          {contact.addresses.map((addr, i) => {
            const formatted = formatAddress(addr)
            if (!formatted) return null
            return (
              <div key={`addr-${i}`} className={styles.addressBlock}>
                <div className={styles.addressType}>
                  {ADDRESS_TYPE_LABELS[addr.type] ?? addr.type}
                </div>
                <div className={styles.addressLine}>
                  {formatted.split('\n').map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < formatted.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Birthday */}
      {contact.birthday && (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Birthday</h2>
          <div className={styles.infoRow}>
            <span className={styles.infoValue}>
              {formatDate(contact.birthday)}
            </span>
          </div>
        </div>
      )}

      {/* Anniversary */}
      {contact.anniversary && (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Anniversary</h2>
          <div className={styles.infoRow}>
            <span className={styles.infoValue}>
              {formatDate(contact.anniversary)}
            </span>
          </div>
        </div>
      )}

      {/* Notes */}
      {contact.note && (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Notes</h2>
          <div className={styles.notesText}>{contact.note}</div>
        </div>
      )}

      {/* Categories */}
      {contact.categories.length > 0 && (
        <div className={styles.detailSection}>
          <h2 className={styles.sectionTitle}>Categories</h2>
          <div className={styles.tagsContainer}>
            {contact.categories.map((cat) => (
              <span key={cat} className={styles.tag}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
