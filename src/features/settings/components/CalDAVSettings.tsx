import type { JSX } from 'react'
import { useState } from 'react'
import { useSettingsStore, SYNC_INTERVAL_OPTIONS } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { AddCalendarModal } from '@/features/calendar/components/AddCalendarModal'
import styles from './Settings.module.css'

export function CalDAVSettings(): JSX.Element {
  const [isAddingAccount, setIsAddingAccount] = useState(false)

  const syncEnabled = useSettingsStore((s) => s.syncEnabled)
  const syncIntervalMinutes = useSettingsStore((s) => s.syncIntervalMinutes)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const { accounts, removeAccount } = useCalDAV()

  const handleDeleteAccount = async (id: string): Promise<void> => {
    if (
      !confirm(
        'Are you sure you want to remove this account? Calendar data will be preserved locally.'
      )
    ) {
      return
    }
    await removeAccount(id)
  }

  return (
    <section className={`${styles.section} ${styles.sectionActive}`} data-component="caldav-settings">
      <h1 className={styles.pageTitle}>Sync</h1>

      <div className={styles.group} data-component="connected-accounts">
        <div className={styles.groupLabel}>Connected Accounts</div>
        {accounts.map((account) => (
          <div key={account.id} className={styles.accountRow} data-component="account-row" data-account-id={account.id} data-account-name={account.name}>
            <div
              className={styles.accountIcon}
              style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--canvas))' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect width="20" height="20" rx="5" fill="var(--accent)" opacity="0.8" />
                <text x="10" y="14" textAnchor="middle" fontSize="11" fill="white" fontFamily="sans-serif">
                  {account.name.charAt(0)}
                </text>
              </svg>
            </div>
            <div className={styles.accountInfo}>
              <div className={styles.accountName}>{account.name}</div>
              <div className={styles.accountStatus}>
                <div className={`${styles.statusDot} ${styles.statusDotOk}`} />
                {account.lastSyncAt
                  ? `Synced · ${new Date(account.lastSyncAt).toLocaleDateString()}`
                  : 'Connected'}
              </div>
            </div>
            <button
              className={styles.disconnect}
              onClick={() => handleDeleteAccount(account.id)}
              aria-label={`Disconnect ${account.name}`}
              type="button"
            >
              Disconnect
            </button>
          </div>
        ))}

        <button
          className={styles.connectBtn}
          onClick={() => setIsAddingAccount(true)}
          data-component="action-button"
          data-action="add-account"
          type="button"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M8 2v12M2 8h12" />
          </svg>
          Add calendar account
        </button>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Sync Settings</div>
        <div className={`${styles.row} ${styles.rowDisabled}`} data-component="setting-row" data-setting="sync-frequency" data-value={String(syncIntervalMinutes)} title="Not available yet">
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Sync Frequency</div>
            <div className={styles.rowDesc}>How often to pull changes from connected accounts</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={syncIntervalMinutes}
              aria-label="Sync frequency"
              onChange={(e) => updateSettings({ syncIntervalMinutes: Number(e.target.value) })}
            >
              {SYNC_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={`${styles.row} ${styles.rowDisabled}`} data-component="setting-row" data-setting="sync-on-launch" data-value={String(syncEnabled)} title="Not available yet">
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Sync on Launch</div>
            <div className={styles.rowDesc}>Always refresh when you open the app</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="sync-on-launch">
              <input
                type="checkbox"
                checked={syncEnabled}
                aria-label="Sync on launch"
                onChange={() => updateSettings({ syncEnabled: !syncEnabled })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
      </div>

      <AddCalendarModal isOpen={isAddingAccount} onClose={() => setIsAddingAccount(false)} />
    </section>
  )
}
