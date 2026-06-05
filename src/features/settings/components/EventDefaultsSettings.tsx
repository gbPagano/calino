import type { JSX } from 'react'
import {
  useSettingsStore,
  DURATION_OPTIONS,
  REMINDER_OPTIONS,
} from '@/store/settingsStore'
import { useCalendarStore } from '@/store/calendarStore'
import styles from './Settings.module.css'

export function EventDefaultsSettings(): JSX.Element {
  const defaultDuration = useSettingsStore((s) => s.defaultDuration)
  const defaultReminderMinutes = useSettingsStore((s) => s.defaultReminderMinutes)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const calendars = useCalendarStore((s) => s.calendars)
  const updateCalendar = useCalendarStore((s) => s.updateCalendar)

  const defaultCalendar = calendars.find((c) => c.isDefault) || calendars[0]

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Events</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>New Event Defaults</div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Default Duration</div>
            <div className={styles.rowDesc}>Length of a new event when created by clicking a day</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={defaultDuration}
              onChange={(e) =>
                updateSettings({ defaultDuration: Number(e.target.value) as 15 | 30 | 60 | 90 | 120 })
              }
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Default Calendar</div>
            <div className={styles.rowDesc}>Which calendar new events are added to</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={defaultCalendar?.id || ''}
              onChange={(e) => {
                calendars.forEach((cal) => {
                  updateCalendar(cal.id, { isDefault: cal.id === e.target.value })
                })
              }}
            >
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Display</div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Default Reminder</div>
            <div className={styles.rowDesc}>How far ahead to send the reminder</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={defaultReminderMinutes}
              onChange={(e) => updateSettings({ defaultReminderMinutes: Number(e.target.value) })}
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}
