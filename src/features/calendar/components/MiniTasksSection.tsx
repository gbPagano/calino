import type { JSX } from 'react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, isToday, isBefore, startOfDay, addDays, isWithinInterval } from 'date-fns'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import type { CalendarEvent } from '@/types'
import styles from './Sidebar.module.css'

interface MiniTasksSectionProps {
  isExpanded: boolean
  onToggle: () => void
}

export function MiniTasksSection({ isExpanded, onToggle }: MiniTasksSectionProps): JSX.Element {
  const events = useCalendarStore((state) => state.events)
  const updateEvent = useCalendarStore((state) => state.updateEvent)
  const openModal = useCalendarStore((state) => state.openModal)
  const { updateEvent: updateCalDAVEvent } = useCalDAV()

  const upcomingTasks = useMemo(() => {
    const today = startOfDay(new Date())
    const weekFromNow = addDays(today, 7)

    const tasks = events
      .filter((e) => e.type === 'task' && !e.completed)
      .filter((task) => {
        if (!task.dueDate) return false
        const dueDate = startOfDay(parseISO(task.dueDate))
        return !isBefore(dueDate, today) && isWithinInterval(dueDate, { start: today, end: weekFromNow })
      })
      .sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0
        return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime()
      })
      .slice(0, 8)

    const overdue = events
      .filter((e) => e.type === 'task' && !e.completed)
      .filter((task) => {
        if (!task.dueDate) return false
        const dueDate = startOfDay(parseISO(task.dueDate))
        return isBefore(dueDate, today)
      })
      .sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0
        return parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime()
      })
      .slice(0, 5)

    return [...overdue, ...tasks].slice(0, 10)
  }, [events])

  const activeCount = events.filter((e) => e.type === 'task' && !e.completed).length

  const handleToggleComplete = async (taskId: string, task: CalendarEvent): Promise<void> => {
    e.stopPropagation()
    const newCompleted = !task.completed
    updateEvent(taskId, { completed: newCompleted })
    if (!task.calendarId) return
    try {
      await updateCalDAVEvent(task.calendarId, { ...task, completed: newCompleted })
    } catch {
      // error handled by useCalDAV
    }
  }

  const handleTaskClick = (task: CalendarEvent): void => {
    openModal(undefined, undefined, task.id, 'task')
  }

  return (
    <div className={styles.tasksSection}>
      <button className={styles.tasksHeader} onClick={onToggle}>
        <div className={styles.tasksHeaderLeft}>
          <span className={styles.tasksTitle}>Tasks</span>
          {activeCount > 0 && <span className={styles.tasksCount}>{activeCount}</span>}
        </div>
        <svg
          className={`${styles.tasksChevron} ${isExpanded ? styles.tasksChevronExpanded : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className={styles.tasksList}>
          {upcomingTasks.length === 0 ? (
            <div className={styles.tasksEmpty}>No upcoming tasks</div>
          ) : (
            <>
              {upcomingTasks.map((task) => (
                <div key={task.id} className={styles.taskRow}>
                  <button
                    className={styles.taskCheckbox}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleComplete(task.id, task)
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </button>
                  <div className={styles.taskContent} onClick={() => handleTaskClick(task)}>
                    <span className={styles.taskTitle}>{task.title}</span>
                    {task.dueDate && (
                      <span
                        className={`${styles.taskDue} ${
                          isBefore(startOfDay(parseISO(task.dueDate)), startOfDay(new Date()))
                            ? styles.taskOverdue
                            : ''
                        }`}
                      >
                        {isToday(parseISO(task.dueDate)) ? 'Today' : format(parseISO(task.dueDate), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <Link to="/tasks" className={styles.tasksViewAll}>
                View all →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}