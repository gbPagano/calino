import { useState, useEffect } from 'react'

/** Returns the current window inner height, updated on resize. */
export function useWindowHeight(): number {
  const [height, setHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  )

  useEffect(() => {
    const handleResize = (): void => setHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return height
}

/**
 * Returns true when the window height exceeds the given threshold.
 * Default threshold 1400px activates the agenda split panel on tall screens.
 * Uses matchMedia to only re-render when the breakpoint is actually crossed.
 */
export function useIsTallWindow(threshold = 1400): boolean {
  const [isTall, setIsTall] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerHeight > threshold
  })

  useEffect(() => {
    const mql = window.matchMedia(`(min-height: ${threshold + 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsTall(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [threshold])

  return isTall
}

/** Returns the current window inner width, updated on resize. */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 0
  )

  useEffect(() => {
    const handleResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return width
}

/**
 * Returns true when the window width exceeds the given threshold.
 * Default threshold 1200px activates the day+agenda split in the bottom panel.
 * Uses matchMedia to only re-render when the breakpoint is actually crossed.
 */
export function useIsWideWindow(threshold = 1200): boolean {
  const [isWide, setIsWide] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth > threshold
  })

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${threshold + 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [threshold])

  return isWide
}
