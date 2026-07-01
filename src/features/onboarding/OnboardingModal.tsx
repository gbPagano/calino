import type { JSX } from 'react'
import { useCallback, useState } from 'react'
import { useAnimatedClose } from '@/hooks/useAnimatedClose'
import { useSettingsStore, EVENT_COLORS } from '@/store/settingsStore'
import { useCalendarStore } from '@/store/calendarStore'
import { useContactStore } from '@/store/contactStore'
import { useConfigStore } from '@/store/configStore'
import { parseICALData } from '@/features/caldav/adapter/iCalendarAdapter'
import { parseVCard } from '@/features/carddav/adapter/vCardAdapter'
import styles from './OnboardingModal.module.css'

interface OnboardingModalProps {
  onAddCalendar: () => void
}

export function OnboardingModal({ onAddCalendar }: OnboardingModalProps): JSX.Element | null {
  const [isLoadingDemo, setIsLoadingDemo] = useState(false)
  const [demoError, setDemoError] = useState('')

  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const addEvent = useCalendarStore((state) => state.addEvent)
  const addCategory = useCalendarStore((state) => state.addCategory)
  const categories = useCalendarStore((state) => state.categories)
  const calendars = useCalendarStore((state) => state.calendars)
  const addContact = useContactStore((state) => state.addContact)
  const addAddressBook = useContactStore((state) => state.addAddressBook)
  const hasPreconfiguredAccounts = useConfigStore((state) => state.hasPreconfiguredAccounts)

  // Open state is derived from settings; every dismiss path flips it closed,
  // which the hook detects and animates out before unmounting.
  const isOpen = !(hasCompletedOnboarding || hasPreconfiguredAccounts)
  const noop = useCallback(() => {}, [])
  const { rendered, closing } = useAnimatedClose(isOpen, noop, 200)

  if (!rendered) {
    return null
  }

  const handleDismiss = (): void => {
    updateSettings({ hasCompletedOnboarding: true })
  }

  const handleAddCalendar = (): void => {
    updateSettings({ hasCompletedOnboarding: true })
    onAddCalendar()
  }

  const handleLoadDemoData = async (): Promise<void> => {
    setIsLoadingDemo(true)
    setDemoError('')

    try {
      const response = await fetch('/sample-events.ics')
      if (!response.ok) {
        throw new Error('Failed to load demo data')
      }

      const icsData = await response.text()
      const defaultCalendar = calendars.find((c) => c.isDefault) ?? calendars[0]
      const calendarId = defaultCalendar?.id ?? 'default'

      const events = parseICALData(icsData, calendarId)

      // Auto-create missing categories (mirrors useCalDAV.ts auto-creation logic)
      const newCategoryNames: string[] = []
      for (const event of events) {
        if (event.categories) {
          for (const catName of event.categories) {
            const existingCat = categories.find((c) => c.name === catName)
            if (!existingCat && !newCategoryNames.includes(catName)) {
              newCategoryNames.push(catName)
            }
          }
        }
      }

      for (const catName of newCategoryNames) {
        addCategory({
          id: crypto.randomUUID(),
          name: catName,
          color: EVENT_COLORS[Math.floor(Math.random() * EVENT_COLORS.length)],
        })
      }

      events.forEach((event) => addEvent(event))

      // Enable journal feature if sample data contains journal entries
      const hasJournals = events.some((e) => e.type === 'journal')
      if (hasJournals) {
        const { journalEnabled } = useSettingsStore.getState()
        if (!journalEnabled) {
          updateSettings({ journalEnabled: true })
        }
      }

      // Load sample contacts
      try {
        const vcfResponse = await fetch('/sample-contacts.vcf')
        if (vcfResponse.ok) {
          const vcfData = await vcfResponse.text()
          const vcards = vcfData.split(/(?=BEGIN:VCARD)/).filter(Boolean)
          
          // Create a sample address book
          const sampleAddressBook = {
            id: 'sample-addressbook',
            accountId: 'sample',
            url: 'sample://addressbook',
            name: 'Sample Contacts',
            ctag: null,
            syncToken: null,
            isVisible: true,
          }
          addAddressBook(sampleAddressBook)
          
          for (const vcard of vcards) {
            const contact = parseVCard(vcard.trim(), 'sample-addressbook', 'sample')
            if (contact) {
              addContact(contact)
            }
          }
          
          // Enable contacts feature
          const { contactsEnabled } = useSettingsStore.getState()
          if (!contactsEnabled) {
            updateSettings({ contactsEnabled: true })
          }
        }
      } catch {
        // Sample contacts are optional, ignore errors
      }

      updateSettings({ hasCompletedOnboarding: true })
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Failed to load demo data')
    } finally {
      setIsLoadingDemo(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      handleDismiss()
    }
  }

  return (
    <div
      className={`${styles.modal} ${closing ? styles.closing : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={styles.modalContent} role="dialog" aria-modal="true">

        <h2 className={styles.title}>Your calendar stays private</h2>

        <p className={styles.description}>
          All your events are stored locally in your browser. Calino doesn't send any data to
          external servers.
        </p>

        <p className={styles.description}>
          <strong>To keep your events safe</strong>, connect a CalDAV account (iCloud, Nextcloud,
          FastMail) — this syncs your calendar to your own server, so your data is never lost if you
          clear browser data. Alternatively, you can back up and transfer your data using the
          export/import feature in Settings.
        </p>

        {demoError && <p className={styles.errorMessage}>{demoError}</p>}

        <div className={styles.footer}>
          <button className={styles.addButton} onClick={handleAddCalendar}>
            Add CalDAV Account
          </button>
          {!__CALINO_SELF_HOSTED__ && (
            <>
              <button
                className={styles.demoButton}
                onClick={handleLoadDemoData}
                disabled={isLoadingDemo}
              >
                {isLoadingDemo ? 'Loading...' : 'Try with sample data'}
              </button>
              <button className={styles.skipButton} onClick={handleDismiss}>
                I'll do it later
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
