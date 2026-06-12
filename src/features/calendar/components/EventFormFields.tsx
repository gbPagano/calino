import type { JSX } from 'react'
import { useState, useRef } from 'react'
import type { RecurrenceRule, Reminder, CalendarEvent, CalendarAttachment } from '@/types'
import { useSettingsStore } from '@/store/settingsStore'
import { useScrollInput } from '@/hooks/useScrollInput'
import { AttachmentSection } from './AttachmentSection'
import styles from './EventModal.module.css'

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
  recurring: boolean
  onRecurringChange: (recurring: boolean) => void
  recurrence: RecurrenceRule['frequency']
  onRecurrenceChange: (recurrence: RecurrenceRule['frequency']) => void
  interval: number
  onIntervalChange: (interval: number) => void
  byWeekday?: number[]
  onByWeekdayChange?: (days: number[]) => void
  byMonthDay?: number[]
  onByMonthDayChange?: (days: number[]) => void
  byMonth?: number[]
  onByMonthChange?: (months: number[]) => void
  bySetPos?: number[]
  onBySetPosChange?: (positions: number[]) => void
  endCondition: 'never' | 'on' | 'after'
  onEndConditionChange: (cond: 'never' | 'on' | 'after') => void
  endOnDate: string
  onEndOnDateChange: (date: string) => void
  endAfterCount: number
  onEndAfterCountChange: (count: number) => void
  travelDuration: number | undefined
  onTravelDurationChange: (duration: number | undefined) => void
  reminders: Reminder[]
  onRemindersChange: (reminders: Reminder[]) => void
  transparency?: 'opaque' | 'transparent'
  onTransparencyChange: (transparency: 'opaque' | 'transparent') => void
  relatedTo: string[]
  onRelatedToChange: (ids: string[]) => void
  candidateEvents: CalendarEvent[]
  attachments: CalendarAttachment[]
  onAttachmentsChange: (attachments: CalendarAttachment[]) => void
  attachmentEventId: string | null
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

