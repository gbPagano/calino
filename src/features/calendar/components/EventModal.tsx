import type { JSX } from 'react'
import { useState, useMemo, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { showToast } from '@/lib/toast'
import { safeCalDAVUpdate, safeCalDAVDelete } from '@/lib/caldavHelpers'
import { deleteEventWithUndo } from '@/lib/deleteWithUndo'
import type { CalendarEvent, CalendarAttachment, RecurrenceRule, TaskPriority, Reminder } from '@/types'
import { putAttachments, getAttachments, deleteAttachments } from '@/lib/attachmentStore'
import { TaskFormFields } from './TaskFormFields'
import { EventFormFields } from './EventFormFields'
import { RecurrenceDialog } from './RecurrenceDialog'
import { DeleteDialog } from './DeleteDialog'
import { extractOriginalEventId } from '@/lib/events'
import { isUUID } from '@/lib/uuid'

import styles from './EventModal.module.css'

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
  recurring: boolean
  recurrence: RecurrenceRule['frequency']
  interval: number
  byWeekday: number[]
  byMonthDay: number[]
  byMonth: number[]
  bySetPos: number[]
  endCondition: 'never' | 'on' | 'after'
  endOnDate: string
  endAfterCount: number
  travelDuration: number | undefined
  reminders: Reminder[]
  transparency: 'opaque' | 'transparent'
  categories: string[]
  attachments: CalendarAttachment[]
  relatedTo: string[]
}

