import { useState } from 'react'
import type { JSX } from 'react'
import type { Contact } from '../types'
import { MarkdownView } from '@/lib/markdown'
import styles from './ContactsView.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  '#b07d4f',
  '#5b7fb5',
  '#5d9a78',
  '#c2697f',
  '#8a6aa8',
  '#bf944e',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avatarColor(name: string): string {
  const h = name
    .split('')
    .reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0)
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase()
}

function formatDate(dateStr: string): string {
  try {
    const normalized = dateStr.replace(
      /^(\d{4})(\d{2})(\d{2})$/,
      '$1-$2-$3',
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

function getAge(birthday: string): number {
  const today = new Date()
  const birthDate = new Date(
    birthday.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
  )
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }
  return age
}

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

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Inline edit helpers
// ---------------------------------------------------------------------------

interface InlineEdit {
  field: string
  original: string
  value: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ContactDetailProps {
  contact: Contact
  onEdit?: () => void
  onDelete?: () => void
  onFieldSave?: (field: string, value: unknown) => void
  confirmDelete?: boolean
}

export function ContactDetail({
  contact,
  onEdit,
  onDelete,
  onFieldSave,
  confirmDelete,
}: ContactDetailProps): JSX.Element {
  const [inlineEditing, setInlineEditing] = useState<InlineEdit | null>(null)

  function startInlineEdit(field: string, currentValue: string) {
    setInlineEditing({ field, original: currentValue, value: currentValue })
  }

  function saveInlineEdit() {
    if (inlineEditing && onFieldSave) {
      const { field, value } = inlineEditing
      onFieldSave(field, value)
    }
    setInlineEditing(null)
  }

  function cancelInlineEdit() {
    setInlineEditing(null)
  }

  function saveInlineEditEmail(index: number) {
    if (inlineEditing && onFieldSave) {
      const newEmails = [...contact.emails]
      newEmails[index] = { ...newEmails[index], value: inlineEditing.value }
      onFieldSave('emails', newEmails)
    }
    setInlineEditing(null)
  }

  function saveInlineEditPhone(index: number) {
    if (inlineEditing && onFieldSave) {
      const newPhones = [...contact.phones]
      newPhones[index] = { ...newPhones[index], value: inlineEditing.value }
      onFieldSave('phones', newPhones)
    }
    setInlineEditing(null)
  }

  const color = avatarColor(contact.displayName)
  const initials = getInitials(contact.displayName)

  const roleOrg = [contact.role || contact.title, contact.organization]
    .filter(Boolean)
    .join(' \u00b7 ')

  const hasInfo =
    contact.emails.length > 0 ||
    contact.phones.length > 0 ||
    contact.addresses.length > 0

  return (
    <div className={styles.detailContent}>
      {/* ─── Hero ─── */}
      <div className={styles.hero}>
        <div className={styles.heroAvatar} style={{ background: color }}>
          {contact.photo ? (
            <img src={contact.photo} alt={contact.displayName} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className={styles.heroText}>
          <div
            className={styles.inlineEditWrapper}
            onDoubleClick={() => startInlineEdit('displayName', contact.displayName)}
          >
            {inlineEditing?.field === 'displayName' ? (
              <input
                className={`${styles.inlineInput} ${styles.heroNameInput}`}
                value={inlineEditing.value}
                onChange={(e) =>
                  setInlineEditing({ ...inlineEditing, value: e.target.value })
                }
                onBlur={() => saveInlineEdit()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveInlineEdit()
                  if (e.key === 'Escape') cancelInlineEdit()
                }}
                autoFocus
              />
            ) : (
              <h1 className={styles.heroName}>{contact.displayName}</h1>
            )}
          </div>
          {roleOrg && <p className={styles.heroRole}>{roleOrg}</p>}
          <div className={styles.heroActions}>
            <a
              href={`mailto:${contact.emails[0]?.value ?? ''}`}
              className={styles.btnSecondary}
              hidden={contact.emails.length === 0}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              Send email
            </a>
          </div>
        </div>

        <div className={styles.heroIconActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onEdit}
            title="Edit contact"
            aria-label="Edit contact"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${confirmDelete ? styles.btnDeleteConfirm : ''}`}
            onClick={onDelete}
            title={confirmDelete ? 'Click again to confirm' : 'Delete contact'}
            aria-label="Delete contact"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
            {confirmDelete && <span className={styles.btnDeleteLabel}>Confirm?</span>}
          </button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className={styles.body}>
        {/* Main column */}
        <div className={styles.bodyMain}>
          {/* Info card */}
          {hasInfo && (
            <div className={styles.infoCard}>
              {/* Emails */}
              {contact.emails.length > 0 && (
                <>
                  {contact.emails.map((email, i) => (
                    <div key={`email-${i}`} className={styles.infoField}>
                      <span className={styles.infoFieldLabel}>EMAIL</span>
                      <div className={styles.infoFieldGrid}>
                        <span className={styles.infoFieldSub}>
                          {EMAIL_TYPE_LABELS[email.type] ?? email.type}
                        </span>
                        {inlineEditing?.field === `email_${i}` ? (
                          <input
                            className={styles.inlineInput}
                            value={inlineEditing.value}
                            onChange={(e) =>
                              setInlineEditing({ ...inlineEditing, value: e.target.value })
                            }
                            onBlur={() => saveInlineEditEmail(i)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEditEmail(i)
                              if (e.key === 'Escape') cancelInlineEdit()
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={styles.infoFieldValue}
                            onDoubleClick={() => startInlineEdit(`email_${i}`, email.value)}
                          >
                            <a href={`mailto:${email.value}`}>{email.value}</a>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Phones */}
              {contact.phones.length > 0 && (
                <>
                  {contact.phones.map((phone, i) => (
                    <div key={`phone-${i}`} className={styles.infoField}>
                      <span className={styles.infoFieldLabel}>PHONE</span>
                      <div className={styles.infoFieldGrid}>
                        <span className={styles.infoFieldSub}>
                          {PHONE_TYPE_LABELS[phone.type] ?? phone.type}
                        </span>
                        {inlineEditing?.field === `phone_${i}` ? (
                          <input
                            className={styles.inlineInput}
                            value={inlineEditing.value}
                            onChange={(e) =>
                              setInlineEditing({ ...inlineEditing, value: e.target.value })
                            }
                            onBlur={() => saveInlineEditPhone(i)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEditPhone(i)
                              if (e.key === 'Escape') cancelInlineEdit()
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className={styles.infoFieldValue}
                            onDoubleClick={() => startInlineEdit(`phone_${i}`, phone.value)}
                          >
                            <a href={`tel:${phone.value}`}>{phone.value}</a>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Addresses */}
              {contact.addresses.length > 0 && (
                <>
                  {contact.addresses.map((addr, i) => {
                    const formatted = formatAddress(addr)
                    if (!formatted) return null
                    return (
                      <div key={`addr-${i}`} className={styles.infoField}>
                        <span className={styles.infoFieldLabel}>ADDRESS</span>
                        <div className={styles.infoFieldGrid}>
                          <span className={styles.infoFieldSub}>
                            {ADDRESS_TYPE_LABELS[addr.type] ?? addr.type}
                          </span>
                          <span className={styles.infoFieldValue}>
                            {formatted.split('\n').map((line, j) => (
                              <span key={j}>
                                {line}
                                {j < formatted.split('\n').length - 1 && (
                                  <br />
                                )}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

        </div>

        {/* Aside column */}
        <div className={styles.bodyAside}>
          {/* Birthday card */}
          {contact.birthday && (
            <div className={styles.birthdayCard}>
              <span className={styles.birthdayEmoji}>{'\uD83C\uDF82'}</span>
              <div className={styles.birthdayLabel}>BIRTHDAY</div>
              <div className={styles.birthdayDate}>
                {formatDate(contact.birthday)}
              </div>
              <div className={styles.birthdayAge}>
                {getAge(contact.birthday)} years old
              </div>
            </div>
          )}

          {/* Categories card */}
          {contact.categories.length > 0 && (
            <div className={styles.categoriesCard}>
              <div className={styles.asideSectionLabel}>TAGS</div>
              <div className={styles.tagList}>
                {contact.categories.map((cat) => (
                  <span key={cat} className={styles.tagPill}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes card - full width */}
        {contact.note && (
          <div className={styles.notesFull}>
            <div className={styles.notesCard}>
              <div className={styles.notesTitle}>NOTES</div>
              {inlineEditing?.field === 'note' ? (
                <textarea
                  className={styles.inlineInput}
                  style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
                  value={inlineEditing.value}
                  onChange={(e) =>
                    setInlineEditing({ ...inlineEditing, value: e.target.value })
                  }
                  onBlur={() => saveInlineEdit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') cancelInlineEdit()
                  }}
                  autoFocus
                />
              ) : (
                <div
                  className={styles.notesText}
                  onDoubleClick={() => startInlineEdit('note', contact.note)}
                >
                  <MarkdownView text={contact.note} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