const RECURRENCE_OPTIONS: { value: RecurrenceRule['frequency']; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

type MonthlyPattern = 'dayOfMonth' | 'nthWeekday' | 'lastWeekday'

function detectMonthlyPattern(byWeekday: number[] | undefined, bySetPos: number[] | undefined): MonthlyPattern {
  if (byWeekday && byWeekday.length > 0) {
    if (bySetPos && bySetPos.length === byWeekday.length && bySetPos.every((p) => p === -1)) {
      return 'lastWeekday'
    }
    return 'nthWeekday'
  }
  return 'dayOfMonth'
}

function defaultNthWeekday(startDate: string): { byWeekday: number[]; bySetPos: number[] } {
  const [yStr, mStr, dStr] = startDate.split('-').map((s) => parseInt(s, 10))
  if (!yStr || !mStr || !dStr) return { byWeekday: [1], bySetPos: [1] }
  const startWeekday = new Date(Date.UTC(yStr, mStr - 1, dStr)).getUTCDay()
  const nth = Math.ceil(dStr / 7)
  return { byWeekday: [startWeekday], bySetPos: [nth] }
}

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
  recurring,
  onRecurringChange,
  recurrence,
  onRecurrenceChange,
  interval,
  onIntervalChange,
  byWeekday = [],
  onByWeekdayChange,
  byMonthDay = [],
  onByMonthDayChange,
  byMonth = [],
  onByMonthChange,
  bySetPos = [],
  onBySetPosChange,
  endCondition,
  onEndConditionChange,
  endOnDate,
  onEndOnDateChange,
  endAfterCount,
  onEndAfterCountChange,
  travelDuration,
  onTravelDurationChange,
  reminders,
  onRemindersChange,
  transparency = 'opaque',
  onTransparencyChange,
  relatedTo,
  onRelatedToChange,
  candidateEvents,
  attachments,
  onAttachmentsChange,
  attachmentEventId,
}: EventFormFieldsProps): JSX.Element {
  const [moreOpen, setMoreOpen] = useState(false)
  const firstDayOfWeek = useSettingsStore((state) => state.firstDayOfWeek)
  const weekdayLabels = getWeekdayLabels(firstDayOfWeek)

  const startDateRef = useRef<HTMLInputElement>(null)
  const startTimeRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)
  const endTimeRef = useRef<HTMLInputElement>(null)
  useScrollInput([startDateRef, startTimeRef, endDateRef, endTimeRef])

  const handleWeekdayToggle = (displayIndex: number): void => {
    if (!onByWeekdayChange) return
    const actualWeekday = (displayIndex + firstDayOfWeek) % 7
    const newByWeekday = byWeekday.includes(actualWeekday)
      ? byWeekday.filter((d: number) => d !== actualWeekday)
      : [...byWeekday, actualWeekday].sort((a, b) => a - b)
    onByWeekdayChange(newByWeekday)
  }

  // When the user toggles the Recurring checkbox on, also open the
  // "More" panel so the recurrence controls are visible. This is a
  // pure user-action handler — it never fires on initial mount or
  // when the form receives new props from the parent.
  const handleRecurringToggle = (next: boolean): void => {
    if (next && !recurring) {
      setMoreOpen(true)
    }
    onRecurringChange(next)
  }

  return (
    <>
      <div className={styles.dateTimeRow}>
        <div className={styles.dateTimeGroup}>
          <label className={styles.label}>Start</label>
          <div className={styles.dateTimeInputs}>
            <input
              type="date"
              ref={startDateRef}
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
                ref={startTimeRef}
                value={startTime}
                onChange={(e) => {
                  const newStart = e.target.value
                  onStartTimeChange(newStart)
                  if (startDate === endDate && newStart >= endTime) {
                    // Add 1 hour to the new start time
                    const [h, m] = newStart.split(':').map(Number)
                    const endHour = (h + 1) % 24
                    onEndTimeChange(`${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
                  }
                }}
                className={styles.input}
                required
              />
            )}
          </div>
        </div>

        <div className={styles.dateTimeGroup}>
          <label className={styles.label}>End</label>
          <div className={styles.dateTimeInputs}>
            <input
              type="date"
              ref={endDateRef}
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className={styles.input}
              required
            />
            {!isAllDay && (
              <input
                type="time"
                ref={endTimeRef}
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

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => handleRecurringToggle(e.target.checked)}
          />
          <span>Recurring</span>
        </label>

        <button
          type="button"
          className={styles.chevronButton}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <svg aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              transform: moreOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span style={{ fontSize: '12px', marginLeft: '4px' }}>More</span>
        </button>
      </div>

      <div
        className={`${styles.moreOptionsWrapper} ${moreOpen ? styles.moreOptionsOpen : styles.moreOptionsClosed}`}
        aria-hidden={!moreOpen}
      >
        <div className={styles.moreOptionsSection}>
          {recurring && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="recurrence-select">
                  Repeat
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    id="recurrence-select"
                    value={recurrence}
                    onChange={(e) =>
                      onRecurrenceChange(e.target.value as RecurrenceRule['frequency'])
                    }
                    className={styles.select}
                  >
                    {RECURRENCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>every</span>
                  <input
                    id="interval-input"
                    type="number"
                    min={1}
                    max={99}
                    value={interval}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      onIntervalChange(isNaN(n) || n < 1 ? 1 : Math.min(n, 99))
                    }}
                    className={styles.input}
                    style={{ width: '60px' }}
                    aria-label="Repeat interval"
                  />
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {recurrence === 'daily' ? (interval === 1 ? 'day' : 'days')
                      : recurrence === 'weekly' ? (interval === 1 ? 'week' : 'weeks')
                      : recurrence === 'monthly' ? (interval === 1 ? 'month' : 'months')
                      : (interval === 1 ? 'year' : 'years')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {recurring && recurrence === 'weekly' && onByWeekdayChange && (
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

          {recurring && recurrence === 'monthly' && onByMonthDayChange && onByWeekdayChange && onBySetPosChange && (
            <div className={styles.field}>
              <label className={styles.label} style={{ fontWeight: 600 }}>Monthly pattern</label>
              <MonthlyPatternPicker
                startDate={startDate}
                weekdayLabels={weekdayLabels}
                byMonthDay={byMonthDay}
                byWeekday={byWeekday}
                bySetPos={bySetPos}
                onByMonthDayChange={onByMonthDayChange}
                onByWeekdayChange={onByWeekdayChange}
                onBySetPosChange={onBySetPosChange}
              />
            </div>
          )}

          {recurring && recurrence === 'yearly' && onByMonthChange && (
            <div className={styles.field}>
              <label className={styles.label} style={{ fontWeight: 600 }}>In months</label>
              <YearlyMonthPicker byMonth={byMonth} onByMonthChange={onByMonthChange} />
            </div>
          )}

          {recurring && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="end-condition-select">
                  Ends
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    id="end-condition-select"
                    value={endCondition}
                    onChange={(e) =>
                      onEndConditionChange(e.target.value as 'never' | 'on' | 'after')
                    }
                    className={styles.select}
                  >
                    <option value="never">Never</option>
                    <option value="on">On date</option>
                    <option value="after">After occurrences</option>
                  </select>
                  {endCondition === 'on' && (
                    <input
                      type="date"
                      value={endOnDate}
                      onChange={(e) => onEndOnDateChange(e.target.value)}
                      className={styles.input}
                      style={{ width: '160px' }}
                      aria-label="End date"
                    />
                  )}
                  {endCondition === 'after' && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={endAfterCount}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10)
                          onEndAfterCountChange(isNaN(n) || n < 1 ? 1 : Math.min(n, 999))
                        }}
                        className={styles.input}
                        style={{ width: '70px' }}
                        aria-label="Number of occurrences"
                      />
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        occurrence{endAfterCount === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.row} ${recurring && moreOpen ? styles.divider : ''}`}>
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

          {/* Related to */}
          {candidateEvents.length > 0 && (
            <div className={styles.categoriesContainer}>
              <div className={styles.categoriesLabel}>Related to</div>
              <div className={styles.categoriesList}>
                {candidateEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`${styles.categoryChip} ${
                      relatedTo.includes(ev.id) ? styles.categoryChipSelected : ''
                    }`}
                    onClick={() => {
                      if (relatedTo.includes(ev.id)) {
                        onRelatedToChange(relatedTo.filter((id) => id !== ev.id))
                      } else {
                        onRelatedToChange([...relatedTo, ev.id])
                      }
                    }}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AttachmentSection
            attachments={attachments}
            onAttachmentsChange={onAttachmentsChange}
            eventId={attachmentEventId}
            compact
            showLabel={false}
          />
        </div>
      </div>
    </>
  )
}

interface MonthlyPatternPickerProps {
  startDate: string
  weekdayLabels: string[]
  byMonthDay: number[]
  byWeekday: number[]
  bySetPos: number[]
  onByMonthDayChange: (days: number[]) => void
  onByWeekdayChange: (days: number[]) => void
  onBySetPosChange: (positions: number[]) => void
}

function MonthlyPatternPicker({
  startDate,
  weekdayLabels,
  byMonthDay,
  byWeekday,
  bySetPos,
  onByMonthDayChange,
  onByWeekdayChange,
  onBySetPosChange,
}: MonthlyPatternPickerProps): JSX.Element {
  const pattern = detectMonthlyPattern(byWeekday, bySetPos)
  const startDay = parseInt(startDate.split('-')[2] || '1', 10)
  const startMonth = parseInt(startDate.split('-')[1] || '1', 10)
  const startYear = parseInt(startDate.split('-')[0] || '2025', 10)
  const startWeekday = new Date(Date.UTC(startYear, startMonth - 1, startDay)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(startYear, startMonth, 0)).getUTCDate()

  const nthFromByWeekday = byWeekday[0] !== undefined ? byWeekday[0] : startWeekday
  const posFromBySetPos = bySetPos[0] !== undefined ? bySetPos[0] : Math.ceil(startDay / 7)
  const dayFromByMonthDay = byMonthDay[0] !== undefined ? byMonthDay[0] : startDay

  const days31 = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <select
        value={pattern}
        onChange={(e) => {
          const next = e.target.value as MonthlyPattern
          if (next === 'dayOfMonth') {
            onByMonthDayChange([dayFromByMonthDay])
            onByWeekdayChange([])
            onBySetPosChange([])
          } else if (next === 'nthWeekday') {
            const inferred = defaultNthWeekday(startDate)
            onByWeekdayChange([inferred.byWeekday[0]!])
            onBySetPosChange([inferred.bySetPos[0]!])
            onByMonthDayChange([])
          } else {
            const wk = nthFromByWeekday
            onByWeekdayChange([wk])
            onBySetPosChange([-1])
            onByMonthDayChange([])
          }
        }}
        className={styles.select}
        style={{ maxWidth: '220px' }}
      >
        <option value="dayOfMonth">On day of the month</option>
        <option value="nthWeekday">On the nth weekday</option>
        <option value="lastWeekday">On the last weekday</option>
      </select>

      {pattern === 'dayOfMonth' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>Day</span>
          <select
            value={dayFromByMonthDay}
            onChange={(e) => onByMonthDayChange([parseInt(e.target.value, 10)])}
            className={styles.select}
            style={{ width: '90px' }}
          >
            {days31.map((d) => (
              <option key={d} value={d}>
                {d}{d === daysInMonth ? ' (last day)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {(pattern === 'nthWeekday' || pattern === 'lastWeekday') && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {pattern === 'nthWeekday' && (
            <select
              value={posFromBySetPos}
              onChange={(e) => onBySetPosChange([parseInt(e.target.value, 10)])}
              className={styles.select}
              style={{ width: '110px' }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'First' : n === 2 ? 'Second' : n === 3 ? 'Third' : n === 4 ? 'Fourth' : 'Fifth'}
                </option>
              ))}
            </select>
          )}
          <select
            value={nthFromByWeekday}
            onChange={(e) => onByWeekdayChange([parseInt(e.target.value, 10)])}
            className={styles.select}
            style={{ width: '120px' }}
          >
            {Array.from({ length: 7 }, (_, i) => i).map((d) => (
              <option key={d} value={d}>{weekdayLabels[d]}</option>
            ))}
          </select>
          {pattern === 'lastWeekday' && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>of the month</span>}
        </div>
      )}
    </div>
  )
}

interface YearlyMonthPickerProps {
  byMonth: number[]
  onByMonthChange: (months: number[]) => void
}

function YearlyMonthPicker({ byMonth, onByMonthChange }: YearlyMonthPickerProps): JSX.Element {
  const toggle = (m: number): void => {
    if (byMonth.includes(m)) {
      onByMonthChange(byMonth.filter((x) => x !== m))
    } else {
      onByMonthChange([...byMonth, m].sort((a, b) => a - b))
    }
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {MONTH_SHORT.map((label, idx) => {
        const m = idx + 1
        const selected = byMonth.length === 0 || byMonth.includes(m)
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            aria-pressed={byMonth.length === 0 ? true : selected}
            className={`${styles.weekdayBtn} ${selected ? styles.excluded : ''}`}
            style={{ minWidth: '52px' }}
          >
            {label}
          </button>
        )
      })}
      {byMonth.length > 0 && (
        <button
          type="button"
          onClick={() => onByMonthChange([])}
          className={styles.weekdayBtn}
          style={{ minWidth: '52px', fontSize: '11px' }}
          aria-label="Reset months"
        >
          All
        </button>
      )}
    </div>
  )
}
