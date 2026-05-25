import type { JSX } from 'react'
import { useState } from 'react'
import type { RecurrenceRule, Reminder } from '@/types'
import { useSettingsStore } from '@/store/settingsStore'
import styles from './EventModal.module.css'

function formatDuration(startTime: string, endTime: string): string {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const startMinutes = sh * 60 + sm
  const endMinutes = eh * 60 + em
  const diff = endMinutes - startMinutes
  if (diff <= 0) return ''
  const hours = Math.floor(diff / 60)
  const mins = diff % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

interface EventFormFieldsProps {
  isAllDay: boolean
  onIsAllDayChange: (checked: boolean) => void
  startDate: string
  onStartDateChange: (date: string) => void
  startTime: string
  onStartTimeChange: (time: string) => void
  endDate: string
  onEndDateChange: (date: string) => void
  endTime: string
  onEndTimeChange: (time: string) => void
  recurrence: RecurrenceRule['frequency'] | 'none'
  onRecurrenceChange: (recurrence: RecurrenceRule['frequency'] | 'none') => void
  byWeekday?: number[]
  onByWeekdayChange?: (days: number[]) => void
  travelDuration: number | undefined
  onTravelDurationChange: (duration: number | undefined) => void
  reminders: Reminder[]
  onRemindersChange: (reminders: Reminder[]) => void
  transparency?: 'opaque' | 'transparent'
  onTransparencyChange: (transparency: 'opaque' | 'transparent') => void
}

const TRAVEL_DURATION_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: 'None' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
]

const RECURRENCE_OPTIONS: { value: RecurrenceRule['frequency'] | 'none'; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'At time of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
]

const BASE_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekdayLabels(firstDayOfWeek: number): string[] {
  const labels: string[] = []
  for (let i = 0; i < 7; i++) {
    labels.push(BASE_WEEKDAY_LABELS[(i + firstDayOfWeek) % 7])
  }
  return labels
}

export function EventFormFields({
  isAllDay,
  onIsAllDayChange,
  startDate,
  onStartDateChange,
  startTime,
  onStartTimeChange,
  endDate,
  onEndDateChange,
  endTime,
  onEndTimeChange,
  recurrence,
  onRecurrenceChange,
  byWeekday = [],
  onByWeekdayChange,
  travelDuration,
  onTravelDurationChange,
  reminders,
  onRemindersChange,
  transparency = 'opaque',
  onTransparencyChange,
}: EventFormFieldsProps): JSX.Element {
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const firstDayOfWeek = useSettingsStore((state) => state.firstDayOfWeek)
  const weekdayLabels = getWeekdayLabels(firstDayOfWeek)

  const handleWeekdayToggle = (displayIndex: number): void => {
    if (!onByWeekdayChange) return
    const actualWeekday = (displayIndex + firstDayOfWeek) % 7
    const newByWeekday = byWeekday.includes(actualWeekday)
      ? byWeekday.filter((d: number) => d !== actualWeekday)
      : [...byWeekday, actualWeekday].sort((a, b) => a - b)
    onByWeekdayChange(newByWeekday)
  }

  return (
    <>
      <div className={styles.dateTimeRow}>
        <div className={styles.dateTimeGroup}>
          <label className={styles.label}>Start</label>
          <div className={styles.dateTimeInputs}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const newDate = e.target.value
                onStartDateChange(newDate)
                if (newDate > endDate) {
                  onEndDateChange(newDate)
                }
              }}
              className={styles.input}
              required
            />
            {!isAllDay && (
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  const newStart = e.target.value
                  onStartTimeChange(newStart)
                  if (startDate === endDate && newStart >= endTime) {
                    // Add 1 hour to the new start time
                    const [h, m] = newStart.split(':').map(Number)
                    const endHour = h + 1
                    onEndTimeChange(`${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
                  }
                }}
                className={styles.input}
                required
              />
            )}
          </div>
        </div>

        {!isAllDay && (
          <div className={styles.durationLabel}>
            {formatDuration(startTime, endTime)}
          </div>
        )}

        <div className={styles.dateTimeGroup}>
          <label className={styles.label}>End</label>
          <div className={styles.dateTimeInputs}>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className={styles.input}
              required
            />
            {!isAllDay && (
              <input
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className={styles.input}
                required
              />
            )}
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={isAllDay}
            onChange={(e) => onIsAllDayChange(e.target.checked)}
          />
          <span>All day</span>
        </label>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={transparency === 'transparent'}
            onChange={(e) => onTransparencyChange(e.target.checked ? 'transparent' : 'opaque')}
          />
          <span>Available</span>
        </label>

        <button
          type="button"
          className={styles.chevronButton}
          onClick={() => setShowMoreOptions(!showMoreOptions)}
        >
          <svg aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: showMoreOptions ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span style={{ fontSize: '12px', marginLeft: '4px' }}>More</span>
        </button>
      </div>

      {showMoreOptions && (
        <div className={styles.moreOptionsSection}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="recurrence-select">
                Repeat
              </label>
              <select
                id="recurrence-select"
                value={recurrence}
                onChange={(e) =>
                  onRecurrenceChange(e.target.value as RecurrenceRule['frequency'] | 'none')
                }
                className={styles.select}
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {recurrence === 'daily' && onByWeekdayChange && (
            <div className={styles.weekdayField}>
              <label className={styles.label} style={{ fontWeight: 600 }}>
                On days:
              </label>
              <div className={styles.weekdayRow}>
                {weekdayLabels.map((label, displayIndex) => {
                  const actualWeekday = (displayIndex + firstDayOfWeek) % 7
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`${styles.weekdayBtn} ${byWeekday.includes(actualWeekday) ? styles.excluded : ''}`}
                      onClick={() => handleWeekdayToggle(displayIndex)}
                      aria-pressed={byWeekday.includes(actualWeekday)}
                      aria-label={`Include ${label}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="travel-duration-select">
                Travel time
              </label>
              <select
                id="travel-duration-select"
                value={travelDuration ?? ''}
                onChange={(e) =>
                  onTravelDurationChange(e.target.value ? Number(e.target.value) : undefined)
                }
                className={styles.select}
              >
                {TRAVEL_DURATION_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value ?? ''}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="reminder-select">
                Reminder
              </label>
              <select
                id="reminder-select"
                value={reminders[0]?.minutesBefore ?? ''}
                onChange={(e) => {
                  const value = e.target.value ? Number(e.target.value) : undefined
                  if (value !== undefined) {
                    onRemindersChange([{ id: 'default', minutesBefore: value, method: 'popup' }])
                  } else {
                    onRemindersChange([])
                  }
                }}
                className={styles.select}
              >
                <option value="">None</option>
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
