import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import {
  useSettingsStore,
  TIMEZONE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
} from '@/store/settingsStore'
import { useSettingsSync } from '@/hooks/useSettingsSync'
import styles from './Settings.module.css'

/** Format a sync error into a friendly, helpful message. */
function formatSyncError(error: string): JSX.Element {
  const lower = error.toLowerCase()

  // CORS errors
  if (lower.includes('cors') || lower.includes('NetworkError') || lower.includes('cross-origin')) {
    return (
      <>
        Your server is blocking the connection. This usually means CORS headers aren't configured.
        Check that your CalDAV server has these headers set via PROPPATCH or your web server config:
        <br />
        <code style={{
          display: 'block', marginTop: 6, padding: '6px 10px',
          borderRadius: 6, background: 'rgba(44,40,33,0.04)', fontSize: 12,
          fontFamily: 'monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap',
        }}>{`Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PROPFIND, PROPPATCH, REPORT, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Depth, Prefer, If-Match`}</code>
        <span style={{ marginTop: 6, display: 'block' }}>See <a href="https://github.com/nickvdyck/baikal#cors" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Baikal CORS docs</a> for help.</span>
      </>
    )
  }

  // Network errors
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return <>Couldn't reach your CalDAV server. Check your internet connection and make sure the server is online.</>
  }

  // Auth errors
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return <>Authentication failed. Please check your CalDAV username and password.</>
  }

  // Not found
  if (lower.includes('404') || lower.includes('not found')) {
    return <>The settings calendar wasn't found on your server. It may have been deleted. Try disabling and re-enabling sync.</>
  }

  // Default
  return <>{error}</>
}

