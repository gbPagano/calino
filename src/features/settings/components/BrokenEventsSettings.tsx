import type { JSX } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import * as storage from '@/features/caldav/sync/accountStorage'
import { formatBrokenEventDate as formatDate } from '../lib/format'
import styles from './Settings.module.css'

export function BrokenEventsSettings(): JSX.Element {
  const brokenEvents = useCalendarStore((state) => state.brokenEvents)
  const removeBrokenEvent = useCalendarStore((state) => state.removeBrokenEvent)
  const addEvent = useCalendarStore((state) => state.addEvent)

  const handleFix = (broken: (typeof brokenEvents)[0]): void => {
    const { event } = broken
    const fixedEvent = { ...event, start: event.end, end: event.start }
    removeBrokenEvent(event.id)
    addEvent(fixedEvent)
    storage.addPendingChange({
      type: 'update',
      eventId: event.id,
      calendarId: event.calendarId,
      data: JSON.stringify(fixedEvent),
    })
  }

  const handleDelete = (broken: (typeof brokenEvents)[0]): void => {
    const { event } = broken
    storage.addPendingChange({
      type: 'delete',
      eventId: event.id,
      calendarId: event.calendarId,
      data: JSON.stringify(event),
    })
    removeBrokenEvent(event.id)
  }

  const handleFixAll = (): void => {
    for (const broken of [...brokenEvents]) {
      handleFix(broken)
    }
  }

  const handleDeleteAll = (): void => {
    for (const broken of [...brokenEvents]) {
      handleDelete(broken)
    }
  }

  if (brokenEvents.length === 0) {
    return (
      <section className={`${styles.section} ${styles.sectionActive}`} data-component="broken-events-settings">
        <h1 className={styles.pageTitle}>Data Issues</h1>
        <div className={styles.group}>
          <div className={styles.emptyState}>
            <p>No broken events found. All events have valid date ranges.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`${styles.section} ${styles.sectionActive}`} data-component="broken-events-settings">
      <h1 className={styles.pageTitle}>Data Issues</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Broken Events ({brokenEvents.length})</div>
        <p className={styles.rowDesc} style={{ padding: '12px 20px 0' }}>
          These events have a start date after their end date and cannot be displayed.
          You can fix them by swapping the dates, or delete them entirely.
        </p>

        <div className={styles.brokenList}>
          {brokenEvents.map((broken) => (
            <div key={broken.event.id} className={styles.brokenItem} data-component="broken-event-row" data-event-id={broken.event.id}>
              <div className={styles.brokenInfo}>
                <div className={styles.brokenTitle}>{broken.event.title || 'Untitled Event'}</div>
                <div className={styles.brokenDates}>
                  <span>Start: {formatDate(broken.event.start)}</span>
                  <span className={styles.brokenArrow}>→</span>
                  <span>End: {formatDate(broken.event.end)}</span>
                </div>
                <div className={styles.brokenReason}>{broken.reason}</div>
              </div>
              <div className={styles.brokenActions}>
                <button
                  className={styles.actionBtn}
                  onClick={() => handleFix(broken)}
                  type="button"
                >
                  Fix
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={() => handleDelete(broken)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {brokenEvents.length > 1 && (
          <div className={styles.brokenBatchActions}>
            <button
              className={styles.actionBtn}
              onClick={handleFixAll}
              type="button"
            >
              Fix All ({brokenEvents.length})
            </button>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={handleDeleteAll}
              type="button"
            >
              Delete All
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
