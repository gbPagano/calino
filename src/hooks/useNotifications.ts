import { useEffect, useRef } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { showNotification, createNotificationId } from '@/lib/notifications'
import { parseISO, isWithinInterval, addMinutes } from 'date-fns'

const CHECK_INTERVAL_MS = 60 * 1000

export function useNotifications(): void {
  const events = useCalendarStore((state) => state.events)
  const enableNotifications = useSettingsStore((state) => state.enableDesktopNotifications)
  const defaultReminderMinutes = useSettingsStore((state) => state.defaultReminderMinutes)
  // Track reminder ID → scheduled trigger timestamp so we can re-fire
  // when the event is edited (trigger time changes).
  const shownReminders = useRef<Map<string, number>>(new Map())
  // Track previous enableNotifications to detect disable→enable transitions.
  const prevEnabledRef = useRef(enableNotifications)

  useEffect(() => {
    prevEnabledRef.current = enableNotifications

    if (!enableNotifications) {
      // Stop checking but do NOT clear the map — preserve already-fired
      // reminders so they don't duplicate when re-enabled.
      return
    }

    // On a fresh disable→enable transition the map is intentionally kept
    // so that reminders outside the check window are not re-shown.
    // The map only evicts entries when the trigger time changes (event edit).

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    const checkReminders = (): void => {
      const now = new Date()
      const checkWindowStart = addMinutes(now, -1)
      const checkWindowEnd = addMinutes(now, 1)

      events.forEach((event) => {
        const reminders = event.reminders?.length ? event.reminders : 
          event.type === 'event' || !event.type ? [{ id: 'default', minutesBefore: defaultReminderMinutes, method: 'popup' as const }] : []

        if (reminders.length === 0) return

        reminders.forEach((reminder) => {
          const reminderTime = parseISO(event.start)
          reminderTime.setMinutes(reminderTime.getMinutes() - reminder.minutesBefore)

          const reminderId = createNotificationId(event.id, reminder.id)
          const triggerTimestamp = reminderTime.getTime()
          const previousTimestamp = shownReminders.current.get(reminderId)

          const shouldFire =
            isWithinInterval(reminderTime, { start: checkWindowStart, end: checkWindowEnd }) &&
            // Fire if never shown, or if the trigger time changed (event was edited)
            (previousTimestamp === undefined || previousTimestamp !== triggerTimestamp)

          if (shouldFire) {
            shownReminders.current.set(reminderId, triggerTimestamp)

            const timeStr = event.isAllDay 
              ? 'All day' 
              : parseISO(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
            
            const body = event.isAllDay 
              ? `Starting today` 
              : `Starting at ${timeStr}`

            showNotification(
              event.title,
              body,
              event.id,
              event.start
            )
          }
        })
      })
    }

    checkReminders()
    let intervalId = setInterval(checkReminders, CHECK_INTERVAL_MS)

    // Pause polling when tab is hidden to save CPU
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        clearInterval(intervalId)
      } else {
        // Resume and check immediately when tab becomes visible
        checkReminders()
        intervalId = setInterval(checkReminders, CHECK_INTERVAL_MS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [events, enableNotifications, defaultReminderMinutes])
}

export function useRequestNotificationPermission(): {
  permission: NotificationPermission
  request: () => Promise<NotificationPermission>
} {
  const enableNotifications = useSettingsStore((state) => state.enableDesktopNotifications)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  useEffect(() => {
    if (enableNotifications && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'denied') {
            updateSettings({ enableDesktopNotifications: false })
          }
        })
      } else if (Notification.permission === 'denied') {
        // Permission was previously denied — sync the setting
        updateSettings({ enableDesktopNotifications: false })
      }
    }
  }, [enableNotifications, updateSettings])

  return {
    permission: 'Notification' in window ? Notification.permission : 'denied',
    request: () => Notification.requestPermission(),
  }
}
