import type { JSX } from 'react'
import { useState, useRef } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { parseICALEvent } from '@/features/caldav/adapter/iCalendarAdapter'
import styles from './Settings.module.css'

export function DataSettings(): JSX.Element {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const events = useCalendarStore((state) => state.events)
  const calendars = useCalendarStore((state) => state.calendars)

  const handleExportICS = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const formatDate = (date: string): string => {
        const formatted = date.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        return formatted.endsWith('Z') || formatted.endsWith('z') ? formatted : formatted + 'Z'
      }

      let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Calino//Calendar//EN\r\n'
      for (const event of events) {
        ics += 'BEGIN:VEVENT\r\n'
        ics += `UID:${event.id}\r\n`
        ics += `DTSTART:${formatDate(event.start)}\r\n`
        ics += `DTEND:${formatDate(event.end)}\r\n`
        ics += `SUMMARY:${event.title}\r\n`
        if (event.description) ics += `DESCRIPTION:${event.description}\r\n`
        if (event.location) ics += `LOCATION:${event.location}\r\n`
        ics += 'END:VEVENT\r\n'
      }
      ics += 'END:VCALENDAR\r\n'

      const blob = new Blob([ics], { type: 'text/calendar' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `calino-export-${new Date().toISOString().split('T')[0]}.ics`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.json')) {
        const data = JSON.parse(text)
        if (data.events && Array.isArray(data.events)) {
          for (const event of data.events) {
            useCalendarStore.getState().addEvent(event)
          }
          setImportStatus({ type: 'success', message: `Imported ${data.events.length} events` })
        } else {
          setImportStatus({ type: 'error', message: 'No events found in JSON file' })
        }
      } else if (fileName.endsWith('.ics')) {
        const defaultCalendar = calendars.find((c) => c.isDefault) ?? calendars[0]
        const calendarId = defaultCalendar?.id ?? 'default'
        const importedEvents = parseICALEvent(text, calendarId)
        for (const event of importedEvents) {
          useCalendarStore.getState().addEvent(event)
        }
        setImportStatus({ type: 'success', message: `Imported ${importedEvents.length} events` })
      }
    } catch {
      setImportStatus({ type: 'error', message: 'Failed to import file. Please check the format.' })
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => setImportStatus(null), 3000)
    }
  }

  const handleClearData = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete all local data? This cannot be undone.')) return
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Data</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Import & Export</div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Export Calendar</div>
            <div className={styles.rowDesc}>Download all events as a standard .ics file</div>
          </div>
          <button className={styles.actionBtn} onClick={handleExportICS} disabled={isExporting} type="button">
            {isExporting ? 'Exporting...' : 'Export .ics'}
          </button>
        </div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Import Calendar</div>
            <div className={styles.rowDesc}>Add events from a .ics or .json file</div>
          </div>
          <button className={styles.actionBtn} onClick={handleImport} disabled={isImporting} type="button">
            {isImporting ? 'Importing...' : 'Choose file…'}
          </button>
        </div>
        {importStatus && (
          <div style={{ padding: '0 20px 16px', fontSize: '13px', color: importStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>
            {importStatus.message}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".json,.ics" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      <div className={`${styles.group} ${styles.dangerZone}`}>
        <div className={`${styles.groupLabel} ${styles.dangerZoneLabel}`}>Danger Zone</div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Delete All Events</div>
            <div className={styles.rowDesc}>Permanently remove every event from this calendar. This cannot be undone.</div>
          </div>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => {
              if (confirm('Delete all events? This cannot be undone.')) {
                const allEvents = useCalendarStore.getState().events
                allEvents.forEach((e) => useCalendarStore.getState().deleteEvent(e.id))
              }
            }}
            type="button"
          >
            Delete all events
          </button>
        </div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Reset Calino</div>
            <div className={styles.rowDesc}>Erase all data, settings, and connected accounts and start fresh.</div>
          </div>
          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={handleClearData} type="button">
            Reset app
          </button>
        </div>
      </div>
    </section>
  )
}