export function GeneralSettings(): JSX.Element {
  const timezone = useSettingsStore((s) => s.timezone)
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const timeFormat = useSettingsStore((s) => s.timeFormat)
  const firstDayOfWeek = useSettingsStore((s) => s.firstDayOfWeek)
  const journalEnabled = useSettingsStore((s) => s.journalEnabled)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  
  // Settings sync
  const {
    enabled: syncEnabled,
    syncing,
    lastSyncAt,
    error: syncError,
    accounts: syncAccounts,
    enable: enableSync,
    disable: disableSync,
    push: pushSync,
  } = useSettingsSync()
  const [showAccountPicker, setShowAccountPicker] = useState(false)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [enablingAccountId, setEnablingAccountId] = useState<string | null>(null)

  // Close modals on Escape key
  useEffect(() => {
    if (!showAccountPicker && !showDisableConfirm) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAccountPicker(false)
        setShowDisableConfirm(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showAccountPicker, showDisableConfirm])

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>General</h1>
      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Timezone</div>
            <div className={styles.rowDesc}>All events will be displayed in this timezone</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={timezone}
              onChange={(e) => updateSettings({ timezone: e.target.value })}
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Date Format</div>
            <div className={styles.rowDesc}>How dates appear throughout the app</div>
          </div>
          <div className={styles.rowControl}>
            <select
              className={styles.select}
              value={dateFormat}
              onChange={(e) =>
                updateSettings({
                  dateFormat: e.target.value as 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd',
                })
              }
            >
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Time Format</div>
            <div className={styles.rowDesc}>12-hour or 24-hour time display</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg}>
              {TIME_FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${timeFormat === opt.value ? styles.segTabActive : ''}`}
                  onClick={() => updateSettings({ timeFormat: opt.value as '12h' | '24h' })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>First Day of Week</div>
            <div className={styles.rowDesc}>Start of the week in week and day views</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg}>
              {(
                [
                  { value: 6 as const, label: 'Saturday' },
                  { value: 0 as const, label: 'Sunday' },
                  { value: 1 as const, label: 'Monday' },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.segTab} ${firstDayOfWeek === opt.value ? styles.segTabActive : ''}`}
                  onClick={() =>
                    updateSettings({ firstDayOfWeek: opt.value })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Language</div>
            <div className={styles.rowDesc}>Interface language</div>
          </div>
          <div className={styles.rowControl}>
            <select className={styles.select} defaultValue="en">
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Journal</div>
            <div className={styles.rowDesc}>Attach freeform notes to days in your calendar</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={journalEnabled}
                onChange={(e) => updateSettings({ journalEnabled: e.target.checked })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
      </div>

      {/* CalDAV Settings Sync */}
      <div className={styles.groupLabel}>Sync</div>
      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>CalDAV Settings Sync</div>
            <div className={styles.rowDesc}>
              {syncEnabled
                ? 'Pulls settings automatically. Save changes manually with the button below.'
                : 'Enable to sync your settings across devices via CalDAV'}
            </div>
            {syncError && (
              <div style={{
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'color-mix(in srgb, #c2697f 8%, var(--panel))',
                border: '1px solid color-mix(in srgb, #c2697f 20%, transparent)',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink)',
              }}>
                <div style={{ fontWeight: 600, color: '#9e4a5e', marginBottom: 4 }}>Something went wrong</div>
                <div style={{ color: 'var(--ink-2)' }}>{formatSyncError(syncError)}</div>
              </div>
            )}
          </div>
          <div className={styles.rowControl}>
            {syncEnabled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {syncing && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={styles.spinner} />
                    Syncing…
                  </span>
                )}
                {lastSyncAt && !syncing && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    Synced {new Date(lastSyncAt).toLocaleTimeString()}
                  </span>
                )}
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={syncEnabled}
                    onChange={() => setShowDisableConfirm(true)}
                  />
                  <span className={styles.pill} />
                  <span className={styles.knob} />
                </label>
              </div>
            ) : (
              <button
                className={styles.actionBtn}
                onClick={() => setShowAccountPicker(true)}
                disabled={syncAccounts.length === 0}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(44,40,33,0.06)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(44,40,33,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = ''
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = ''
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(0.97)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
              >
                Enable
              </button>
            )}
          </div>
        </div>
        {syncEnabled && (
          <div className={styles.row}>
            <div className={styles.rowInfo}>
              <div className={styles.rowLabel}>Sync Now</div>
              <div className={styles.rowDesc}>Save your local settings to the server</div>
            </div>
            <div className={styles.rowControl}>
              <button
                className={styles.actionBtn}
                onClick={() => pushSync()}
                disabled={syncing}
                onMouseEnter={(e) => {
                  if (!syncing) {
                    e.currentTarget.style.background = 'rgba(44,40,33,0.06)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(44,40,33,0.08)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = ''
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = ''
                }}
                onMouseDown={(e) => {
                  if (!syncing) e.currentTarget.style.transform = 'translateY(0) scale(0.97)'
                }}
                onMouseUp={(e) => {
                  if (!syncing) e.currentTarget.style.transform = 'translateY(-1px)'
                }}
              >
                {syncing ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Picker Modal */}
      {showAccountPicker && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAccountPicker(false)}
        >
          <div
            style={{
              background: 'var(--panel)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
              Enable Settings Sync
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--ink-2)' }}>
              This will create a <strong>Calino Settings</strong> calendar on your CalDAV server. It contains a single event that stores your preferences (theme, first day of week, etc.) as JSON data.
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
              The calendar is hidden from Calino's sidebar but may be visible in other CalDAV clients. It does not affect your other calendars and can be deleted at any time from settings.
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ink-2)' }}>
              Choose an account to sync with:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {syncAccounts.map((account) => {
                const isLoading = enablingAccountId === account.id
                return (
                  <button
                    key={account.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: isLoading ? 'var(--accent-soft)' : 'var(--canvas)',
                      cursor: isLoading ? 'wait' : 'pointer',
                      textAlign: 'left',
                      fontSize: 14,
                      opacity: enablingAccountId && !isLoading ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      transform: 'scale(1)',
                      boxShadow: '0 1px 2px rgba(44,40,33,0.04)',
                    }}
                    disabled={enablingAccountId !== null}
                    onMouseEnter={(e) => {
                      if (!isLoading && !enablingAccountId) {
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(44,40,33,0.08)'
                        e.currentTarget.style.transform = 'scale(1.01)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)'
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(44,40,33,0.04)'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    onMouseDown={(e) => {
                      if (!isLoading) e.currentTarget.style.transform = 'scale(0.98)'
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'scale(1.01)'
                    }}
                    onClick={async () => {
                      setEnablingAccountId(account.id)
                      try {
                        await enableSync(account.id)
                        setShowAccountPicker(false)
                      } catch {
                        // Error is shown via syncError
                      } finally {
                        setEnablingAccountId(null)
                      }
                    }}
                  >
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {account.name}
                      {isLoading && (
                        <span style={{ fontSize: 12, color: 'var(--accent)' }}>Setting up…</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                      {account.serverUrl}
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              style={{
                marginTop: 16,
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--ink-2)',
                width: '100%',
              }}
              onClick={() => setShowAccountPicker(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Disable Confirmation Modal */}
      {showDisableConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDisableConfirm(false)}
        >
          <div
            style={{
              background: 'var(--panel)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
              Disable Settings Sync?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--ink-2)' }}>
              Your settings will no longer sync across devices. Would you also like to delete the settings file from your server?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--canvas)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
                onClick={async () => {
                  await disableSync(false)
                  setShowDisableConfirm(false)
                }}
              >
                Keep File
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid color-mix(in srgb, #c2697f 22%, transparent)',
                  background: 'color-mix(in srgb, #c2697f 8%, var(--panel))',
                  color: '#bb5d6e',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
                onClick={async () => {
                  await disableSync(true)
                  setShowDisableConfirm(false)
                }}
              >
                Delete & Disable
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
