import type { JSX } from 'react'
import { useState } from 'react'
import { useSettingsStore, SYNC_INTERVAL_OPTIONS } from '@/store/settingsStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import styles from './Settings.module.css'

export function CalDAVSettings(): JSX.Element {
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState<string>('')
  const [isTesting, setIsTesting] = useState(false)

  const syncEnabled = useSettingsStore((s) => s.syncEnabled)
  const syncIntervalMinutes = useSettingsStore((s) => s.syncIntervalMinutes)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const { accounts, addAccount, removeAccount } = useCalDAV()

  const handleTestConnection = async (
    serverUrl: string,
    username: string,
    password: string,
    proxyUrl?: string
  ): Promise<boolean> => {
    setIsTesting(true)
    setConnectionStatus('idle')
    setConnectionError('')

    try {
      let baseUrl = serverUrl
      if (serverUrl.includes('/calendars/')) {
        const match = serverUrl.match(/^https?:\/\/[^/]+/)
        if (match) {
          baseUrl = match[0] + '/dav.php'
        }
      }

      if (proxyUrl) {
        const encodedTarget = encodeURIComponent(baseUrl)
        const proxyBase = proxyUrl.replace(/\/$/, '')
        baseUrl = `${proxyBase}/${encodedTarget}`
      }

      const response = await fetch(baseUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
          'Content-Type': 'application/xml',
          Depth: '0',
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <d:propfind xmlns:d="DAV:">
            <d:prop>
              <d:displayname/>
            </d:prop>
          </d:propfind>`,
      })

      const success = response.ok || response.status === 207
      setConnectionStatus(success ? 'success' : 'error')
      if (!success) {
        setConnectionError(`Server returned status ${response.status}`)
      }
      return success
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setConnectionError(
        `Connection failed: ${errorMsg}. This may be a CORS issue - the server must allow cross-origin requests.`
      )
      setConnectionStatus('error')
      return false
    } finally {
      setIsTesting(false)
    }
  }

  const handleAddAccount = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const serverUrl = formData.get('serverUrl') as string
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const accountName = (formData.get('accountName') as string) || username
    const proxyUrl = (formData.get('proxyUrl') as string) || undefined

    const success = await handleTestConnection(serverUrl, username, password, proxyUrl)
    if (!success) {
      return
    }

    try {
      await addAccount(serverUrl, username, password, accountName, proxyUrl)
      setIsAddingAccount(false)
      setConnectionStatus('idle')
      form.reset()
    } catch {
      setConnectionStatus('error')
    }
  }

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
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Sync</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Connected Accounts</div>
        {accounts.map((account) => (
          <div key={account.id} className={styles.accountRow}>
            <div
              className={styles.accountIcon}
              style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--canvas))' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
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
              type="button"
            >
              Disconnect
            </button>
          </div>
        ))}

        <button className={styles.connectBtn} onClick={() => setIsAddingAccount(true)} type="button">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M8 2v12M2 8h12" />
          </svg>
          Add calendar account
        </button>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Sync Settings</div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Sync Frequency</div>
            <div className={styles.rowDesc}>How often to pull changes from connected accounts</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={syncIntervalMinutes}
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
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Sync on Launch</div>
            <div className={styles.rowDesc}>Always refresh when you open the app</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={syncEnabled}
                onChange={() => updateSettings({ syncEnabled: !syncEnabled })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
      </div>

      {isAddingAccount && (
        <div className={styles.modal} style={{ position: 'fixed', inset: 0, background: 'var(--modal-scrim)', backdropFilter: 'var(--modal-blur)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className={styles.modalContent} style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', boxShadow: 'var(--modal-shadow)', borderRadius: '18px', padding: '24px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Add CalDAV Account</h3>
              <button
                onClick={() => { setIsAddingAccount(false); setConnectionStatus('idle') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: '18px' }}
                type="button"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddAccount}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>Account Name</label>
                <input name="accountName" placeholder="My Calendar Server" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '14px', background: 'var(--canvas)', color: 'var(--ink)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>Server URL</label>
                <input name="serverUrl" placeholder="https://caldav.example.com/dav.php" required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '14px', background: 'var(--canvas)', color: 'var(--ink)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>Username</label>
                <input name="username" autoComplete="username" required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '14px', background: 'var(--canvas)', color: 'var(--ink)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink)', display: 'block', marginBottom: '6px' }}>Password</label>
                <input name="password" type="password" autoComplete="current-password" required style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '14px', background: 'var(--canvas)', color: 'var(--ink)', boxSizing: 'border-box' }} />
              </div>
              {connectionStatus === 'success' && (
                <p style={{ color: 'var(--color-success)', fontSize: '14px', marginBottom: '16px' }}>✓ Connection successful!</p>
              )}
              {connectionStatus === 'error' && (
                <p style={{ color: 'var(--color-error)', fontSize: '14px', marginBottom: '16px' }}>✕ {connectionError || 'Connection failed.'}</p>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className={styles.actionBtn} onClick={() => { setIsAddingAccount(false); setConnectionStatus('idle') }}>Cancel</button>
                <button type="submit" className={styles.actionBtn} style={{ background: 'var(--accent)', color: '#fff', border: 'none' }} disabled={isTesting}>
                  {isTesting ? 'Testing...' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
