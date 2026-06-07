import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/storage'
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { RRule } from 'rrule'
import type { CalendarStore, CalendarEvent, Calendar, ViewType, EventType } from '@/types'
import type { Category, AutoCategoryRule } from '@/types/categories'
import { config, DEFAULT_CALENDAR_COLOR } from '@/config'
import { DAY_NUM_TO_CODE, FREQ_MAP } from '@/lib/recurrence'
import { deleteAttachments } from '@/lib/attachmentStore'

export const selectOpenModal = (state: CalendarStore) => state.openModal
export const selectAddEvent = (state: CalendarStore) => state.addEvent
export const selectUpdateEvent = (state: CalendarStore) => state.updateEvent

export const selectDeleteEvent = (state: CalendarStore) => state.deleteEvent
export const selectAddCalendar = (state: CalendarStore) => state.addCalendar
export const selectDeleteCalendar = (state: CalendarStore) => state.deleteCalendar
export const selectUpdateCalendar = (state: CalendarStore) => state.updateCalendar
export const selectCalendars = (state: CalendarStore) => state.calendars
export const selectEvents = (state: CalendarStore) => state.events
export const selectAddCategory = (state: CalendarStore) => state.addCategory
export const selectCategories = (state: CalendarStore) => state.categories
export const selectSetCurrentView = (state: CalendarStore) => state.setCurrentView
export const selectSetCurrentDate = (state: CalendarStore) => state.setCurrentDate

