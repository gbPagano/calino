import type { JSX } from 'react'
import { format } from 'date-fns'
import type { Command, EventResult, CalendarResult, QuickAddResult } from '../types'
import type { TimeFormat } from '@/types'
import styles from './CommandItem.module.css'

interface CommandItemProps {
  item: Command | EventResult | CalendarResult | QuickAddResult
  type: 'command' | 'event' | 'calendar' | 'quick-add'
  isSelected: boolean
  onClick: () => void
  timeFormat: TimeFormat
  'data-index'?: number
}

function parseShortcut(shortcut: string): string[] {
  // "⇧]" → ["⇧", "]"], "T" → ["T"]
  return shortcut.split(/(?=[\[\]⇧])/).filter(Boolean)
}

export function CommandItem({
  item,
  type,
  isSelected,
  onClick,
  timeFormat,
  'data-index': dataIndex,
}: CommandItemProps): JSX.Element {
  const handleClick = (): void => {
    onClick()
  }

  const formatTime = (date: Date): string => {
    return format(date, timeFormat === '24h' ? 'HH:mm' : 'h:mm a')
  }

  const renderKbd = (shortcut?: string): JSX.Element => {
    if (!shortcut) return <div className={styles.kbdGroup} />
    const keys = parseShortcut(shortcut)
    return (
      <div className={styles.kbdGroup}>
        {keys.map((key, i) => (
          <span key={i} className={styles.kbd}>{key}</span>
        ))}
      </div>
    )
  }

  const renderContent = (): JSX.Element => {
    if (type === 'command') {
      const cmd = item as Command
      return (
        <>
          {cmd.icon && (
            <span
              className={styles.icon}
              dangerouslySetInnerHTML={{ __html: cmd.icon }}
            />
          )}
          <div className={styles.body}>
            <div className={styles.title}>{cmd.label}</div>
            {cmd.description && <div className={styles.desc}>{cmd.description}</div>}
          </div>
          {renderKbd(cmd.shortcut)}
        </>
      )
    }

    if (type === 'event') {
      const event = item as EventResult
      const calendarColor = '#4285F4'
      return (
        <>
          <span className={styles.eventColor} style={{ backgroundColor: calendarColor }} />
          <div className={styles.body}>
            <div className={styles.title}>{event.title}</div>
            <div className={styles.desc}>{new Date(event.start).toLocaleString()}</div>
          </div>
        </>
      )
    }

    if (type === 'calendar') {
      const cal = item as CalendarResult
      return (
        <>
          <span className={styles.eventColor} style={{ backgroundColor: cal.color }} />
          <div className={styles.body}>
            <div className={styles.title}>{cal.name}</div>
          </div>
        </>
      )
    }

    if (type === 'quick-add') {
      const qa = item as QuickAddResult
      const confidencePercent = Math.round(qa.confidence * 100)
      const isTaskItem = qa.isTask
      return (
        <>
          <span className={styles.icon}>
            {isTaskItem ? '○' : '+'}
          </span>
          <div className={styles.body}>
            <div className={styles.title}>
              {isTaskItem ? 'Task: ' : 'Create: '}
              {qa.title}
            </div>
            <div className={styles.desc}>
              {format(qa.startDate, 'EEEE, MMMM d')}
              {qa.endDate && ` ${formatTime(qa.startDate)} – ${formatTime(qa.endDate)}`}
              {!qa.endDate && !qa.isAllDay && ` ${formatTime(qa.startDate)}`}
              {qa.isAllDay && ' (all day)'}
              {qa.location && ` at ${qa.location}`}
              <span className={styles.confidence}> · {confidencePercent}%</span>
            </div>
          </div>
        </>
      )
    }

    return <div className={styles.title}>Unknown</div>
  }

  return (
    <div
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      data-index={dataIndex}
    >
      {renderContent()}
    </div>
  )
}
