import type { JSX } from 'react'
import { useState } from 'react'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { AddCalendarModal } from '@/features/calendar/components/AddCalendarModal'
import styles from './Settings.module.css'

export function CalDAVSettings(): JSX.Element {
  const [isAddingAccount, setIsAddingAccount] = useState(false)



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

      <AddCalendarModal isOpen={isAddingAccount} onClose={() => setIsAddingAccount(false)} />
    </section>
  )
}
