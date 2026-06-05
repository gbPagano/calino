import type { JSX } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import styles from './Settings.module.css'

export function CalendarSettings(): JSX.Element {
  const defaultView = useSettingsStore((s) => s.defaultView)
  const showWeekNumbers = useSettingsStore((s) => s.showWeekNumbers)
  const eventDensity = useSettingsStore((s) => s.eventDensity)
  const compactRecurringEvents = useSettingsStore((s) => s.compactRecurringEvents)
  const compressPastWeeks = useSettingsStore((s) => s.compressPastWeeks)
  const monthViewEventLimit = useSettingsStore((s) => s.monthViewEventLimit)
  const hideCompletedTasksInMonthView = useSettingsStore((s) => s.hideCompletedTasksInMonthView)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Calendar</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Display</div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Default View</div>
            <div className={styles.rowDesc}>The view shown when you open the app</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg}>
              {[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
                { value: 'day', label: 'Day' },
                { value: 'agenda', label: 'Agenda' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${defaultView === opt.value ? styles.segTabActive : ''}`}
                  onClick={() =>
                    updateSettings({ defaultView: opt.value as 'month' | 'week' | 'day' | 'agenda' })
                  }
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Show Week Numbers</div>
            <div className={styles.rowDesc}>Display ISO week numbers on the left of each row</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={showWeekNumbers}
                onChange={() => updateSettings({ showWeekNumbers: !showWeekNumbers })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Event Display Density</div>
            <div className={styles.rowDesc}>How compact event chips appear in the grid</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg}>
              {[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${eventDensity === opt.value ? styles.segTabActive : ''}`}
                  onClick={() =>
                    updateSettings({ eventDensity: opt.value as 'comfortable' | 'compact' })
                  }
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Grid Behaviour</div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Compact Recurring Events</div>
            <div className={styles.rowDesc}>Show recurring events as minimal chips in month view</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={compactRecurringEvents}
                onChange={() => updateSettings({ compactRecurringEvents: !compactRecurringEvents })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Compact Past Weeks</div>
            <div className={styles.rowDesc}>Reduce height of rows that have already passed</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={compressPastWeeks}
                onChange={() => updateSettings({ compressPastWeeks: !compressPastWeeks })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Hide Completed Tasks</div>
            <div className={styles.rowDesc}>Don't show done tasks in the calendar grid</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={hideCompletedTasksInMonthView}
                onChange={() =>
                  updateSettings({ hideCompletedTasksInMonthView: !hideCompletedTasksInMonthView })
                }
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Events Before Rollup</div>
            <div className={styles.rowDesc}>How many events to show per day before showing "+N more"</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              style={{ minWidth: '120px' }}
              value={monthViewEventLimit}
              onChange={(e) => updateSettings({ monthViewEventLimit: Number(e.target.value) })}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}
