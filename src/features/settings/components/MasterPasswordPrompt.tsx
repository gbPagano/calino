import { useState, useRef, useEffect, useCallback } from 'react'
import { useConfigStore } from '../../../store/configStore'
import styles from './MasterPasswordPrompt.module.css'

export function MasterPasswordPrompt() {
  const { hasPreconfiguredAccounts, isUnlocked, unlock } = useConfigStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!password.trim() || loading) return

    setLoading(true)
    setError('')

    const success = await unlock(password)

    if (!success) {
      setError('Wrong password. Please try again.')
      setLoading(false)
      inputRef.current?.select()
    }
  }, [password, loading, unlock])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        // Can't dismiss — must unlock to use app
      }
    },
    [handleSubmit]
  )

  // Don't show if no preconfigured accounts or already unlocked
  if (!hasPreconfiguredAccounts || isUnlocked) {
    return null
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Unlock CalDAV accounts">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.icon}>🔐</div>
          <h2 className={styles.title}>Unlock CalDAV Accounts</h2>
          <p className={styles.subtitle}>
            Enter your master password to connect to preconfigured accounts.
          </p>
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label} htmlFor="master-password">
            Master Password
          </label>
          <input
            ref={inputRef}
            id="master-password"
            type="password"
            className={`${styles.input} ${error ? styles.error : ''}`}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter master password"
            autoComplete="current-password"
            disabled={loading}
          />
          {error && <div className={styles.errorText}>{error}</div>}
        </div>

        <div className={styles.actions}>
          <button
            className={`${styles.button} ${styles.submit}`}
            onClick={handleSubmit}
            disabled={!password.trim() || loading}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              'Unlock'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
