import type { JSX } from 'react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { format, parseISO, addHours } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import type { CalendarEvent, RecurrenceRule, TaskPriority, Reminder } from '@/types'
import { TaskFormFields } from './TaskFormFields'
import { EventFormFields } from './EventFormFields'
import { RecurrenceDialog } from './RecurrenceDialog'
import { DeleteDialog } from './DeleteDialog'
import { extractOriginalEventId } from '@/lib/events'
import styles from './EventModal.module.css'

const DEFAULT_DURATION_HOURS = 1

type RecurrenceEditMode = 'all' | 'future' | 'this'

interface InitialFormState {
  title: string
  description: string
  location: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  isAllDay: boolean
  calendarId: string
  recurrence: RecurrenceRule['frequency'] | 'none'
  travelDuration: number | undefined
  reminders: Reminder[]
  transparency: 'opaque' | 'transparent'
  categories: string[]
}

function getInitialFormState(
  isModalOpen: boolean,
  selectedEventId: string | null,
  selectedDate: string | null,
  selectedEndDate: string | null,
  events: CalendarEvent[],
  calendars: { id: string; isDefault: boolean }[]
): InitialFormState & { isRecurringInstance: boolean; originalEventId: string | null } {
  const defaultCalendar = calendars.find((c) => c.isDefault) || calendars[0]

  const isEditing = selectedEventId !== null

  let existingEvent: CalendarEvent | undefined
  let isRecurringInstance = false
  let originalEventId: string | null = null

  if (isEditing && selectedEventId) {
    existingEvent = events.find((e) => e.id === selectedEventId)

    if (!existingEvent) {
      const originalId = extractOriginalEventId(selectedEventId)
      if (originalId) {
        existingEvent = events.find((e) => e.id === originalId)
        if (existingEvent) {
          isRecurringInstance = true
          originalEventId = originalId
        }
      }
    }
  }

  if (isModalOpen) {
    if (existingEvent) {
        return {
          title: existingEvent.title,
          description: existingEvent.description || '',
          location: existingEvent.location || '',
          startDate: format(parseISO(existingEvent.start), 'yyyy-MM-dd'),
          startTime: format(parseISO(existingEvent.start), 'HH:mm'),
          endDate: format(parseISO(existingEvent.end), 'yyyy-MM-dd'),
          endTime: format(parseISO(existingEvent.end), 'HH:mm'),
          isAllDay: existingEvent.isAllDay,
          calendarId: existingEvent.calendarId,
          recurrence: existingEvent.recurrence?.frequency || 'none',
          travelDuration: existingEvent.travelDuration,
          reminders: existingEvent.reminders || [],
          transparency: existingEvent.transparency || 'opaque',
          categories: existingEvent.categories || [],
          isRecurringInstance,
          originalEventId,
        }
    }

    if (selectedDate) {
      const dateStr = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate
      let startTimeVal = '09:00'
      let endTimeVal = '10:00'

      if (selectedDate.includes('T')) {
        const time = selectedDate.split('T')[1]
        startTimeVal = time
        const parsedTime = parseISO(`2000-01-01T${time}`)
        endTimeVal = format(addHours(parsedTime, DEFAULT_DURATION_HOURS), 'HH:mm')
      }

      if (selectedEndDate && selectedEndDate.includes('T')) {
        const endTime = selectedEndDate.split('T')[1]
        const endDatePart = selectedEndDate.split('T')[0]
        endTimeVal = endTime
        if (endDatePart !== dateStr) {
          return {
            title: '',
            description: '',
            location: '',
            startDate: dateStr,
            startTime: startTimeVal,
            endDate: endDatePart,
            endTime: endTimeVal,
            isAllDay: false,
            calendarId: defaultCalendar?.id || '',
            recurrence: 'none',
            travelDuration: undefined,
            reminders: [],
            transparency: 'opaque',
            categories: [],
            isRecurringInstance: false,
            originalEventId: null,
          }
        }
      }

      return {
        title: '',
        description: '',
        location: '',
        startDate: dateStr,
        startTime: startTimeVal,
        endDate: dateStr,
        endTime: endTimeVal,
        isAllDay: false,
        calendarId: defaultCalendar?.id || '',
        recurrence: 'none',
        travelDuration: undefined,
        reminders: [],
        transparency: 'opaque',
        categories: [],
        isRecurringInstance: false,
        originalEventId: null,
      }
    }
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  return {
    title: '',
    description: '',
    location: '',
    startDate: today,
    startTime: '09:00',
    endDate: today,
    endTime: '10:00',
    isAllDay: false,
    calendarId: defaultCalendar?.id || '',
    recurrence: 'none',
    travelDuration: undefined,
    reminders: [],
    transparency: 'opaque',
    categories: [],
    isRecurringInstance: false,
    originalEventId: null,
  }
}

export function EventModal(): JSX.Element | null {
  const isModalOpen = useCalendarStore((state) => state.isModalOpen)
  const selectedEventId = useCalendarStore((state) => state.selectedEventId)
  const selectedDate = useCalendarStore((state) => state.selectedDate)
  const selectedEndDate = useCalendarStore((state) => state.selectedEndDate)
  const selectedEventType = useCalendarStore((state) => state.selectedEventType)
  const events = useCalendarStore((state) => state.events)
  const calendars = useCalendarStore((state) => state.calendars)
  const categories = useCalendarStore((state) => state.categories)
  const addEvent = useCalendarStore((state) => state.addEvent)
  const updateEvent = useCalendarStore((state) => state.updateEvent)
  const deleteEvent = useCalendarStore((state) => state.deleteEvent)
  const closeModal = useCalendarStore((state) => state.closeModal)
  const {
    createEvent: createCalDAVEvent,
    updateEvent: updateCalDAVEvent,
    deleteEvent: deleteCalDAVEvent,
  } = useCalDAV()

  const initialState = useMemo(
    () =>
      getInitialFormState(
        isModalOpen,
        selectedEventId,
        selectedDate,
        selectedEndDate,
        events,
        calendars
      ),
    [isModalOpen, selectedEventId, selectedDate, selectedEndDate, events, calendars]
  )

  const [title, setTitle] = useState(initialState.title)
  const [description, setDescription] = useState(initialState.description)
  const [location, setLocation] = useState(initialState.location)
  const [startDate, setStartDate] = useState(initialState.startDate)
  const [startTime, setStartTime] = useState(initialState.startTime)
  const [endDate, setEndDate] = useState(initialState.endDate)
  const [endTime, setEndTime] = useState(initialState.endTime)
  const [isAllDay, setIsAllDay] = useState(initialState.isAllDay)
  const [calendarId, setCalendarId] = useState(initialState.calendarId)
  const [recurrence, setRecurrence] = useState<RecurrenceRule['frequency'] | 'none'>(
    initialState.recurrence
  )
  const [byWeekday, setByWeekday] = useState<number[]>([])
  const [travelDuration, setTravelDuration] = useState<number | undefined>(
    initialState.travelDuration
  )
  const [transparency, setTransparency] = useState<'opaque' | 'transparent'>(
    initialState.transparency
  )
  const [reminders, setReminders] = useState<Reminder[]>(initialState.reminders)
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDescription, setShowDescription] = useState(!!initialState.description)
  const [dueDate, setDueDate] = useState<string>('')
  const [dueTime, setDueTime] = useState<string>('09:00')
  const [dueAllDay, setDueAllDay] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialState.categories)

  const lastSelectedEventId = useRef<string | null>(null)
  const lastSelectedDate = useRef<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (
      selectedEventId !== lastSelectedEventId.current ||
      selectedDate !== lastSelectedDate.current
    ) {
      lastSelectedEventId.current = selectedEventId
      lastSelectedDate.current = selectedDate
      setTitle(initialState.title)
      setDescription(initialState.description)
      setLocation(initialState.location)
      setStartDate(initialState.startDate)
      setStartTime(initialState.startTime)
      setEndDate(initialState.endDate)
      setEndTime(initialState.endTime)
      setIsAllDay(initialState.isAllDay)
      setCalendarId(initialState.calendarId)
      setRecurrence(initialState.recurrence)
      setTravelDuration(initialState.travelDuration)
      setTransparency(initialState.transparency)
      setReminders(initialState.reminders)
      setShowDescription(!!initialState.description)
      setSelectedCategories(initialState.categories)

      const existingEvent = selectedEventId
        ? events.find((e) => e.id === selectedEventId)
        : undefined
      if (existingEvent?.type === 'task') {
        const taskDueDate =
          existingEvent.dueDate?.split('T')[0] ||
          format(parseISO(existingEvent.start), 'yyyy-MM-dd')
        setDueDate(taskDueDate)
        const taskTime = format(parseISO(existingEvent.start), 'HH:mm')
        setDueTime(taskTime !== '00:00' ? taskTime : '09:00')
        setDueAllDay(existingEvent.isAllDay ?? true)
        setCompleted(existingEvent.completed || false)
        setPriority(existingEvent.priority)
      } else if (selectedEventType === 'task') {
        setDueDate(selectedDate || format(new Date(), 'yyyy-MM-dd'))
        setDueTime('09:00')
        setDueAllDay(true)
        setCompleted(false)
        setPriority(undefined)
      } else {
        setDueDate('')
        setDueTime('09:00')
        setDueAllDay(true)
        setCompleted(false)
        setPriority(undefined)
      }
    }
  }, [selectedEventId, selectedDate, initialState, selectedEventType])

  const isEditing = selectedEventId !== null
  const isRecurringEvent = initialState.recurrence !== 'none'
  const originalEventId = initialState.originalEventId
  const existingEventForMode = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : undefined
  const eventType = existingEventForMode?.type
  const isTaskMode = selectedEventType === 'task' || eventType === 'task'

  const hasChanges = useMemo(() => {
    if (!existingEventForMode) return true

    if (isTaskMode) {
      const taskDueDate = dueDate || format(parseISO(existingEventForMode.start), 'yyyy-MM-dd')
      const taskTime = dueAllDay ? '00:00:00' : `${dueTime}:00`
      const currentStart = `${taskDueDate}T${taskTime}`
      return (
        title !== existingEventForMode.title ||
        description !== (existingEventForMode.description || '') ||
        location !== (existingEventForMode.location || '') ||
        currentStart !== existingEventForMode.start ||
        dueAllDay !== (existingEventForMode.isAllDay ?? true) ||
        completed !== (existingEventForMode.completed || false) ||
        priority !== existingEventForMode.priority ||
        calendarId !== existingEventForMode.calendarId ||
        JSON.stringify(selectedCategories) !== JSON.stringify(existingEventForMode.categories || [])
      )
    }

    const localStart = isAllDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`
    const localEnd = isAllDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`
    const existingStart = format(parseISO(existingEventForMode.start), "yyyy-MM-dd'T'HH:mm:ss")
    const existingEnd = format(parseISO(existingEventForMode.end), "yyyy-MM-dd'T'HH:mm:ss")

    return (
      title !== existingEventForMode.title ||
      description !== (existingEventForMode.description || '') ||
      location !== (existingEventForMode.location || '') ||
      localStart !== existingStart ||
      localEnd !== existingEnd ||
      isAllDay !== existingEventForMode.isAllDay ||
      recurrence !== (existingEventForMode.recurrence?.frequency || 'none') ||
      travelDuration !== existingEventForMode.travelDuration ||
      calendarId !== existingEventForMode.calendarId ||
      JSON.stringify(selectedCategories) !== JSON.stringify(existingEventForMode.categories || [])
    )
  }, [
    existingEventForMode,
    isTaskMode,
    title,
    description,
    location,
    startDate,
    startTime,
    endDate,
    endTime,
    isAllDay,
    dueDate,
    dueTime,
    dueAllDay,
    completed,
    priority,
    recurrence,
    travelDuration,
    calendarId,
    selectedCategories,
  ])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()

    if (!title.trim()) {
      window.dispatchEvent(
        new CustomEvent('show-toast', { detail: { message: 'Title is required' } })
      )
      return
    }

    if (isEditing && isRecurringEvent && hasChanges) {
      setShowRecurrenceDialog(true)
      return
    }

    saveEvent('all')
  }

  const saveEvent = async (mode: RecurrenceEditMode): Promise<void> => {
    if (isEditing && !hasChanges) {
      closeModal()
      return
    }

    if (!title.trim()) {
      alert('Title is required')
      window.dispatchEvent(
        new CustomEvent('show-toast', { detail: { message: 'Title is required' } })
      )
      return
    }

    const localStart = isAllDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`
    const localEnd = isAllDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`
    const startDateTime = new Date(localStart).toISOString()
    const endDateTime = new Date(localEnd).toISOString()

    const recurrenceRule: RecurrenceRule | undefined =
      recurrence !== 'none'
        ? {
            frequency: recurrence,
            interval: 1,
            byWeekday: byWeekday.length > 0 ? byWeekday : undefined,
          }
        : undefined

    if (isEditing && selectedEventId) {
      if (mode === 'this' && originalEventId) {
        const masterEvent = events.find((e) => e.id === originalEventId)
        if (!masterEvent) {
          throw new Error('Master event not found')
        }

        const isoDateMatch = selectedEventId.match(
          /(.+)-(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/
        )
        const originalOccurrenceDate = isoDateMatch ? isoDateMatch[2] : null
        if (!originalOccurrenceDate) {
          throw new Error('Invalid selectedEventId format')
        }

        const exceptionEvent: CalendarEvent = {
          id: `${originalEventId}-${originalOccurrenceDate}`,
          calendarId: masterEvent.calendarId,
          title,
          description: description || undefined,
          location: location || undefined,
          start: startDateTime,
          end: endDateTime,
          isAllDay,
          recurrence: undefined,
          rruleString: undefined,
          recurrenceId: originalOccurrenceDate,
          travelDuration,
          reminders,
          transparency,
          sequence: 0,
        }

        addEvent(exceptionEvent)
        try {
          await createCalDAVEvent(masterEvent.calendarId, exceptionEvent)
        } catch {
          // error already handled by useCalDAV
        }
      } else {
        const eventId = originalEventId || selectedEventId
        const taskTime = dueAllDay ? '00:00:00' : `${dueTime}:00`
        const taskEndTime = dueAllDay ? '23:59:59' : `${dueTime}:00`
        const eventStart = isTaskMode && dueDate ? `${dueDate}T${taskTime}` : startDateTime
        const eventEnd = isTaskMode && dueDate ? `${dueDate}T${taskEndTime}` : endDateTime
        // Include time in dueDate for non-all-day tasks so we can display it
        const taskDueDate =
          isTaskMode && dueDate ? (dueAllDay ? dueDate : `${dueDate}T${taskTime}`) : undefined
        updateEvent(eventId!, {
          title,
          description: description || undefined,
          location: location || undefined,
          start: eventStart,
          end: eventEnd,
          isAllDay: isTaskMode ? dueAllDay : isAllDay,
          calendarId,
          recurrence: isTaskMode ? undefined : recurrenceRule,
          travelDuration: isTaskMode ? undefined : travelDuration,
          type: isTaskMode ? 'task' : 'event',
          dueDate: taskDueDate,
          completed: isTaskMode ? completed : undefined,
          priority: isTaskMode ? priority : undefined,
          reminders: isTaskMode ? undefined : reminders,
          transparency: isTaskMode ? undefined : transparency,
          categories: selectedCategories,
        })
        const existingEvent = events.find((e) => e.id === eventId)
        if (existingEvent) {
          try {
            await updateCalDAVEvent(calendarId, {
              ...existingEvent,
              title,
              description: description || undefined,
              location: location || undefined,
              start: eventStart,
              end: eventEnd,
              isAllDay: isTaskMode ? dueAllDay : isAllDay,
              calendarId,
              recurrence: isTaskMode ? undefined : recurrenceRule,
              travelDuration: isTaskMode ? undefined : travelDuration,
              type: isTaskMode ? 'task' : 'event',
              dueDate: taskDueDate,
              completed: isTaskMode ? completed : undefined,
              priority: isTaskMode ? priority : undefined,
              reminders: isTaskMode ? undefined : reminders,
              transparency: isTaskMode ? undefined : transparency,
              categories: selectedCategories,
            })
          } catch {
            // error already handled by useCalDAV
          }
        }
      }
    } else {
      const taskTime = dueAllDay ? '00:00:00' : `${dueTime}:00`
      const taskEndTime = dueAllDay ? '23:59:59' : `${dueTime}:00`
      const eventStart = isTaskMode && dueDate ? `${dueDate}T${taskTime}` : startDateTime
      const eventEnd = isTaskMode && dueDate ? `${dueDate}T${taskEndTime}` : endDateTime
      // Include time in dueDate for non-all-day tasks so we can display it
      const taskDueDate =
        isTaskMode && dueDate ? (dueAllDay ? dueDate : `${dueDate}T${taskTime}`) : undefined

      const newEvent: CalendarEvent = {
        id: uuidv4(),
        title,
        description: description || undefined,
        location: location || undefined,
        start: eventStart,
        end: eventEnd,
        isAllDay: isTaskMode ? dueAllDay : isAllDay,
        calendarId,
        recurrence: isTaskMode ? undefined : recurrenceRule,
        travelDuration: isTaskMode ? undefined : travelDuration,
        type: isTaskMode ? 'task' : 'event',
        dueDate: taskDueDate,
        completed: isTaskMode ? completed : undefined,
        priority: isTaskMode ? priority : undefined,
        reminders: isTaskMode ? undefined : reminders,
        transparency: isTaskMode ? undefined : transparency,
        categories: selectedCategories,
      }
      addEvent(newEvent)
      try {
        await createCalDAVEvent(calendarId, newEvent)
      } catch {
        // error already handled by useCalDAV
      }
    }

    setShowRecurrenceDialog(false)
    closeModal()
  }

  const handleRecurrenceDialogConfirm = async (mode: RecurrenceEditMode): Promise<void> => {
    if (!title.trim()) {
      window.dispatchEvent(
        new CustomEvent('show-toast', { detail: { message: 'Title is required' } })
      )
      return
    }
    await saveEvent(mode)
  }

  const handleDelete = (): void => {
    if (isRecurringEvent) {
      setShowDeleteDialog(true)
      return
    }

    performDelete('all')
  }

  const performDelete = async (mode: RecurrenceEditMode): Promise<void> => {
    if (mode === 'this' && originalEventId) {
      // Add the occurrence's date to excludedDates on the master — do not delete the series
      const occurrenceStartISO = selectedEventId!.slice(originalEventId.length + 1)
      const occurrenceDate = occurrenceStartISO.split('T')[0]
      const masterEvent = events.find((e) => e.id === originalEventId)
      if (masterEvent) {
        const excludedDates = masterEvent.excludedDates || []
        if (!excludedDates.includes(occurrenceDate)) {
          const updatedExcludedDates = [...excludedDates, occurrenceDate]
          updateEvent(originalEventId, { excludedDates: updatedExcludedDates })
          try {
            await updateCalDAVEvent(calendarId, { ...masterEvent, excludedDates: updatedExcludedDates })
          } catch {
            // error already handled by useCalDAV
          }
        }
      }
    } else {
      const eventIdToDelete = originalEventId || selectedEventId
      if (eventIdToDelete) {
        deleteEvent(eventIdToDelete)
        try {
          await deleteCalDAVEvent(calendarId, eventIdToDelete)
        } catch {
          // error already handled by useCalDAV
        }
      }
    }
    setShowDeleteDialog(false)
    closeModal()
  }

  if (!isModalOpen) {
    return null
  }

  return (
    <div className={styles.modalBackdrop} onClick={closeModal}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalBand} />
        <div className={styles.modalHeader}>
          <button
            type="button"
            className={styles.titleEditIcon}
            onClick={() => titleInputRef.current?.focus()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <input
            ref={titleInputRef}
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.modalTitle}
            required
            onInvalid={(e) => {
              e.preventDefault()
              window.dispatchEvent(
                new CustomEvent('show-toast', { detail: { message: 'Title is required' } })
              )
            }}
          />
          <button className={styles.modalClose} onClick={closeModal}>
            ×
          </button>
        </div>
        <hr className={styles.modalDivider} />
        <form
          key={`${selectedEventId}-${selectedDate}-${selectedEventType}`}
          onSubmit={handleSubmit}
          className={styles.modalBody}
        >
          {isTaskMode && (
            <TaskFormFields
              completed={completed}
              onCompletedChange={setCompleted}
              dueDate={dueDate}
              onDueDateChange={setDueDate}
              dueTime={dueTime}
              onDueTimeChange={setDueTime}
              dueAllDay={dueAllDay}
              onDueAllDayChange={setDueAllDay}
              priority={priority}
              onPriorityChange={setPriority}
            />
          )}

          {!isTaskMode && (
            <EventFormFields
              isAllDay={isAllDay}
              onIsAllDayChange={setIsAllDay}
              startDate={startDate}
              onStartDateChange={setStartDate}
              startTime={startTime}
              onStartTimeChange={setStartTime}
              endDate={endDate}
              onEndDateChange={setEndDate}
              endTime={endTime}
              onEndTimeChange={setEndTime}
              recurrence={recurrence}
              onRecurrenceChange={setRecurrence}
              byWeekday={byWeekday}
              onByWeekdayChange={setByWeekday}
              travelDuration={travelDuration}
              onTravelDurationChange={setTravelDuration}
              reminders={reminders}
              onRemindersChange={setReminders}
              transparency={transparency}
              onTransparencyChange={setTransparency}
            />
          )}

          <div className={styles.modalRow2}>
            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={styles.modalInput}
            />

            <select
              id="calendar-select"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className={styles.modalSelect}
            >
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>

          {categories.length > 0 && (
            <div className={styles.modalRow2}>
              <div className={styles.categoriesContainer}>
                <div className={styles.categoriesLabel}>Categories</div>
                <div className={styles.categoriesList}>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`${styles.categoryChip} ${
                        selectedCategories.includes(cat.name) ? styles.categoryChipSelected : ''
                      }`}
                      onClick={() => {
                        if (selectedCategories.includes(cat.name)) {
                          setSelectedCategories(selectedCategories.filter((name) => name !== cat.name))
                        } else {
                          setSelectedCategories([...selectedCategories, cat.name])
                        }
                      }}
                    >
                      <span
                        className={styles.categoryChipDot}
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!showDescription ? (
            <button
              type="button"
              className={styles.modalAddDesc}
              onClick={() => setShowDescription(true)}
            >
              + Add description
            </button>
          ) : (
            <div className={styles.modalField}>
              <div className={styles.fieldHeader}>
                <label className={styles.label}>Description</label>
                <button
                  type="button"
                  className={styles.removeFieldButton}
                  onClick={() => {
                    setShowDescription(false)
                    setDescription('')
                  }}
                >
                  ×
                </button>
              </div>
              <textarea
                placeholder="Add description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${styles.modalInput} ${styles.modalTextarea}`}
                rows={3}
              />
            </div>
          )}

          <hr className={styles.modalDivider} />
          <div className={styles.modalFooter}>
            {isEditing && (
              <button type="button" className={styles.modalDelete} onClick={handleDelete}>
                Delete
              </button>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className={styles.modalSave} disabled={!title.trim()}>
                {isEditing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <RecurrenceDialog
        isOpen={showRecurrenceDialog}
        onClose={() => setShowRecurrenceDialog(false)}
        onConfirm={handleRecurrenceDialogConfirm}
      />

      <DeleteDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={performDelete}
      />
    </div>
  )
}
