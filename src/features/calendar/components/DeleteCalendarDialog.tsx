import type { JSX } from 'react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useCalendarStore } from '@/store/calendarStore'
import styles from './DeleteDialog.module.css'

interface DeleteCalendarDialogProps {
  isOpen: boolean
  calendarId: string | null
  calendarName: string
  onClose: () => void
  onConfirm: () => void
}

export function DeleteCalendarDialog({
  isOpen,
  calendarId,
  calendarName,
  onClose,
  onConfirm,
}: DeleteCalendarDialogProps): JSX.Element | null {
  const [confirmText, setConfirmText] = useState('')
  const events = useCalendarStore((state) => state.events)

  useEffect(() => {
    if (isOpen) {
      setConfirmText('')
    }
  }, [isOpen])

  const eventCount = calendarId
    ? events.filter((e) => e.calendarId === calendarId).length
    : 0

  const handleConfirm = (): void => {
    if (confirmText === calendarName) {
      onConfirm()
      handleClose()
    }
  }

  const handleClose = (): void => {
    setConfirmText('')
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className={styles.header}>
          <h3 className={styles.title} id="delete-dialog-title">
            Delete Calendar
          </h3>
          <button className={styles.closeButton} onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <p style={{ marginBottom: '12px', color: '#202124' }}>
            You are about to delete the calendar <strong>"{calendarName}"</strong>.
          </p>

          {eventCount > 0 && (
            <p style={{ marginBottom: '12px', color: '#ea4335' }}>
              This will permanently delete <strong>{eventCount} event{eventCount !== 1 ? 's' : ''}</strong>{' '}
              from both Calino and the server. This action cannot be undone.
            </p>
          )}

          <p style={{ marginBottom: '8px', fontSize: '14px', color: '#5f6368' }}>
            Type the calendar name to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={calendarName}
            autoFocus
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #dadce0',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className={styles.deleteButton}
            onClick={handleConfirm}
            disabled={confirmText !== calendarName}
            style={{ opacity: confirmText !== calendarName ? 0.5 : 1 }}
          >
            Delete Calendar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
