import type { JSX } from 'react'
import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react'
import {
  format,
  parseISO,
  startOfDay,
} from 'date-fns'
import { useCalendarStore } from '@/store/calendarStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import type { CalendarEvent } from '@/types'
import styles from './TodoView.module.css'

type FilterType = 'all' | 'active' | 'completed'

interface TaskWithColor extends CalendarEvent {
  calendarColor: string
}

interface TaskGroup {
  key: string
  label: string
  isOverdue?: boolean
  tasks: TaskWithColor[]
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'High',
  2: 'Medium',
  3: 'Low',
}

function getPriorityClass(priority?: number): string {
  if (priority === 1) return styles.priorityHigh
  if (priority === 2) return styles.priorityMed
  if (priority === 3) return styles.priorityLow
  return ''
}

function getDueLabel(task: TaskWithColor): { text: string; className: string } {
  if (!task.dueDate) return { text: '—', className: '' }

  const today = startOfDay(new Date())
  const dueDate = startOfDay(parseISO(task.dueDate))
  const diffMs = dueDate.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86400000)

  if (diffDays < 0) {
    return { text: format(parseISO(task.dueDate), 'MMM d'), className: styles.dueOverdue }
  }
  if (diffDays === 0) return { text: 'Today', className: styles.dueToday }
  if (diffDays === 1) return { text: 'Tomorrow', className: '' }
  if (diffDays <= 6) {
    return { text: format(parseISO(task.dueDate), 'EEE'), className: '' }
  }
  return { text: format(parseISO(task.dueDate), 'MMM d'), className: '' }
}

function getTaskGroup(task: TaskWithColor): string {
  if (!task.dueDate) return 'nodate'

  const today = startOfDay(new Date())
  const dueDate = startOfDay(parseISO(task.dueDate))
  const diffMs = dueDate.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86400000)

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 6) return 'week'
  return 'later'
}

const GROUP_ORDER = ['overdue', 'today', 'week', 'later', 'nodate']

const GROUP_LABELS: Record<string, string> = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'This week',
  later: 'Later',
  nodate: 'No due date',
}

