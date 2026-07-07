import type { JSX } from 'react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { discoverServerUrl, suggestCalDAVUrl, expandProviderUrl } from '@/features/caldav/client/discovery'
import { useAnimatedClose } from '@/hooks/useAnimatedClose'
import { useModalDismiss } from '@/hooks/useModalDismiss'
import styles from './AddCalendarModal.module.css'

interface AddCalendarModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddCalendarModal({ isOpen, onClose }: AddCalendarModalProps): JSX.Element | null {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState<string>('')
  const [connectionHint, setConnectionHint] = useState<string>('')
  const [isTesting, setIsTesting] = useState(false)
  const [showProxyField, setShowProxyField] = useState(false)

  const { addAccount } = useCalDAV()

  const doClose = useCallback((): void => {
    setConnectionStatus('idle')
    setConnectionError('')
    setConnectionHint('')
    onClose()
  }, [onClose])
  const { rendered, closing, requestClose } = useAnimatedClose(isOpen, doClose, 200)
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalDismiss(dialogRef, rendered && !closing, requestClose)

  const handleTestConnection = async (
    serverUrl: string,
    username: string,
    password: string,
    proxyUrl?: string,
    originalUrl?: string
  ): Promise<boolean> => {
    setIsTesting(true)
    setConnectionStatus('idle')
    setConnectionError('')
    setConnectionHint('')

    try {
      // Discover the actual CalDAV endpoint via .well-known/caldav
      let baseUrl = await discoverServerUrl(serverUrl, proxyUrl)

      // Helper to test a URL with PROPFIND
      const testUrl = async (url: string): Promise<{ ok: boolean; status: number }> => {
        let fetchUrl = url
        if (proxyUrl) {
          const parsed = new URL(url)
          const encodedOrigin = encodeURIComponent(parsed.origin)
          const path = parsed.pathname + parsed.search + parsed.hash
          const proxyBase = proxyUrl.replace(/\/$/, '')
          fetchUrl = `${proxyBase}/${encodedOrigin}${path}`
        }

        const response = await fetch(fetchUrl, {
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
        return { ok: response.ok || response.status === 207, status: response.status }
      }

      let result = await testUrl(baseUrl)

      // Fallback: if the discovered URL fails, try the original base URL.
      // This handles cases like Radicale where the well-known redirect chain
      // ends at the web UI (/.web/) instead of the CalDAV endpoint (/).
      if (!result.ok) {
        const normalizedBase = serverUrl.replace(/\/$/, '')
        if (baseUrl !== normalizedBase) {
          console.log('[CalDAV] Test: discovered URL failed (' + result.status + '), trying base URL:', normalizedBase)
          result = await testUrl(normalizedBase)
          if (result.ok) {
            baseUrl = normalizedBase
          }
        }
      }

      setConnectionStatus(result.ok ? 'success' : 'error')
      if (!result.ok) {
        setConnectionError(`Server returned status ${result.status}`)
        const hintUrl = originalUrl || serverUrl
        const hint = suggestCalDAVUrl(hintUrl)
        if (hint) {
          setConnectionHint(hint)
        }
      }
      return result.ok
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setConnectionError(
        `Connection failed: ${errorMsg}. This may be a CORS issue - the server must allow cross-origin requests.`
      )
      const hintUrl = originalUrl || serverUrl
      const hint = suggestCalDAVUrl(hintUrl)
      if (hint) {
        setConnectionHint(hint)
      }
      setConnectionStatus('error')
      return false
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const serverUrl = formData.get('serverUrl') as string
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const accountName = (formData.get('accountName') as string) || username
    const proxyUrl = (formData.get('proxyUrl') as string) || undefined

    // Expand known provider URLs (e.g. Fastmail base → principal URL)
    const expanded = expandProviderUrl(serverUrl, username)
    const effectiveUrl = expanded || serverUrl

    const success = await handleTestConnection(effectiveUrl, username, password, proxyUrl, serverUrl)
    if (!success) {
      return
    }

    try {
      await addAccount(effectiveUrl, username, password, accountName, proxyUrl)
      requestClose()
    } catch {
      setConnectionStatus('error')
      setConnectionError('Failed to add account. Please try again.')
      const hint = suggestCalDAVUrl(serverUrl)
      if (hint) {
        setConnectionHint(hint)
      }
    }
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      requestClose()
    }
  }

  if (!rendered) {
    return null
  }

  return createPortal(
    <div
      className={`${styles.modal} ${closing ? styles.closing : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle} id="modal-title">
            Add CalDAV Calendar
          </h3>
          <button className={styles.modalClose} onClick={requestClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="accountName" className={styles.formLabel}>
              Account Name (optional)
            </label>
            <input
              id="accountName"
              name="accountName"
              className={styles.input}
              placeholder="My Calendar Server"
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="serverUrl" className={styles.formLabel}>
              Server URL
            </label>
            <input
              id="serverUrl"
              name="serverUrl"
              className={styles.input}
              placeholder="https://caldav.example.com"
              required
            />
            <span className={styles.formHint}>Enter the full URL of your CalDAV server</span>
          </div>
          <div className={styles.formGroup}>
            <button
              type="button"
              className={styles.chevronLabel}
              onClick={() => setShowProxyField(!showProxyField)}
            >
              <svg aria-hidden="true"
                className={styles.chevronIcon}
                style={{ transform: showProxyField ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Proxy URL (optional)</span>
            </button>
            {showProxyField && (
              <>
                <input
                  id="proxyUrl"
                  name="proxyUrl"
                  className={styles.input}
                  placeholder="https://proxy.calino.io"
                />
                <span className={styles.proxyInfoText}>
                  Using a proxy means your requests go through another server. Your CalDAV server,
                  requests, and authorization credentials might be visible to the proxy provider,
                  but not calendar data. It's recommended to either enable CORS headers on your
                  CalDAV server or run your own proxy.
                </span>
              </>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.formLabel}>
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              className={styles.input}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.formLabel}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className={styles.input}
              required
            />
          </div>
          {connectionStatus === 'success' && (
            <p className={styles.successMessage}>✓ Connection successful!</p>
          )}
          {connectionStatus === 'error' && <p className={styles.errorMessage}>{connectionError}</p>}
          {connectionHint && <div className={styles.hintMessage}>{connectionHint}</div>}
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={requestClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonPrimary}`}
              disabled={isTesting}
            >
              {isTesting ? 'Testing...' : 'Add Calendar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
