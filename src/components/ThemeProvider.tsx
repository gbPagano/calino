import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { loadThemes, getBuiltInThemeCSS, getThemeCSS, type ThemeInfo } from '@/lib/themes'
import { ThemeContext } from './ThemeContext'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeMode = useSettingsStore((s) => s.themeMode)
  const lightTheme = useSettingsStore((s) => s.lightTheme)
  const darkTheme = useSettingsStore((s) => s.darkTheme)
  const [loadedThemes, setLoadedThemes] = useState<ThemeInfo[]>([])
  const [, setTick] = useState(0)

  const effectiveMode = useMemo(() => {
    if (themeMode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeMode
  }, [themeMode])

  const currentThemeId = effectiveMode === 'dark' ? darkTheme : lightTheme

  const builtInCSS = useMemo(() => getBuiltInThemeCSS(), [])
  const isBuiltIn = currentThemeId === 'built-in' || currentThemeId === 'built-in-dark'
  const customCSS = !isBuiltIn ? getThemeCSS(currentThemeId) : ''

  useEffect(() => {
    const styleElement =
      document.getElementById('theme-styles') ||
      (() => {
        const el = document.createElement('style')
        el.id = 'theme-styles'
        document.head.appendChild(el)
        return el
      })()

    styleElement.textContent = builtInCSS + '\n' + customCSS
  }, [builtInCSS, customCSS])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveMode)
    document.documentElement.setAttribute('data-theme-mode', themeMode)
    if (!isBuiltIn) {
      const themeId = currentThemeId.replace(/-(light|dark)$/, '')
      document.documentElement.setAttribute('data-theme-id', themeId)
    } else {
      document.documentElement.removeAttribute('data-theme-id')
    }

    const updateThemeColor = () => {
      const style = getComputedStyle(document.documentElement)
      const accentColor = style.getPropertyValue('--color-accent').trim()
      const metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', accentColor || '#4285f4')
      }
    }

    requestAnimationFrame(updateThemeColor)
  }, [effectiveMode, themeMode])

  const themeModeRef = useRef(themeMode)
  useEffect(() => {
    themeModeRef.current = themeMode
  }, [themeMode])

  const handleMediaChange = useCallback(() => {
    if (themeModeRef.current === 'auto') {
      setTick((n) => n + 1)
    }
  }, [])

  useEffect(() => {
    if (themeMode !== 'auto') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [themeMode, handleMediaChange])

  useEffect(() => {
    loadThemes().then((themes) => {
      setLoadedThemes(themes)
    })
  }, [])

  const refetchThemes = useCallback(async () => {
    const themes = await loadThemes()
    setLoadedThemes(themes)
  }, [])

  return (
    <ThemeContext.Provider value={{ loadedThemes, refetchThemes }}>
      {children}
    </ThemeContext.Provider>
  )
}
