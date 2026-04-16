import type { JSX } from 'react'
import styles from './RecurrenceDialog.module.css'

type RecurrenceEditMode = 'all' | 'future' | 'this'

interface RecurrenceDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (mode: RecurrenceEditMode) => void
}

export function RecurrenceDialog({
  isOpen,
  onClose,
  onConfirm,
}: RecurrenceDialogProps): JSX.Element | null {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>Edit recurring event</div>
        <div className={styles.options}>
          <button className={styles.option} onClick={() => onConfirm('all')}>
            All events
          </button>
          <button className={`${styles.option} ${styles.optionPrimary}`} onClick={() => onConfirm('this')}>
            This event only
          </button>
          <div className={styles.divider} />
          <button className={`${styles.option} ${styles.cancel}`} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