const DEFAULT_CALENDAR: Calendar = {
  id: 'default',
  name: 'Offline calendar',
  color: DEFAULT_CALENDAR_COLOR,
  isVisible: true,
  isDefault: true,
  showTasksInViews: true,
}

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      events: [],
      calendars: [DEFAULT_CALENDAR],
      categories: [],
      autoCategoryRules: [],
      selectedCategoryIds: [],
      currentDate: format(new Date(), 'yyyy-MM-dd'),
      currentView: config.defaultView,
      selectedEventId: null,
      isModalOpen: false,
      selectedDate: null,
      selectedEndDate: null,
      isOverlayOpen: false,
      selectedEventType: 'event',
      showAddCalendar: false,
      previewEventId: null,
      previewPosition: null,

      addEvent: (event: CalendarEvent): void => {
        // Skip events with invalid date ranges instead of blocking the entire import
        if (event.start > event.end && !event.isAllDay) {
          console.warn(
            `[Calendar] Skipping event with start > end:\n` +
            `  id: ${event.id}\n` +
            `  title: ${event.title}\n` +
            `  calendar: ${event.calendarId}\n` +
            `  start: ${event.start}\n` +
            `  end: ${event.end}`
          )
          return
        }
        const state = get()
        const autoCategoryNames = applyAutoCategories(event.title, state.autoCategoryRules, state.categories)
        const existingCategories = event.categories || []
        const finalEvent = {
          ...event,
          categories: [...new Set([...existingCategories, ...autoCategoryNames])],
        }
        set((state) => ({
          events: [...state.events, finalEvent],
        }))
      },

      updateEvent: (id: string, updates: Partial<CalendarEvent>): void => {
        const safeUpdates = { ...updates }
        if (safeUpdates.start !== undefined && safeUpdates.end !== undefined) {
          if (safeUpdates.start > safeUpdates.end && !safeUpdates.isAllDay) {
            console.warn('[Calendar] Skipping update: start > end for', id)
            return
          }
        } else if (safeUpdates.start !== undefined || safeUpdates.end !== undefined) {
          const existingEvent = get().events.find((e) => e.id === id)
          if (existingEvent) {
            const start = safeUpdates.start ?? existingEvent.start
            const end = safeUpdates.end ?? existingEvent.end
            if (start > end && !existingEvent.isAllDay) {
              console.warn('[Calendar] Skipping update: start > end for', id)
              return
            }
          }
        }
        const state = get()
        if (safeUpdates.title) {
          const existingEvent = state.events.find((e) => e.id === id)
          if (existingEvent) {
            const autoCategoryNames = applyAutoCategories(safeUpdates.title, state.autoCategoryRules, state.categories)
            const existingCategories = safeUpdates.categories || existingEvent.categories || []
            safeUpdates.categories = [...new Set([...existingCategories, ...autoCategoryNames])]
          }
        }
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...safeUpdates } : e)),
        }))
      },

      deleteEvent: (id: string): void => {
        // Clean up attachments from IndexedDB (fire and forget)
        deleteAttachments(id).catch(() => {})
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        }))
      },

      duplicateEvent: (id: string): string | null => {
        const state = get()
        const eventToDuplicate = state.events.find((e) => e.id === id)
        if (!eventToDuplicate) return null

        const newEvent: CalendarEvent = {
          ...eventToDuplicate,
          id: crypto.randomUUID(),
          title: `${eventToDuplicate.title} (copy)`,
          recurrenceId: undefined,
          isFragment: undefined,
          isFirstFragment: undefined,
          isLastFragment: undefined,
          originalStart: undefined,
          originalEnd: undefined,
          syncStatus: undefined,
          etag: undefined,
          sequence: undefined,
        }

        set((state) => ({
          events: [...state.events, newEvent],
        }))

        return newEvent.id
      },

      addCalendar: (calendar: Calendar): void => {
        set((state) => ({
          calendars: [...state.calendars, calendar],
        }))
      },

      updateCalendar: (id: string, updates: Partial<Calendar>): void => {
        set((state) => ({
          calendars: state.calendars.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }))
      },

      deleteCalendar: (id: string): void => {
        set((state) => {
          // Clean up attachments for all events in this calendar
          for (const event of state.events) {
            if (event.calendarId === id) {
              deleteAttachments(event.id).catch(() => {})
            }
          }
          return {
            calendars: state.calendars.filter((c) => c.id !== id),
            events: state.events.filter((e) => e.calendarId !== id),
          }
        })
      },

      toggleCalendarVisibility: (id: string): void => {
        set((state) => ({
          calendars: state.calendars.map((c) =>
            c.id === id ? { ...c, isVisible: !c.isVisible } : c
          ),
        }))
      },

      setDefaultCalendar: (id: string): void => {
        const exists = get().calendars.some((c) => c.id === id)
        if (!exists) return
        set((state) => ({
          calendars: state.calendars.map((c) => ({
            ...c,
            isDefault: c.id === id,
          })),
        }))
      },

      addCategory: (category: Category): void => {
        set((state) => ({
          categories: [...state.categories, category],
        }))
      },

      updateCategory: (id: string, updates: Partial<Category>): void => {
        const state = get()
        const existingCategory = state.categories.find((c) => c.id === id)
        const oldName = existingCategory?.name
        const newName = updates.name

        if (newName && oldName !== newName) {
          const nameCollision = state.categories.some(
            (c) => c.id !== id && c.name.toLowerCase() === newName.toLowerCase()
          )
          if (nameCollision) {
            console.warn(`[Calendar] Category name '${newName}' already exists. Rename rejected.`)
            return
          }
        }

        set((state) => {
          if (!oldName || !newName || oldName === newName) {
            return {
              categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
            }
          }

          return {
            categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
            events: state.events.map((e) => ({
              ...e,
              categories: e.categories?.map((cat) => (cat === oldName ? newName : cat)),
            })),
          }
        })
      },

      deleteCategory: (id: string): void => {
        set((state) => {
          const category = state.categories.find((c) => c.id === id)
          const categoryName = category?.name
          return {
            categories: state.categories.filter((c) => c.id !== id),
            events: state.events.map((e) => ({
              ...e,
              categories: categoryName
                ? e.categories?.filter((cat) => cat !== categoryName)
                : e.categories,
            })),
          }
        })
      },

      addAutoCategoryRule: (rule: AutoCategoryRule): void => {
        set((state) => ({
          autoCategoryRules: [...state.autoCategoryRules, rule],
        }))
      },

      updateAutoCategoryRule: (id: string, updates: Partial<AutoCategoryRule>): void => {
        set((state) => ({
          autoCategoryRules: state.autoCategoryRules.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }))
      },

      deleteAutoCategoryRule: (id: string): void => {
        set((state) => ({
          autoCategoryRules: state.autoCategoryRules.filter((r) => r.id !== id),
        }))
      },

      toggleCategoryFilter: (categoryId: string): void => {
        const current = get().selectedCategoryIds
        const index = current.indexOf(categoryId)
        const newValue = index === -1
          ? [...current, categoryId]
          : current.filter((id) => id !== categoryId)
        set({ selectedCategoryIds: newValue })
      },

      setCurrentDate: (date: string): void => {
        set({ currentDate: date })
      },

      setCurrentView: (view: ViewType): void => {
        set({ currentView: view })
      },

      setSelectedEventId: (id: string | null): void => {
        set({ selectedEventId: id })
      },

      openModal: (date?: string, endDate?: string, eventId?: string, mode?: EventType): void => {
        set({
          isModalOpen: true,
          selectedEventId: eventId ?? null,
          selectedDate: date ?? null,
          selectedEndDate: endDate ?? null,
          selectedEventType: mode ?? 'event',
        })
      },

      closeModal: (): void => {
        set({
          isModalOpen: false,
          selectedEventId: null,
          selectedDate: null,
          selectedEndDate: null,
          selectedEventType: 'event',
        })
      },

      setOverlayOpen: (isOpen: boolean): void => {
        set({ isOverlayOpen: isOpen })
      },

      setShowAddCalendar: (show: boolean): void => {
        set({ showAddCalendar: show })
      },

      openPreview: (eventId: string, position: { x: number; y: number }): void => {
        set({ previewEventId: eventId, previewPosition: position })
      },

      closePreview: (): void => {
        set({ previewEventId: null, previewPosition: null })
      },

      getEventsForDateRange: (start: string, end: string): CalendarEvent[] => {
        const state = get()
        const visibleCalendarIds = state.calendars.filter((c) => c.isVisible).map((c) => c.id)
        const selectedCategoryIds = state.selectedCategoryIds
        const selectedCategoryNames = selectedCategoryIds.length > 0
          ? state.categories
              .filter((c) => selectedCategoryIds.includes(c.id))
              .map((c) => c.name)
          : []

        const parseDate = parseISO(start)
        const parseDateEnd = parseISO(end)

        // Date-only strings (no time component) need startOfDay/endOfDay.
        // Z-suffixed date-only strings use UTC boundaries; plain date-only use local.
        // Strings with an explicit time component are used as-is.
        const hasTimeStart = /\dT\d/.test(start)
        const hasTimeEnd = /\dT\d/.test(end)
        const isDateOnlyStart = !hasTimeStart
        const isDateOnlyEnd = !hasTimeEnd

        let startDate: Date
        let endDate: Date
        if (isDateOnlyStart && start.endsWith('Z')) {
          // UTC date-only: use UTC start of day
          startDate = new Date(Date.UTC(
            parseDate.getUTCFullYear(), parseDate.getUTCMonth(), parseDate.getUTCDate(), 0, 0, 0, 0
          ))
        } else if (isDateOnlyStart) {
          startDate = startOfDay(parseDate)
        } else {
          // Has explicit time component — use as-is
          startDate = parseDate
        }

        if (isDateOnlyEnd && end.endsWith('Z')) {
          // UTC date-only: use UTC end of day
          endDate = new Date(Date.UTC(
            parseDateEnd.getUTCFullYear(), parseDateEnd.getUTCMonth(), parseDateEnd.getUTCDate(), 23, 59, 59, 999
          ))
        } else if (isDateOnlyEnd) {
          endDate = endOfDay(parseDateEnd)
        } else {
          // Has explicit time component — use as-is
          endDate = parseDateEnd
        }
        const expandedEvents: CalendarEvent[] = []
        const seenIds = new Set<string>()

        const exceptionMap = new Map<string, CalendarEvent>()
        for (const event of state.events) {
          if (event.recurrenceId && visibleCalendarIds.includes(event.calendarId)) {
            const dateKey = event.recurrenceId.split('T')[0]
            const key = `${event.calendarId}-${dateKey}`
            exceptionMap.set(key, event)
          }
        }

        // Pre-parse all event dates once to avoid repeated parseISO calls
        const eventStartDates = new Map<string, Date>()
        const eventEndDates = new Map<string, Date>()
        for (const event of state.events) {
          eventStartDates.set(event.id, parseISO(event.start))
          eventEndDates.set(event.id, parseISO(event.end))
        }

        // Cache RRule objects keyed by rrule string to avoid re-parsing
        const rruleCache = new Map<string, RRule>()
        const getOrCreateRRule = (rruleStr: string, eventStart: Date): RRule => {
          const cacheKey = `${rruleStr}|${eventStart.toISOString()}`
          let rule = rruleCache.get(cacheKey)
          if (!rule) {
            const options = RRule.parseString(rruleStr)
            rule = new RRule({ ...options, dtstart: eventStart })
            rruleCache.set(cacheKey, rule)
          }
          return rule
        }

        for (const event of state.events) {
          if (!visibleCalendarIds.includes(event.calendarId)) {
            continue
          }
          if (selectedCategoryNames.length > 0 && !event.categories?.some((c) => selectedCategoryNames.includes(c))) {
            continue
          }

          const hasRecurrence = event.rruleString || event.recurrence

          if (hasRecurrence) {
            let rruleString = event.rruleString

            if (!rruleString && event.recurrence) {
              const freq = FREQ_MAP[event.recurrence.frequency] || 'WEEKLY'
              let rruleParts = `FREQ=${freq};INTERVAL=${event.recurrence.interval || 1}`
              if (event.recurrence.byWeekday && event.recurrence.byWeekday.length > 0) {
                const bydayParts: string[] = []
                for (let i = 0; i < event.recurrence.byWeekday.length; i++) {
                  const dayNum = event.recurrence.byWeekday[i]
                  const dayCode = DAY_NUM_TO_CODE[dayNum]
                  if (dayCode) {
                    const pos = event.recurrence.bySetPos?.[i]
                    if (pos !== undefined && pos !== 0) {
                      bydayParts.push(`${pos}${dayCode}`)
                    } else {
                      bydayParts.push(dayCode)
                    }
                  }
                }
                if (bydayParts.length > 0) {
                  rruleParts += `;BYDAY=${bydayParts.join(',')}`
                }
              }
              if (event.recurrence.endDate) {
                const endDate = parseISO(event.recurrence.endDate)
                const untilStr = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
                rruleParts += `;UNTIL=${untilStr}`
              }
              if (event.recurrence.count) {
                rruleParts += `;COUNT=${event.recurrence.count}`
              }
              rruleString = rruleParts
            }

            try {
              if (!rruleString) {
                throw new Error('No rrule string')
              }
              const eventStart = eventStartDates.get(event.id)!
              const eventEnd = eventEndDates.get(event.id)!

              const rule = getOrCreateRRule(rruleString, eventStart)

              const occurrences = rule.between(startDate, endDate, true)
              const excludedDates = event.excludedDates || []

              for (const occ of occurrences) {
                const duration = eventEnd.getTime() - eventStart.getTime()
                const occEnd = new Date(occ.getTime() + duration)

                const occDateStr = occ.toISOString().split('T')[0]
                if (excludedDates.some(d => d.split('T')[0] === occDateStr)) {
                  continue
                }

                const exceptionKey = `${event.calendarId}-${occDateStr}`
                const exception = exceptionMap.get(exceptionKey)
                if (exception) {
                  const occId = `${event.id}-${occ.toISOString()}`
                  if (!seenIds.has(occId)) {
                    seenIds.add(occId)
                    expandedEvents.push({
                      ...exception,
                      id: occId,
                      start: exception.start,
                      end: exception.end,
                    })
                  }
                  continue
                }

                const occId = `${event.id}-${occ.toISOString()}`
                seenIds.add(occId)
                expandedEvents.push({
                  ...event,
                  id: occId,
                  start: occ.toISOString(),
                  end: occEnd.toISOString(),
                })
              }
            } catch {
              const eventStart = eventStartDates.get(event.id)!
              const eventEnd = eventEndDates.get(event.id)!
              if (
                isWithinInterval(eventStart, { start: startDate, end: endDate }) ||
                isWithinInterval(eventEnd, { start: startDate, end: endDate }) ||
                (eventStart <= startDate && eventEnd >= endDate)
              ) {
                if (!seenIds.has(event.id)) {
                  seenIds.add(event.id)
                  expandedEvents.push(event)
                }
              }
            }
          } else {
            if (event.recurrenceId) {
              continue
            }
            const eventStart = eventStartDates.get(event.id)!
            const eventEnd = eventEndDates.get(event.id)!

            if (
              isWithinInterval(eventStart, { start: startDate, end: endDate }) ||
              isWithinInterval(eventEnd, { start: startDate, end: endDate }) ||
              (eventStart <= startDate && eventEnd >= endDate)
            ) {
              if (!seenIds.has(event.id)) {
                seenIds.add(event.id)
                expandedEvents.push(event)
              }
            }
          }
        }

        return expandedEvents
      },

      getVisibleEvents: (): CalendarEvent[] => {
        const state = get()
        const visibleCalendarIds = state.calendars.filter((c) => c.isVisible).map((c) => c.id)

        return state.events.filter((event) => visibleCalendarIds.includes(event.calendarId))
      },
    }),
    {
      name: 'calino-storage',
      storage: createJSONStorage(() => safeLocalStorage),
      version: 1,
      migrate: (persistedState: unknown) => {
        const state = persistedState as Record<string, unknown> | undefined
        return {
          events: state?.events ?? [],
          calendars: state?.calendars ?? [],
          categories: state?.categories ?? [],
          autoCategoryRules: state?.autoCategoryRules ?? [],
        }
      },
      partialize: (state) => ({
        // Strip base64 data from attachments — actual data lives in IndexedDB
        events: state.events.map((event) => {
          if (!event.attachments || event.attachments.length === 0) return event
          return {
            ...event,
            attachments: event.attachments.map((att) => ({
              ...att,
              // Keep href for external URLs, clear for inline (data is in IndexedDB)
              href: att.href.startsWith('data:') ? '' : att.href,
            })),
          }
        }),
        calendars: state.calendars,
        categories: state.categories,
        autoCategoryRules: state.autoCategoryRules,
        currentDate: state.currentDate,
        currentView: state.currentView,
      }),
    }
  )
)

