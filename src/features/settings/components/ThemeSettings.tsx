import { useEffect, useMemo } from 'react'
import type { JSX } from 'react'
import { useSettingsStore, THEME_MODE_OPTIONS } from '@/store/settingsStore'
import { useTheme } from '@/components/ThemeContext'
import type { ThemeMode } from '@/types'
import styles from './Settings.module.css'

const ACCENT_COLORS = [
  { value: '#b07d4f', name: 'Warm tan' },
  { value: '#c2697f', name: 'Rose' },
  { value: '#5b7fb5', name: 'Blue' },
  { value: '#5d9a78', name: 'Green' },
  { value: '#8a6aa8', name: 'Plum' },
]

function MiniCalendarPreview({ variant }: { variant: 'light' | 'dark' | 'system' }): JSX.Element {
  const bg = variant === 'dark' ? '#1a1815' : variant === 'system' ? undefined : '#faf8f3'
  const cellBg = variant === 'dark' ? '#252218' : '#f0ece5'
  const eventBg = variant === 'dark' ? 'color-mix(in srgb, #b07d4f 20%, #1a1815)' : 'color-mix(in srgb, #b07d4f 12%, #faf8f3)'

  const previewStyle = variant === 'system'
    ? { background: 'linear-gradient(135deg, #faf8f3 50%, #1a1815 50%)' }
    : { background: bg }

  const cellStyle = variant === 'system'
    ? { background: 'linear-gradient(135deg, #f0ece5 50%, #252218 50%)' }
    : { background: cellBg }

  const eventStyle = variant === 'system'
    ? { background: 'linear-gradient(135deg, color-mix(in srgb, #b07d4f 12%, #faf8f3) 50%, color-mix(in srgb, #b07d4f 20%, #1a1815) 50%)' }
    : { background: eventBg }

  return (
    <div className={`${styles.themeCardPreview} ${variant === 'light' ? styles.themeCardPreviewLight : variant === 'dark' ? styles.themeCardPreviewDark : styles.themeCardPreviewSystem}`} style={previewStyle}>
      <div className={styles.tcBar} style={{ background: variant === 'dark' ? '#2d2a24' : '#e8e2d8', width: '60%' }} />
      <div className={styles.tcGrid}>
        {Array.from({ length: 14 }, (_, i) => (
          <div
            key={i}
            className={styles.tcDay}
            style={i === 2 || i === 5 || i === 10 ? eventStyle : cellStyle}
          />
        ))}
      </div>
    </div>
  )
}

export function ThemeSettings(): JSX.Element {
  const themeMode = useSettingsStore((s) => s.themeMode)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const { refetchThemes } = useTheme()

  useEffect(() => {
    refetchThemes()
  }, [refetchThemes])

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Theme</h1>
      <div className={styles.group}>
        <div className={`${styles.row} ${styles.rowTop}`}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Appearance</div>
            <div className={styles.rowDesc}>Choose how Calino looks</div>
          </div>
          <div className={styles.rowControl} style={{ alignItems: 'flex-start', paddingTop: '2px' }}>
            <div className={styles.themeCards} style={{ width: '420px' }}>
              {(THEME_MODE_OPTIONS as { value: ThemeMode; label: string }[]).map((opt) => {
                const isActive = themeMode === opt.value
                const isLight = opt.value === 'light'
                const isDark = opt.value === 'dark'
                const isSystem = opt.value === 'auto'
                return (
                  <button
                    key={opt.value}
                    className={`${styles.themeCard} ${isActive ? styles.themeCardActive : ''}`}
                    onClick={() => updateSettings({ themeMode: opt.value })}
                    type="button"
                  >
                    <MiniCalendarPreview variant={isLight ? 'light' : isDark ? 'dark' : 'system'} />
                    <div className={styles.themeCardLabel}>
                      {isSystem ? 'System' : opt.label}
                      <div className={styles.tcCheck}>
                        <svg viewBox="0 0 9 9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M1.5 4.5l2 2L7.5 2" />
                        </svg>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className={`${styles.row} ${styles.rowDisabled}`}>
            <div className={styles.rowDesc}>Used for today, active states, and highlights</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.swatches}>
              {ACCENT_COLORS.map((color, i) => (
                <button
                  key={color.value}
                  className={`${styles.swatch} ${i === 0 ? styles.swatchActive : ''}`}
                  style={{ '--swatch-color': color.value } as React.CSSProperties}
                  title={color.name}
                  type="button"
                />
              ))}
            </div>
          </div>
        </div>
        <div className={`${styles.row} ${styles.rowDisabled}`}>
            <div className={styles.rowDesc}>Affects text density throughout the app</div>
          </div>
          <div className={styles.rowControl}>
            <div className={styles.seg}>
              <button className={`${styles.segTab} ${styles.segTabActive}`} type="button">Small</button>
              <button className={styles.segTab} type="button">Default</button>
              <button className={styles.segTab} type="button">Large</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