export function TodoView(): JSX.Element {
  const events = useCalendarStore((state) => state.events)
  const calendars = useCalendarStore((state) => state.calendars)
  const updateEvent = useCalendarStore((state) => state.updateEvent)
  const openModal = useCalendarStore((state) => state.openModal)
  const { updateEvent: updateCalDAVEvent } = useCalDAV()

  const [filter, setFilter] = useState<FilterType>('active')
  const [composing, setComposing] = useState(false)
  const [unstriking, setUnstriking] = useState<Set<string>>(new Set())
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set())
  const composerRef = useRef<HTMLInputElement>(null)
  const segmentedRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  useEffect(() => {
    if (composing && composerRef.current) {
      composerRef.current.focus()
    }
  }, [composing])

  // Sliding indicator for filter tabs
  useLayoutEffect(() => {
    const container = segmentedRef.current
    const activeTab = tabRefs.current.get(filter)
    if (container && activeTab) {
      const containerRect = container.getBoundingClientRect()
      const tabRect = activeTab.getBoundingClientRect()
      setIndicatorStyle({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      })
    }
  }, [filter])

  const tasks: TaskWithColor[] = useMemo(() => {
    const calendarMap = new Map(calendars.map((c) => [c.id, c.color]))
    return events
      .filter((e) => e.type === 'task')
      .map((task) => ({
        ...task,
        calendarColor: calendarMap.get(task.calendarId) || '#888',
      }))
  }, [events, calendars])

  const activeCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks])
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks])

  const groupedTasks = useMemo((): TaskGroup[] => {
    const active = tasks.filter((t) => !t.completed || recentlyCompleted.has(t.id))
    const done = tasks.filter((t) => t.completed && !recentlyCompleted.has(t.id))

    const result: TaskGroup[] = []

    if (filter !== 'completed') {
      // Sort active tasks: due date ascending (earliest first), no-date last
      const sorted = [...active].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime()
      })

      // Group by time-to-act
      const grouped = new Map<string, TaskWithColor[]>()
      for (const task of sorted) {
        const group = getTaskGroup(task)
        if (!grouped.has(group)) grouped.set(group, [])
        grouped.get(group)!.push(task)
      }

      // Add groups in order
      for (const key of GROUP_ORDER) {
        const groupTasks = grouped.get(key)
        if (groupTasks && groupTasks.length > 0) {
          result.push({
            key,
            label: GROUP_LABELS[key],
            isOverdue: key === 'overdue',
            tasks: groupTasks,
          })
        }
      }
    }

    if (filter !== 'active' && done.length > 0) {
      // Sort completed: most recently done first
      const sortedDone = [...done].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return parseISO(b.dueDate).getTime() - parseISO(a.dueDate).getTime()
      })

      result.push({
        key: 'done',
        label: 'Completed',
        tasks: sortedDone,
      })
    }

    return result
  }, [tasks, filter])

  const handleToggleComplete = async (task: TaskWithColor): Promise<void> => {
    const newCompleted = !task.completed
    // If uncompleting, trigger unstrike animation
    if (task.completed && !newCompleted) {
      setUnstriking((prev) => new Set(prev).add(task.id))
      setTimeout(() => {
        setUnstriking((prev) => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
      }, 300)
    }
    // If completing in active view, keep visible briefly for strike animation
    if (!task.completed && newCompleted && filter === 'active') {
      setRecentlyCompleted((prev) => new Set(prev).add(task.id))
      setTimeout(() => {
        setRecentlyCompleted((prev) => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
      }, 350)
    }
    updateEvent(task.id, { completed: newCompleted })
    if (!task.calendarId) return
    try {
      await updateCalDAVEvent(task.calendarId, { ...task, completed: newCompleted })
    } catch {
      // error handled by useCalDAV
    }
  }

  const handleTaskClick = (task: TaskWithColor): void => {
    openModal(undefined, undefined, task.id, 'task')
  }

  const handleCreateTask = (): void => {
    setComposing(true)
    if (filter === 'completed') setFilter('active')
  }

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && composerRef.current?.value.trim()) {
      openModal(format(new Date(), 'yyyy-MM-dd'), undefined, undefined, 'task')
      setComposing(false)
    } else if (e.key === 'Escape') {
      setComposing(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.tpInner}>
        {/* Top Bar */}
        <div className={styles.tpBar}>
          <div className={styles.tpCount}>
            <b>{activeCount}</b> active <span className={styles.dim}>·</span> {completedCount} completed
          </div>
          <div className={styles.tpControls}>
            <div className={styles.segmentedControl} ref={segmentedRef}>
              <div className={styles.tabIndicator} style={{ left: indicatorStyle.left, width: indicatorStyle.width }} />
              <button
                ref={(el) => { if (el) tabRefs.current.set('all', el) }}
                className={`${styles.tab} ${filter === 'all' ? styles.tabActive : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                ref={(el) => { if (el) tabRefs.current.set('active', el) }}
                className={`${styles.tab} ${filter === 'active' ? styles.tabActive : ''}`}
                onClick={() => setFilter('active')}
              >
                Active
              </button>
              <button
                ref={(el) => { if (el) tabRefs.current.set('completed', el) }}
                className={`${styles.tab} ${filter === 'completed' ? styles.tabActive : ''}`}
                onClick={() => setFilter('completed')}
              >
                Completed
              </button>
            </div>
            <button className={styles.addTask} onClick={handleCreateTask}>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 2v10M2 7h10" />
              </svg>
              Add task
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className={styles.taskList}>
          {/* Inline Composer */}
          {composing && (
            <div className={styles.inlineComposer}>
              <span className={styles.composerCheck} />
              <input
                ref={composerRef}
                type="text"
                className={styles.composerInput}
                placeholder="What needs doing?"
                onKeyDown={handleComposerKeyDown}
                onBlur={() => setComposing(false)}
              />
            </div>
          )}

          {/* Empty State */}
          {groupedTasks.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyTitle}>All clear</span>
              Nothing here right now.
            </div>
          )}

          {/* Task Groups */}
          {groupedTasks.map((group) => (
            <div
              key={group.key}
              className={`${styles.taskGroup} ${group.isOverdue ? styles.overdueGroup : ''}`}
            >
              <div className={styles.groupHeader}>
                <span className={styles.groupTitle}>{group.label}</span>
                <span className={styles.groupCount}>{group.tasks.length}</span>
                <span className={styles.groupRule} />
              </div>
              <div className={styles.groupTasks}>
                {group.tasks.map((task) => {
                  const dueInfo = getDueLabel(task)
                  return (
                    <div
                      key={task.id}
                      className={`${styles.taskRow} ${task.completed ? styles.taskDone : ''} ${unstriking.has(task.id) ? styles.unstriking : ''}`}
                      style={{ '--event-color': task.calendarColor } as React.CSSProperties}
                    >
                      <button
                        className={styles.taskCheck}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleComplete(task)
                        }}
                        aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
                      >
                        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 7.5l2.5 2.5L11 4" />
                        </svg>
                      </button>
                      <div className={styles.taskBody} onClick={() => handleTaskClick(task)}>
                        <div className={styles.taskTitle}>{task.title}</div>
                        {task.description && (
                          <div className={styles.taskNote}>{task.description}</div>
                        )}
                      </div>
                      <div className={styles.taskMeta}>
                        {task.priority && task.priority <= 3 && (
                          <span className={`${styles.priority} ${getPriorityClass(task.priority)}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                        )}
                        <span className={`${styles.dueLabel} ${dueInfo.className}`}>
                          {dueInfo.text}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
