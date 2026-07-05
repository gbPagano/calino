import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import styles from './CurrentTimeIndicator.module.css'

interface CurrentTimeIndicatorProps {
  /** Height of one hour in pixels */
  hourHeight: number
  /** Whether to show the time label (left gutter) */
  showLabel?: boolean
  /** Optional className for the container */
  className?: string
}

export function CurrentTimeIndicator({
  hourHeight,
  showLabel = true,
  className,
}: CurrentTimeIndicatorProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 60_000)

    return () => clearInterval(interval)
  }, [])

  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
  const top = (minutesSinceMidnight / 60) * hourHeight

  return (
    <div
      className={`${styles.container} ${className ?? ''}`}
      style={{ top: `${top}px` }}
    >
      {showLabel && (
        <div className={styles.label}>
          {format(now, 'h:mm')}
        </div>
      )}
      <div className={styles.line} />
    </div>
  )
}
