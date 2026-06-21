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
    <section className={`${styles.section} ${styles.sectionActive}`} data-component="calendar-settings">
      <h1 className={styles.pageTitle}>Calendar</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Display</div>
        <div className={styles.row} data-component="setting-row" data-setting="default-view" data-value={defaultView}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Default View</div>
            <div className={styles.rowDesc}>The view shown when you open the app</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg} role="radiogroup" aria-label="Default view">
              {[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
                { value: 'day', label: 'Day' },
                { value: 'agenda', label: 'Agenda' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${defaultView === opt.value ? styles.segTabActive : ''}`}
                  role="radio"
                  aria-checked={defaultView === opt.value}
                  data-active={defaultView === opt.value ? 'true' : undefined}
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
        <div className={styles.row} data-component="setting-row" data-setting="show-week-numbers" data-value={String(showWeekNumbers)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Show Week Numbers</div>
            <div className={styles.rowDesc}>Display ISO week numbers on the left of each row</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="show-week-numbers">
              <input
                type="checkbox"
                checked={showWeekNumbers}
                aria-label="Show week numbers"
                onChange={() => updateSettings({ showWeekNumbers: !showWeekNumbers })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={`${styles.row} ${styles.rowDisabled}`} data-component="setting-row" data-setting="event-density" data-value={eventDensity} title="Not available yet">
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Event Display Density</div>
            <div className={styles.rowDesc}>How compact event chips appear in the grid</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg} role="radiogroup" aria-label="Event density">
              {[
                { value: 'compact', label: 'Compact' },
                { value: 'comfortable', label: 'Comfortable' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${eventDensity === opt.value ? styles.segTabActive : ''}`}
                  role="radio"
                  aria-checked={eventDensity === opt.value}
                  data-active={eventDensity === opt.value ? 'true' : undefined}
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
        <div className={styles.row} data-component="setting-row" data-setting="compact-recurring-events" data-value={String(compactRecurringEvents)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Compact Recurring Events</div>
            <div className={styles.rowDesc}>Show recurring events as minimal chips in month view</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="compact-recurring-events">
              <input
                type="checkbox"
                checked={compactRecurringEvents}
                aria-label="Compact recurring events"
                onChange={() => updateSettings({ compactRecurringEvents: !compactRecurringEvents })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row} data-component="setting-row" data-setting="compress-past-weeks" data-value={String(compressPastWeeks)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Compact Past Weeks</div>
            <div className={styles.rowDesc}>Reduce height of rows that have already passed</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="compress-past-weeks">
              <input
                type="checkbox"
                checked={compressPastWeeks}
                aria-label="Compact past weeks"
                onChange={() => updateSettings({ compressPastWeeks: !compressPastWeeks })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row} data-component="setting-row" data-setting="hide-completed-tasks" data-value={String(hideCompletedTasksInMonthView)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Hide Completed Tasks</div>
            <div className={styles.rowDesc}>Don't show done tasks in the calendar grid</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="hide-completed-tasks">
              <input
                type="checkbox"
                checked={hideCompletedTasksInMonthView}
                aria-label="Hide completed tasks"
                onChange={() =>
                  updateSettings({ hideCompletedTasksInMonthView: !hideCompletedTasksInMonthView })
                }
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row} data-component="setting-row" data-setting="month-view-event-limit" data-value={String(monthViewEventLimit)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Events Before Rollup</div>
            <div className={styles.rowDesc}>How many events to show per day before showing "+N more"</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              style={{ minWidth: '120px' }}
              value={monthViewEventLimit}
              aria-label="Events before rollup"
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