function applyAutoCategories(
  title: string,
  rules: AutoCategoryRule[],
  categories: Category[]
): string[] {
  if (rules.length === 0 || categories.length === 0) return []

  const lowerTitle = title.toLowerCase()
  const matchingCategoryNames: string[] = []

  // Pre-build keyword → category name map for O(1) lookups
  const keywordMap = new Map<string, string>()
  for (const rule of rules) {
    const category = categories.find((c) => c.id === rule.categoryId)
    if (!category) continue
    for (const keyword of rule.keywords) {
      keywordMap.set(keyword.toLowerCase(), category.name)
    }
  }

  // Check if any keyword matches the title
  for (const [keyword, categoryName] of keywordMap) {
    if (lowerTitle.includes(keyword) && !matchingCategoryNames.includes(categoryName)) {
      matchingCategoryNames.push(categoryName)
    }
  }

  return matchingCategoryNames
}

// ── Journal helpers ─────────────────────────────────────────────────────

export function getJournalEntriesForDate(
  events: CalendarEvent[],
  date: string
): CalendarEvent[] {
  return events.filter((e) => e.type === 'journal' && e.start === date)
}

export function getJournalEntriesForMonth(
  events: CalendarEvent[],
  year: number,
  month: number
): CalendarEvent[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  return events
    .filter((e) => e.type === 'journal' && e.start.startsWith(prefix))
    .sort((a, b) => b.start.localeCompare(a.start))
}

export function getJournalDates(
  events: CalendarEvent[]
): Set<string> {
  const dates = new Set<string>()
  for (const e of events) {
    if (e.type === 'journal') dates.add(e.start)
  }
  return dates
}
