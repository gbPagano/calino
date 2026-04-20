import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import { RRule } from 'rrule'
import type { CalendarStore, CalendarEvent, Calendar, ViewType, EventType } from '@/types'
import type { Category, AutoCategoryRule } from '@/types/categories'
import { config, DEFAULT_CALENDAR_COLOR } from '@/config'
import { DAY_NUM_TO_CODE, FREQ_MAP } from '@/lib/recurrence'

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
      selectedCategoryId: null,
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
        const state = get()
        if (updates.title) {
          const existingEvent = state.events.find((e) => e.id === id)
          if (existingEvent) {
            const autoCategoryNames = applyAutoCategories(updates.title, state.autoCategoryRules, state.categories)
            const existingCategories = updates.categories || existingEvent.categories || []
            updates.categories = [...new Set([...existingCategories, ...autoCategoryNames])]
          }
        }
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        }))
      },

      deleteEvent: (id: string): void => {
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
        set((state) => ({
          calendars: state.calendars.filter((c) => c.id !== id),
          events: state.events.filter((e) => e.calendarId !== id),
        }))
      },

      toggleCalendarVisibility: (id: string): void => {
        set((state) => ({
          calendars: state.calendars.map((c) =>
            c.id === id ? { ...c, isVisible: !c.isVisible } : c
          ),
        }))
      },

      setDefaultCalendar: (id: string): void => {
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
        set((state) => {
          const existingCategory = state.categories.find((c) => c.id === id)
          const oldName = existingCategory?.name
          const newName = updates.name

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

      toggleCategoryFilter: (categoryId: string | null): void => {
        const current = get().selectedCategoryId
        const newValue = current === categoryId ? null : categoryId
        set({ selectedCategoryId: newValue })
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
        const selectedCategoryId = state.selectedCategoryId
        const selectedCategory = selectedCategoryId
          ? state.categories.find((c) => c.id === selectedCategoryId)
          : null
        const selectedCategoryName = selectedCategory?.name || null

        const startDate = startOfDay(parseISO(start))
        const endDate = endOfDay(parseISO(end))
        const expandedEvents: CalendarEvent[] = []
        const seenIds = new Set<string>()

        const exceptionMap = new Map<string, CalendarEvent>()
        for (const event of state.events) {
          if (event.recurrenceId && visibleCalendarIds.includes(event.calendarId)) {
            if (selectedCategoryName && !event.categories?.includes(selectedCategoryName)) {
              continue
            }
            const dateKey = event.recurrenceId.split('T')[0]
            const key = `${event.calendarId}-${dateKey}`
            exceptionMap.set(key, event)
          }
        }

        for (const event of state.events) {
          if (!visibleCalendarIds.includes(event.calendarId)) {
            continue
          }
          if (selectedCategoryName && !event.categories?.includes(selectedCategoryName)) {
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
              const options = RRule.parseString(rruleString)
              const eventStartUtc = parseISO(event.start)
              const offset = eventStartUtc.getTimezoneOffset() * 60000
              const eventStartLocal = new Date(eventStartUtc.getTime() - offset)

              const rule = new RRule({
                ...options,
                dtstart: eventStartLocal,
              })

              const occurrences = rule.between(startDate, endDate, true)
              const excludedDates = event.excludedDates || []

              for (const occ of occurrences) {
                const duration = parseISO(event.end).getTime() - eventStartUtc.getTime()
                const occOffset = occ.getTimezoneOffset() * 60000
                const occUtc = new Date(occ.getTime() + occOffset)
                const occEnd = new Date(occ.getTime() + duration)
                const occEndUtc = new Date(occEnd.getTime() + occOffset)

                const occDateStr = occUtc.toISOString().split('T')[0]
                if (excludedDates.some(d => d.startsWith(occDateStr))) {
                  continue
                }

                const exceptionKey = `${event.calendarId}-${occDateStr}`
                const exception = exceptionMap.get(exceptionKey)
                if (exception) {
                  const occId = `${event.id}-${occUtc.toISOString()}`
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

                const occId = `${event.id}-${occUtc.toISOString()}`
                if (!seenIds.has(occId)) {
                  const exceptionId = `${event.id}-${occDateStr}T${occUtc.toISOString().split('T')[1]}`
                  const exceptionEvent = state.events.find(
                    (e) => e.id === exceptionId && !e.rruleString && !e.recurrence
                  )
                  if (exceptionEvent) {
                    seenIds.add(occId)
                    expandedEvents.push({
                      ...exceptionEvent,
                      id: occId,
                    })
                  } else {
                    seenIds.add(occId)
                    expandedEvents.push({
                      ...event,
                      id: occId,
                      start: occUtc.toISOString(),
                      end: occEndUtc.toISOString(),
                    })
                  }
                }
              }
            } catch {
              const eventStart = parseISO(event.start)
              const eventEnd = parseISO(event.end)
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
            const eventStart = parseISO(event.start)
            const eventEnd = parseISO(event.end)

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
      partialize: (state) => ({
        events: state.events,
        calendars: state.calendars,
        categories: state.categories,
        autoCategoryRules: state.autoCategoryRules,
      }),
    }
  )
)

function applyAutoCategories(
  title: string,
  rules: AutoCategoryRule[],
  categories: Category[]
): string[] {
  const lowerTitle = title.toLowerCase()
  const matchingCategoryNames: string[] = []

  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        const category = categories.find((c) => c.id === rule.categoryId)
        if (category && !matchingCategoryNames.includes(category.name)) {
          matchingCategoryNames.push(category.name)
        }
        break
      }
    }
  }

  return matchingCategoryNames
}
