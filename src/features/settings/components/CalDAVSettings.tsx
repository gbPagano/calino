import type { JSX } from 'react'
import { useState } from 'react'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import type { CalDAVAccount } from '@/features/caldav/types'
import { AddCalendarModal } from '@/features/calendar/components/AddCalendarModal'
import styles from './Settings.module.css'

interface TestState {
  status: 'testing' | 'ok' | 'error'
  message?: string
  hint?: string
}

export function CalDAVSettings(): JSX.Element {
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CalDAVAccount | null>(null)
  // Keyed by account id so testing one account never shows a spinner on another.
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})

  const { accounts, removeAccount, testAccount } = useCalDAV()

  const clearTestState = (id: string): void => {
    setTestStates((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleTestAccount = async (id: string): Promise<void> => {
    setTestStates((prev) => ({ ...prev, [id]: { status: 'testing' } }))
    const result = await testAccount(id)
    setTestStates((prev) => ({
      ...prev,
      [id]: result.ok
        ? { status: 'ok' }
        : { status: 'error', message: result.error, hint: result.hint },
    }))
  }

  const handleEditAccount = (account: CalDAVAccount): void => {
    clearTestState(account.id)
    setEditingAccount(account)
  }

  const handleDeleteAccount = async (id: string): Promise<void> => {
    if (
      !confirm(
        'Are you sure you want to remove this account? Calendar data will be preserved locally.'
      )
    ) {
      return
    }
    clearTestState(id)
    await removeAccount(id)
  }

  const renderStatus = (account: CalDAVAccount): JSX.Element => {
    const test = testStates[account.id]

    if (test?.status === 'testing') {
      return (
        <div className={styles.accountStatus}>
          <div className={`${styles.statusDot} ${styles.statusDotTesting}`} />
          Testing…
        </div>
      )
    }
    if (test?.status === 'ok') {
      return (
        <div className={styles.accountStatus}>
          <div className={`${styles.statusDot} ${styles.statusDotOk}`} />
          Connection OK
        </div>
      )
    }
    if (test?.status === 'error') {
      return (
        <div className={styles.accountStatus}>
          <div className={`${styles.statusDot} ${styles.statusDotWarn}`} />
          {test.message ? `Failed — ${test.message}` : 'Connection failed'}
        </div>
      )
    }

    return (
      <div className={styles.accountStatus}>
        <div className={`${styles.statusDot} ${styles.statusDotOk}`} />
        {account.lastSyncAt
          ? `Synced · ${new Date(account.lastSyncAt).toLocaleDateString()}`
          : 'Connected'}
      </div>
    )
  }

  return (
    <section className={`${styles.section} ${styles.sectionActive}`} data-component="caldav-settings">
      <h1 className={styles.pageTitle}>Sync</h1>

      <div className={styles.group} data-component="connected-accounts">
        <div className={styles.groupLabel}>Connected Accounts</div>
        {accounts.map((account) => {
          const test = testStates[account.id]
          return (
            <div key={account.id} data-component="account-row-wrapper">
              <div className={styles.accountRow} data-component="account-row" data-account-id={account.id} data-account-name={account.name}>
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
                  {renderStatus(account)}
                </div>
                <div className={styles.accountActions}>
                  <button
                    className={styles.rowBtn}
                    onClick={() => handleTestAccount(account.id)}
                    disabled={test?.status === 'testing'}
                    aria-label={`Test connection for ${account.name}`}
                    data-component="action-button"
                    data-action="test-account"
                    type="button"
                  >
                    Test
                  </button>
                  <button
                    className={styles.rowBtn}
                    onClick={() => handleEditAccount(account)}
                    aria-label={`Edit ${account.name}`}
                    data-component="action-button"
                    data-action="edit-account"
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className={styles.disconnect}
                    onClick={() => handleDeleteAccount(account.id)}
                    aria-label={`Disconnect ${account.name}`}
                    type="button"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              {test?.status === 'error' && test.hint && (
                <div className={styles.accountHint}>{test.hint}</div>
              )}
            </div>
          )
        })}

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
      {editingAccount && (
        <AddCalendarModal
          isOpen
          mode="edit"
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}
    </section>
  )
}
