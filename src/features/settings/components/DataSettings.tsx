import type { JSX } from 'react'
import { useState, useRef } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useContactStore } from '@/store/contactStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { useCardDAV } from '@/features/carddav/hooks/useCardDAV'
import { parseICALEvent } from '@/features/caldav/adapter/iCalendarAdapter'
import { parseVCardFile, contactsToVCardFile, downloadFile, readFileAsText } from '@/features/carddav/lib/vCardFileUtils'
import { showToast } from '@/lib/toast'
import { MergeDuplicatesModal } from '@/features/carddav/components/MergeDuplicatesModal'
import { ImportExportModal } from '@/features/carddav/components/ImportExportModal'
import { formatBrokenEventDate as formatDate } from '../lib/format'
import { useBrokenEventsActions } from '../hooks/useBrokenEventsActions'
import type { Contact } from '@/features/carddav/types'
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
  const brokenEvents = useCalendarStore((state) => state.brokenEvents)
  const timeFormat = useSettingsStore((state) => state.timeFormat)
  const caldav = useCalDAV()
  const { handleFix, handleDelete, handleFixAll, handleDeleteAll } =
    useBrokenEventsActions('caldav', {
      updateEvent: caldav.updateEvent,
      deleteEvent: caldav.deleteEvent,
    })

  const handleExportICS = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const fmtDate = (date: string): string => {
        const formatted = date.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
        return formatted.endsWith('Z') || formatted.endsWith('z') ? formatted : formatted + 'Z'
      }

      let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Calino//Calendar//EN\r\n'
      for (const event of events) {
        ics += 'BEGIN:VEVENT\r\n'
        ics += `UID:${event.id}\r\n`
        ics += `DTSTART:${fmtDate(event.start)}\r\n`
        ics += `DTEND:${fmtDate(event.end)}\r\n`
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

  // --------------------------------------------------------------------------
  // Contacts import/export
  // --------------------------------------------------------------------------
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [parsedImportContacts, setParsedImportContacts] = useState<Contact[]>([])
  const [isMergeOpen, setIsMergeOpen] = useState(false)
  const contactFileInputRef = useRef<HTMLInputElement>(null)
  const contacts = useContactStore((s) => s.contacts)
  const { syncAccount } = useCardDAV()

  const handleContactImportClick = (): void => {
    contactFileInputRef.current?.click()
  }

  const handleContactImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const content = await readFileAsText(file)
      const addressBooks = useContactStore.getState().addressBooks
      const visibleAbs = addressBooks.filter((ab) => ab.isVisible)
      const targetAbId = visibleAbs[0]?.id ?? ''
      const accountId = visibleAbs[0]?.accountId ?? ''
      const parsed = parseVCardFile(content, targetAbId, accountId)

      if (parsed.length === 0) {
        showToast('No contacts found in file')
        return
      }

      setParsedImportContacts(parsed)
      setIsImportOpen(true)
    } catch {
      showToast('Failed to parse vCard file')
    } finally {
      if (contactFileInputRef.current) contactFileInputRef.current.value = ''
    }
  }

  const handleContactExport = (): void => {
    if (contacts.length === 0) {
      showToast('No contacts to export')
      return
    }
    const vcf = contactsToVCardFile(contacts)
    downloadFile(vcf, 'contacts.vcf')
    showToast(`Exported ${contacts.length} contacts`)
  }

  return (
    <section className={`${styles.section} ${styles.sectionActive}`} data-component="data-settings">
      <h1 className={styles.pageTitle}>Data</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Import &amp; Export</div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Export Calendar</div>
            <div className={styles.rowDesc}>Download all events as a standard .ics file</div>
          </div>
          <button className={styles.actionBtn} onClick={handleExportICS} disabled={isExporting} data-component="action-button" data-action="export-ics" type="button">
            {isExporting ? 'Exporting...' : 'Export .ics'}
          </button>
        </div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Import Calendar</div>
            <div className={styles.rowDesc}>Add events from a .ics or .json file</div>
          </div>
          <button className={styles.actionBtn} onClick={handleImport} disabled={isImporting} data-component="action-button" data-action="import-calendar" type="button">
            {isImporting ? 'Importing...' : 'Choose file…'}
          </button>
        </div>
        {importStatus && (
          <div className={`${styles.importStatus} ${importStatus.type === 'success' ? styles.importStatusSuccess : styles.importStatusError}`} data-component="import-status">
            {importStatus.message}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".json,.ics" onChange={handleFileChange} style={{ display: 'none' }} data-testid="import-calendar-input" />
      </div>

      {/* Contacts */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Contacts</div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Export Contacts</div>
            <div className={styles.rowDesc}>Download all contacts as a standard .vcf file</div>
          </div>
          <button className={styles.actionBtn} onClick={handleContactExport} type="button">
            Export .vcf
          </button>
        </div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Import Contacts</div>
            <div className={styles.rowDesc}>Add contacts from a .vcf file</div>
          </div>
          <button className={styles.actionBtn} onClick={handleContactImportClick} type="button">
            Choose file…
          </button>
        </div>
        <div className={styles.actionRow}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Merge Duplicates</div>
            <div className={styles.rowDesc}>Find and merge contacts with the same email, phone, or name</div>
          </div>
          <button className={styles.actionBtn} onClick={() => setIsMergeOpen(true)} type="button">
            Merge…
          </button>
        </div>
        <input
          ref={contactFileInputRef}
          type="file"
          accept=".vcf,text/vcard"
          onChange={handleContactImportFile}
          style={{ display: 'none' }}
          data-testid="import-contacts-input"
        />
      </div>

      {/* Broken Events */}
      <div className={styles.group} data-component="broken-events">
        <div className={styles.groupLabel}>Data Issues</div>
        {brokenEvents.length === 0 ? (
          <div className={styles.rowDesc} style={{ padding: '12px 20px 16px' }}>
            Invalid or broken events (e.g. start date after end date) will appear here, allowing you to fix or delete them.
          </div>
        ) : (
          <>
            <p className={styles.rowDesc} style={{ padding: '12px 20px 0' }}>
              These events have a start date after their end date and cannot be displayed.
              You can fix them by swapping the dates, or delete them entirely.
            </p>

            <div className={styles.brokenList}>
            {brokenEvents.map((broken) => (
              <div key={broken.event.id} className={styles.brokenItem} data-component="broken-event-row" data-event-id={broken.event.id}>
                <div className={styles.brokenInfo}>
                  <div className={styles.brokenTitle}>{broken.event.title || 'Untitled Event'}</div>
                  <div className={styles.brokenDates}>
                    <span>Start: {formatDate(broken.event.start, timeFormat)}</span>
                    <span className={styles.brokenArrow}>→</span>
                    <span>End: {formatDate(broken.event.end, timeFormat)}</span>
                  </div>
                  <div className={styles.brokenReason}>{broken.reason}</div>
                </div>
                <div className={styles.brokenActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => void handleFix(broken)}
                    data-component="action-button"
                    data-action="fix-broken-event"
                    type="button"
                  >
                    Fix
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    onClick={() => void handleDelete(broken)}
                    data-component="action-button"
                    data-action="delete-broken-event"
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {brokenEvents.length > 1 && (
            <div className={styles.brokenBatchActions}>
              <button className={styles.actionBtn} onClick={() => void handleFixAll(brokenEvents)} data-component="action-button" data-action="fix-all-broken" type="button">
                Fix All ({brokenEvents.length})
              </button>
              <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => void handleDeleteAll(brokenEvents)} data-component="action-button" data-action="delete-all-broken" type="button">
                Delete All
              </button>
            </div>
          )}
        </>
        )}
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
            data-component="action-button"
            data-action="delete-all-events"
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
          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={handleClearData} data-component="action-button" data-action="reset-app" type="button">
            Reset app
          </button>
        </div>
      </div>

      {/* Import contacts modal */}
      <ImportExportModal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false)
          setParsedImportContacts([])
        }}
        parsedContacts={parsedImportContacts}
        onImportComplete={() => {
          const addressBooks = useContactStore.getState().addressBooks
          const ab = addressBooks.find((a) => a.isVisible)
          if (ab?.accountId) syncAccount(ab.accountId).catch(() => {})
        }}
      />

      {/* Merge duplicates modal */}
      <MergeDuplicatesModal
        isOpen={isMergeOpen}
        onClose={() => setIsMergeOpen(false)}
      />
    </section>
  )
}
