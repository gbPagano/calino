import { useEffect, useMemo } from 'react'
import type { JSX } from 'react'
import { useSettingsStore, THEME_MODE_OPTIONS } from '@/store/settingsStore'
import { useTheme } from '@/components/ThemeContext'
import { getThemePreviewCSS } from '@/lib/themes'
import type { ThemeMode } from '@/types'
import styles from './Settings.module.css'

function MiniCalendarPreview({ variant }: { variant: 'light' | 'dark' | 'system' }): JSX.Element {
  const cellBg = variant === 'dark' ? '#252218' : '#f0ece5'
  const eventBg = variant === 'dark' ? 'color-mix(in srgb, #b07d4f 20%, #1a1815)' : 'color-mix(in srgb, #b07d4f 12%, #faf8f3)'

  const previewStyle = variant === 'system'
    ? { background: 'linear-gradient(135deg, #faf8f3 50%, #1a1815 50%)' }
    : { background: variant === 'dark' ? '#1a1815' : '#faf8f3' }

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

function extractThemeProps(css: string): { bg: string; panel: string; accent: string; text: string; radiusSm: string; radiusMd: string; radiusLg: string } {
  const get = (prop: string, fallback: string): string => {
    const match = css.match(new RegExp(`${prop}:\\s*([^;]+)`))
    return match ? match[1].trim() : fallback
  }
  return {
    bg: get('--canvas', get('--color-bg-primary', '#faf8f3')),
    panel: get('--panel', get('--color-bg-secondary', '#ffffff')),
    accent: get('--accent', get('--color-accent', '#b07d4f')),
    text: get('--ink', get('--color-text-primary', '#2c2823')),
    radiusSm: get('--radius-sm', '7px'),
    radiusMd: get('--radius-md', '11px'),
    radiusLg: get('--radius-lg', '16px'),
  }
}

function ThemePreviewCard({ name, css, isActive, onClick }: { name: string; css: string; isActive: boolean; onClick: () => void }): JSX.Element {
  const props = useMemo(() => extractThemeProps(css), [css])

  return (
    <button
      className={`${styles.themePreviewCard} ${isActive ? styles.themePreviewCardActive : ''}`}
      onClick={onClick}
      data-component="theme-preview-card"
      data-theme-id={name}
      data-active={isActive ? 'true' : undefined}
      type="button"
    >
      <div className={styles.themePreviewSwatch} style={{ background: props.bg }}>
        <div className={styles.themePreviewPanel} style={{ background: props.panel, borderRadius: props.radiusMd }}>
          <div className={styles.themePreviewBar} style={{ background: props.accent, width: '50%', borderRadius: props.radiusSm }} />
          <div className={styles.themePreviewRows}>
            <div className={styles.themePreviewRow} style={{ background: props.text, opacity: 0.15, width: '80%', borderRadius: props.radiusSm }} />
            <div className={styles.themePreviewRow} style={{ background: props.text, opacity: 0.1, width: '60%', borderRadius: props.radiusSm }} />
            <div className={styles.themePreviewRow} style={{ background: props.text, opacity: 0.06, width: '70%', borderRadius: props.radiusSm }} />
          </div>
        </div>
      </div>
      <div className={styles.themePreviewLabel}>{name}</div>
    </button>
  )
}

export function ThemeSettings(): JSX.Element {
  const themeMode = useSettingsStore((s) => s.themeMode)
  const lightTheme = useSettingsStore((s) => s.lightTheme)
  const darkTheme = useSettingsStore((s) => s.darkTheme)
  const journalEnabled = useSettingsStore((s) => s.journalEnabled)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const { loadedThemes, refetchThemes } = useTheme()

  useEffect(() => {
    refetchThemes()
  }, [refetchThemes])

  const lightThemes = loadedThemes.filter((t) => !t.isDark)
  const darkThemes = loadedThemes.filter((t) => t.isDark)

  return (
    <section className={`${styles.section} ${styles.sectionActive}`} data-component="theme-settings">
      <h1 className={styles.pageTitle}>Appearance</h1>
      <div className={styles.group}>
        <div className={`${styles.row} ${styles.rowTop}`} data-component="setting-row" data-setting="theme-mode" data-value={themeMode}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Appearance</div>
            <div className={styles.rowDesc}>Choose how Calino looks</div>
          </div>
          <div className={styles.rowControl} style={{ alignItems: 'flex-start', paddingTop: '2px' }}>
            <div className={styles.themeCards}>
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
                    data-component="theme-mode-option"
                    data-value={opt.value}
                    data-active={isActive ? 'true' : undefined}
                    type="button"
                  >
                    <MiniCalendarPreview variant={isLight ? 'light' : isDark ? 'dark' : 'system'} />
                    <div className={styles.themeCardLabel}>
                      {isSystem ? 'System' : opt.label}
                      <div className={styles.tcCheck}>
                        <svg viewBox="0 0 9 9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
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
        <div className={styles.row} data-component="setting-row" data-setting="light-theme" data-value={lightTheme}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Light Theme</div>
            <div className={styles.rowDesc}>Color palette used in light mode</div>
          </div>
        </div>
        <div className={styles.themePreviewGrid}>
          {lightThemes.map((t) => (
            <ThemePreviewCard
              key={t.id}
              name={t.name}
              css={getThemePreviewCSS(t.id)}
              isActive={lightTheme === t.id}
              onClick={() => updateSettings({ lightTheme: t.id })}
            />
          ))}
        </div>
        <div className={styles.row} data-component="setting-row" data-setting="dark-theme" data-value={darkTheme}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Dark Theme</div>
            <div className={styles.rowDesc}>Color palette used in dark mode</div>
          </div>
        </div>
        <div className={styles.themePreviewGrid}>
          {darkThemes.map((t) => (
            <ThemePreviewCard
              key={t.id}
              name={t.name}
              css={getThemePreviewCSS(t.id)}
              isActive={darkTheme === t.id}
              onClick={() => updateSettings({ darkTheme: t.id })}
            />
          ))}
        </div>
        <div className={styles.group}>
        <div className={styles.row} data-component="setting-row" data-setting="journal" data-value={String(journalEnabled)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Journal</div>
            <div className={styles.rowDesc}>Attach freeform notes to days in your calendar</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="journal">
              <input
                type="checkbox"
                checked={journalEnabled}
                aria-label="Journal"
                onChange={(e) => updateSettings({ journalEnabled: e.target.checked })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
      </div>
        <div className={`${styles.row} ${styles.rowDisabled}`} title="Not available yet">
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Font Size</div>
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
