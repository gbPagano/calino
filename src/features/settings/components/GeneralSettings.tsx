import type { JSX } from 'react'
import {
  useSettingsStore,
  TIMEZONE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
} from '@/store/settingsStore'
import styles from './Settings.module.css'

export function GeneralSettings(): JSX.Element {
  const timezone = useSettingsStore((s) => s.timezone)
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const timeFormat = useSettingsStore((s) => s.timeFormat)
  const firstDayOfWeek = useSettingsStore((s) => s.firstDayOfWeek)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>General</h1>
      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Timezone</div>
            <div className={styles.rowDesc}>All events will be displayed in this timezone</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={timezone}
              onChange={(e) => updateSettings({ timezone: e.target.value })}
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Date Format</div>
            <div className={styles.rowDesc}>How dates appear throughout the app</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={dateFormat}
              onChange={(e) =>
                updateSettings({
                  dateFormat: e.target.value as 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd',
                })
              }
            >
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Time Format</div>
            <div className={styles.rowDesc}>12-hour or 24-hour time display</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg}>
              {TIME_FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${timeFormat === opt.value ? styles.segTabActive : ''}`}
                  onClick={() => updateSettings({ timeFormat: opt.value as '12h' | '24h' })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>First Day of Week</div>
            <div className={styles.rowDesc}>Start of the week in week and day views</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg}>
              {(
                [
                  { value: 6 as const, label: 'Saturday' },
                  { value: 0 as const, label: 'Sunday' },
                  { value: 1 as const, label: 'Monday' },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${firstDayOfWeek === opt.value ? styles.segTabActive : ''}`}
                  onClick={() =>
                    updateSettings({ firstDayOfWeek: opt.value })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Language</div>
            <div className={styles.rowDesc}>Interface language</div>
          </div>
          <div className={styles.rowControl}>
            <select className={styles.select} defaultValue="en">
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}