function getInitialFormState(
  isModalOpen: boolean,
  selectedEventId: string | null,
  selectedDate: string | null,
  selectedEndDate: string | null,
  events: CalendarEvent[],
  calendars: { id: string; isDefault: boolean }[],
  allCategories: { id: string; name: string }[]
): InitialFormState & { isRecurringInstance: boolean; originalEventId: string | null } {
  // Early return when modal is closed — skip all computation
  if (!isModalOpen) {
    const defaultCalendar = calendars.find((c) => c.isDefault) || calendars[0]
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
      recurring: false,
      recurrence: 'weekly',
      interval: 1,
      byWeekday: [],
      byMonthDay: [],
      byMonth: [],
      bySetPos: [],
      endCondition: 'never',
      endOnDate: today,
      endAfterCount: 10,
      travelDuration: undefined,
      reminders: [],
      transparency: 'opaque',
      categories: [],
      attachments: [],
      relatedTo: [],
      isRecurringInstance: false,
      originalEventId: null,
    }
  }

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
      // Convert category IDs to names
      const categoryNames: string[] = []
      if (existingEvent.categories) {
        for (const catIdOrName of existingEvent.categories) {
          if (isUUID(catIdOrName)) {
            const cat = allCategories.find((c) => c.id === catIdOrName)
            if (cat) categoryNames.push(cat.name)
          } else {
            categoryNames.push(catIdOrName)
          }
        }
      }
      const rule = existingEvent.recurrence
      const bySetPosFiltered = rule?.bySetPos?.filter((p) => p !== 0)
      const endOnDate = rule?.endDate
        ? format(parseISO(rule.endDate), 'yyyy-MM-dd')
        : format(parseISO(existingEvent.start), 'yyyy-MM-dd')
      const endCondition: 'never' | 'on' | 'after' = rule?.endDate
        ? 'on'
        : rule?.count
          ? 'after'
          : 'never'
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
        recurring: !!rule,
        recurrence: rule?.frequency || 'weekly',
        interval: rule?.interval ?? 1,
        byWeekday: rule?.byWeekday ?? [],
        byMonthDay: rule?.byMonthDay ?? [],
        byMonth: rule?.byMonth ?? [],
        bySetPos: bySetPosFiltered && bySetPosFiltered.length > 0 ? bySetPosFiltered : [],
        endCondition,
        endOnDate,
        endAfterCount: rule?.count ?? 10,
        travelDuration: existingEvent.travelDuration,
        reminders: existingEvent.reminders || [],
        transparency: existingEvent.transparency || 'opaque',
        categories: categoryNames,
        attachments: existingEvent.attachments || [],
        relatedTo: existingEvent.relatedTo || [],
        isRecurringInstance,
        originalEventId,
      }
    }

    if (selectedDate) {
      const hasTime = selectedDate.includes('T')
      const dateStr = hasTime ? selectedDate.split('T')[0] : selectedDate

      let startTimeVal = '09:00'
      let endTimeVal = '10:00'

      if (hasTime) {
        const time = selectedDate.split('T')[1]?.substring(0, 5) || '09:00'
        startTimeVal = time
        const [h, m] = time.split(':').map(Number)
        const endMins = h * 60 + m + 60
        const endH = Math.floor(endMins / 60) % 24
        const endM = endMins % 60
        endTimeVal = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
      } else {
        // No specific time - smart default only applies for TODAY
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        if (dateStr === todayStr) {
          // Round up to next hour, then add 1 hour
          const now = new Date()
          let hours = now.getHours()
          const mins = now.getMinutes()
          if (mins > 0) hours += 1 // round up to next hour
          hours += 1 // add 1 more hour
          hours = hours % 24
          startTimeVal = `${String(hours).padStart(2, '0')}:00`
          const endHour = (hours + 1) % 24
          endTimeVal = `${String(endHour).padStart(2, '0')}:00`
        }
        // else: use default 09:00/10:00
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
            recurring: false,
            recurrence: 'weekly',
            interval: 1,
            byWeekday: [],
            byMonthDay: [],
            byMonth: [],
            bySetPos: [],
            endCondition: 'never',
            endOnDate: dateStr,
            endAfterCount: 10,
            travelDuration: undefined,
            reminders: [],
            transparency: 'opaque',
            categories: [],
            attachments: [],
            relatedTo: [],
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
        recurring: false,
        recurrence: 'weekly',
        interval: 1,
        byWeekday: [],
        byMonthDay: [],
        byMonth: [],
        bySetPos: [],
        endCondition: 'never',
        endOnDate: dateStr,
        endAfterCount: 10,
        travelDuration: undefined,
        reminders: [],
        transparency: 'opaque',
        categories: [],
        attachments: [],
        relatedTo: [],
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
    recurring: false,
    recurrence: 'weekly',
    interval: 1,
    byWeekday: [],
    byMonthDay: [],
    byMonth: [],
    bySetPos: [],
    endCondition: 'never',
    endOnDate: today,
    endAfterCount: 10,
    travelDuration: undefined,
    reminders: [],
    transparency: 'opaque',
    categories: [],
    attachments: [],
    relatedTo: [],
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
        calendars,
        categories
      ),
    [isModalOpen, selectedEventId, selectedDate, selectedEndDate, events, calendars, categories]
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
  const [recurring, setRecurring] = useState<boolean>(initialState.recurring)
  const [recurrence, setRecurrence] = useState<RecurrenceRule['frequency']>(
    initialState.recurrence
  )
  const [interval, setInterval] = useState<number>(initialState.interval)
  const [byWeekday, setByWeekday] = useState<number[]>(initialState.byWeekday)
  const [byMonthDay, setByMonthDay] = useState<number[]>(initialState.byMonthDay)
  const [byMonth, setByMonth] = useState<number[]>(initialState.byMonth)
  const [bySetPos, setBySetPos] = useState<number[]>(initialState.bySetPos)
  const [endCondition, setEndCondition] = useState<'never' | 'on' | 'after'>(initialState.endCondition)
  const [endOnDate, setEndOnDate] = useState<string>(initialState.endOnDate)
  const [endAfterCount, setEndAfterCount] = useState<number>(initialState.endAfterCount)
  const [travelDuration, setTravelDuration] = useState<number | undefined>(
    initialState.travelDuration
  )
  const [transparency, setTransparency] = useState<'opaque' | 'transparent'>(
    initialState.transparency
  )
  const [reminders, setReminders] = useState<Reminder[]>(initialState.reminders)
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showDescription, setShowDescription] = useState(!!initialState.description)
  const [attachments, setAttachments] = useState<CalendarAttachment[]>([])
  const [relatedTo, setRelatedTo] = useState<string[]>([])


  // Load attachments from IndexedDB when modal opens with existing event
  useEffect(() => {
    if (!isModalOpen || !initialState.attachments || initialState.attachments.length === 0) {
      setAttachments([])
      return
    }
    if (!selectedEventId) {
      setAttachments(initialState.attachments)
      return
    }
    getAttachments(selectedEventId)
      .then((loaded) => {
        if (loaded.length > 0) {
          setAttachments(loaded)
        } else {
          // No IndexedDB data yet (migrated from localStorage), use zustand metadata
          setAttachments(initialState.attachments!)
        }
      })
      .catch(() => {
        setAttachments(initialState.attachments!)
      })
  }, [isModalOpen, selectedEventId])

  // Close on Escape
  useEffect(() => {
    if (!isModalOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModalRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])
  const [dueDate, setDueDate] = useState<string>('')
  const [dueTime, setDueTime] = useState<string>('09:00')
  const [dueAllDay, setDueAllDay] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialState.categories)

  const lastSelectedEventId = useRef<string | null>(null)
  const lastSelectedDate = useRef<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const closeModalRef = useRef(closeModal)
  useEffect(() => { closeModalRef.current = closeModal })

  // Title autocomplete
  const [titleSuggestions, setTitleSuggestions] = useState<CalendarEvent[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const handleTitleChange = (val: string): void => {
    setTitle(val)
    setHighlightedIndex(-1)
    if (val.length < 2) {
      setTitleSuggestions([])
      return
    }
    const q = val.toLowerCase()
    const matches = events
      .filter((e) => e.title.toLowerCase().includes(q))
      .sort((a, b) => {
        // Prefer titles that start with the query
        const aStart = a.title.toLowerCase().startsWith(q) ? 0 : 1
        const bStart = b.title.toLowerCase().startsWith(q) ? 0 : 1
        return aStart - bStart || new Date(b.start).getTime() - new Date(a.start).getTime()
      })
      .slice(0, 5)
    setTitleSuggestions(matches)
  }

  const applySuggestion = (ev: CalendarEvent): void => {
    setTitle(ev.title)
    setDescription(ev.description || '')
    setLocation(ev.location || '')
    setSelectedCategories(ev.categories || [])
    setRelatedTo(ev.relatedTo || [])
    // Fill time only if using default (09:00-10:00)
    if (startTime === '09:00' && endTime === '10:00') {
      const evStart = parseISO(ev.start)
      setStartTime(format(evStart, 'HH:mm'))
      const evEnd = parseISO(ev.end)
      setEndTime(format(evEnd, 'HH:mm'))
    }
    setTitleSuggestions([])
    setHighlightedIndex(-1)
    titleInputRef.current?.focus()
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent): void => {
    if (!showSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      setHighlightedIndex((i) => Math.min(i + 1, titleSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      applySuggestion(titleSuggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setTitleSuggestions([])
    } else if (e.key === 'Tab') {
      setTitleSuggestions([])
    }
  }

  useEffect(() => {
    if (
      selectedEventId !== lastSelectedEventId.current ||
      selectedDate !== lastSelectedDate.current
    ) {
      lastSelectedEventId.current = selectedEventId
      lastSelectedDate.current = selectedDate

      // Read fresh state via getState() so the form only resets when
      // selectedEventId or selectedDate actually change - not when
      // events/calendars change in the background (e.g. during CalDAV sync).
      const state = useCalendarStore.getState()
      const currentEvents = state.events
      const currentCalendars = state.calendars
      const currentCategories = state.categories
      const currentSelectedEventType = state.selectedEventType

      const formDefaults = getInitialFormState(
        isModalOpen,
        selectedEventId,
        selectedDate,
        selectedEndDate,
        currentEvents,
        currentCalendars,
        currentCategories
      )

      setTitle(formDefaults.title)
      setDescription(formDefaults.description)
      setLocation(formDefaults.location)
      setStartDate(formDefaults.startDate)
      setStartTime(formDefaults.startTime)
      setEndDate(formDefaults.endDate)
      setEndTime(formDefaults.endTime)
      setIsAllDay(formDefaults.isAllDay)
      setCalendarId(formDefaults.calendarId)
      setRecurring(formDefaults.recurring)
      setRecurrence(formDefaults.recurrence)
      setInterval(formDefaults.interval)
      setByWeekday(formDefaults.byWeekday)
      setByMonthDay(formDefaults.byMonthDay)
      setByMonth(formDefaults.byMonth)
      setBySetPos(formDefaults.bySetPos)
      setEndCondition(formDefaults.endCondition)
      setEndOnDate(formDefaults.endOnDate)
      setEndAfterCount(formDefaults.endAfterCount)
      setTravelDuration(formDefaults.travelDuration)
      setTransparency(formDefaults.transparency)
      setReminders(formDefaults.reminders)
      setShowDescription(!!formDefaults.description)
      setSelectedCategories(formDefaults.categories)
      setRelatedTo(formDefaults.relatedTo)

      const existingEvent = selectedEventId
        ? currentEvents.find((e) => e.id === selectedEventId)
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
      } else if (currentSelectedEventType === 'task') {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only reset on user-initiated event/date/endDate changes
  }, [selectedEventId, selectedDate, selectedEndDate])

  // Auto-focus title input when creating a new event
  useEffect(() => {
    if (isModalOpen && !selectedEventId) {
      setTimeout(() => titleInputRef.current?.focus(), 50)
    }
  }, [isModalOpen, selectedEventId])

  const isEditing = selectedEventId !== null
  const isRecurringEvent = initialState.recurring
  const showSuggestions = !isEditing && titleSuggestions.length > 0
  const originalEventId = initialState.originalEventId
  const existingEventForMode = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : undefined
  const eventType = existingEventForMode?.type
  const isTaskMode = selectedEventType === 'task' || eventType === 'task'

  const hasChanges = useMemo(() => {
    if (!existingEventForMode) return true

    const existingAttachments = existingEventForMode.attachments || []
    const attachmentsChanged = JSON.stringify(attachments) !== JSON.stringify(existingAttachments)

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
        JSON.stringify(selectedCategories) !== JSON.stringify(existingEventForMode.categories || []) ||
        JSON.stringify(relatedTo) !== JSON.stringify(existingEventForMode.relatedTo || []) ||
        attachmentsChanged
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
      JSON.stringify(selectedCategories) !== JSON.stringify(existingEventForMode.categories || []) ||
      JSON.stringify(relatedTo) !== JSON.stringify(existingEventForMode.relatedTo || []) ||
      attachmentsChanged
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
    relatedTo,
    attachments,
  ])

  const candidateEvents = useMemo(() => {
    return events.filter((e) => {
      if (e.id === selectedEventId) return false
      if (e.type === 'journal') return false
      if (!e.start.startsWith(startDate)) return false
      return true
    })
  }, [events, selectedEventId, startDate])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()

    if (!title.trim()) {
      showToast('Title is required')
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
      showToast('Title is required')
      return
    }

    const localStart = isAllDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`
    const localEnd = isAllDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}:00`
    const startDateTime = isAllDay ? `${startDate}T00:00:00` : new Date(localStart).toISOString()
    const endDateTime = isAllDay ? `${endDate}T00:00:00` : new Date(localEnd).toISOString()

    const recurrenceRule: RecurrenceRule | undefined =
      recurring
        ? {
            frequency: recurrence,
            interval: interval > 1 ? interval : 1,
            byWeekday: byWeekday.length > 0 ? byWeekday : undefined,
            byMonthDay: byMonthDay.length > 0 ? byMonthDay : undefined,
            byMonth: byMonth.length > 0 ? byMonth : undefined,
            bySetPos: bySetPos.length > 0 ? bySetPos : undefined,
            endDate: endCondition === 'on' && endOnDate ? `${endOnDate}T23:59:59` : undefined,
            count: endCondition === 'after' ? endAfterCount : undefined,
          }
        : undefined

    if (isEditing && selectedEventId) {
      if (mode === 'this' && originalEventId) {
        const masterEvent = events.find((e) => e.id === originalEventId)
        if (!masterEvent) {
          showToast('Master event not found. Cannot edit single occurrence.')
          return
        }

        const isoDateMatch = selectedEventId.match(
          /(.+)-(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)$/
        )
        const originalOccurrenceDate = isoDateMatch ? isoDateMatch[2] : null
        if (!originalOccurrenceDate) {
          showToast('Invalid event data. Cannot edit single occurrence.')
          return
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
          relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }

        addEvent(exceptionEvent)
        // Sync IndexedDB for exception event
        if (attachments.length > 0) {
          putAttachments(exceptionEvent.id, attachments).catch(() => {})
        }
        try {
          await createCalDAVEvent(masterEvent.calendarId, exceptionEvent)
        } catch {
          showToast('Failed to sync event with CalDAV server. It will be retried.')
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
          relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        })
        // Sync IndexedDB with current attachments
        if (attachments.length > 0) {
          putAttachments(eventId!, attachments).catch(() => {})
        } else {
          deleteAttachments(eventId!).catch(() => {})
        }
        const existingEvent = events.find((e) => e.id === eventId)
        if (existingEvent) {
          console.log('[EventModal] Saving event. attachments state:', JSON.stringify(attachments))
          console.log('[EventModal] existingEvent.attachments:', JSON.stringify(existingEvent.attachments))
          await safeCalDAVUpdate(
            updateCalDAVEvent,
            calendarId,
            {
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
              relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
            },
            {
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
              relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
              attachments: attachments.length > 0 ? attachments : undefined,
            }
          )
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
        relatedTo: relatedTo.length > 0 ? relatedTo : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      }
      addEvent(newEvent)
      // Move attachments from temp 'new' key to actual event ID
      if (attachments.length > 0) {
        deleteAttachments('new').catch(() => {})
        putAttachments(newEvent.id, attachments).catch(() => {})
      }
      await safeCalDAVUpdate(
        createCalDAVEvent,
        calendarId,
        newEvent,
        {}
      )
    }

    setShowRecurrenceDialog(false)
    closeModal()
  }

  const handleRecurrenceDialogConfirm = async (mode: RecurrenceEditMode): Promise<void> => {
    if (!title.trim()) {
      showToast('Title is required')
      return
    }
    await saveEvent(mode)
  }

  const handleDelete = (): void => {
    if (isRecurringEvent) {
      setShowDeleteDialog(true)
      return
    }

    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }

    performDelete('all')
  }

  const performDelete = async (mode: RecurrenceEditMode): Promise<void> => {
    if (mode === 'this' && originalEventId) {
      // Add the occurrence's date to excludedDates on the master - do not delete the series
      if (!selectedEventId) return
      const occurrenceStartISO = selectedEventId.slice(originalEventId.length + 1)
      const occurrenceDate = occurrenceStartISO.split('T')[0]
      const masterEvent = events.find((e) => e.id === originalEventId)
      if (masterEvent) {
        const excludedDates = masterEvent.excludedDates || []
        if (!excludedDates.includes(occurrenceDate)) {
          const updatedExcludedDates = [...excludedDates, occurrenceDate]
          updateEvent(originalEventId, { excludedDates: updatedExcludedDates })
          await safeCalDAVUpdate(
            updateCalDAVEvent,
            calendarId,
            { ...masterEvent, excludedDates: updatedExcludedDates },
            { excludedDates: updatedExcludedDates }
          )
        }
      }
    } else {
      const eventIdToDelete = originalEventId || selectedEventId
      if (eventIdToDelete) {
        const eventToDelete = events.find((e) => e.id === eventIdToDelete)
        if (eventToDelete) {
          deleteEventWithUndo({
            event: eventToDelete,
            deleteEvent,
            addEvent,
            createCalDAVEvent,
            deleteCalDAVEvent,
          })
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
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title || 'Event modal'}>
        <div className={styles.modalBand} />
        <div className={styles.modalHeader}>
          <button
            type="button"
            className={styles.titleEditIcon}
            onClick={() => titleInputRef.current?.focus()}
          >
            <svg aria-hidden="true"
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
          <div className={styles.titleInputWrapper}>
            <input
              ref={titleInputRef}
              type="text"
              placeholder={isTaskMode ? 'Task title' : 'Event title'}
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              className={styles.modalTitle}
              required
              onInvalid={(e) => {
                e.preventDefault()
                showToast('Title is required')
              }}
            />
            {showSuggestions && (
              <div className={styles.titleSuggestions}>
                {titleSuggestions.map((ev, i) => (
                  <button
                    key={ev.id}
                    type="button"
                    className={`${styles.suggestionItem} ${i === highlightedIndex ? styles.suggestionItemActive : ''}`}
                    onClick={() => applySuggestion(ev)}
                  >
                    <span className={styles.suggestionTitle}>{ev.title}</span>
                    {ev.description && (
                      <span className={styles.suggestionDesc}>{ev.description}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.modalClose} onClick={closeModal} aria-label="Close">
            ×
          </button>
        </div>
        <hr className={styles.modalDivider} />
        <form
          key={`${selectedEventId}-${selectedDate}-${selectedEventType}`}
          onClick={(e) => {
            // Close suggestions when clicking outside the suggestions dropdown
            if (!(e.target as HTMLElement).closest(`.${styles.titleSuggestions}`)) {
              setTitleSuggestions([])
            }
          }}
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
              recurring={recurring}
              onRecurringChange={setRecurring}
              recurrence={recurrence}
              onRecurrenceChange={setRecurrence}
              interval={interval}
              onIntervalChange={setInterval}
              byWeekday={byWeekday}
              onByWeekdayChange={setByWeekday}
              byMonthDay={byMonthDay}
              onByMonthDayChange={setByMonthDay}
              byMonth={byMonth}
              onByMonthChange={setByMonth}
              bySetPos={bySetPos}
              onBySetPosChange={setBySetPos}
              endCondition={endCondition}
              onEndConditionChange={setEndCondition}
              endOnDate={endOnDate}
              onEndOnDateChange={setEndOnDate}
              endAfterCount={endAfterCount}
              onEndAfterCountChange={setEndAfterCount}
              travelDuration={travelDuration}
              onTravelDurationChange={setTravelDuration}
              reminders={reminders}
              onRemindersChange={setReminders}
              transparency={transparency}
              onTransparencyChange={setTransparency}
              relatedTo={relatedTo}
              onRelatedToChange={setRelatedTo}
              candidateEvents={candidateEvents}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              attachmentEventId={selectedEventId}
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

          <div className={styles.modalFooter}>
            {isEditing && (
              <button type="button" className={`${styles.modalDelete} ${confirmDelete ? styles.modalDeleteConfirm : ''}`} onClick={handleDelete}>
                {confirmDelete ? 'Click again to confirm' : 'Delete'}
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
