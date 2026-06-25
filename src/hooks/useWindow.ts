import { useEffect, useState } from 'react'
import { useMatchMedia } from './useMatchMedia'

/**
 * Returns the current window inner dimension.
 * SSR-safe: returns `0` on the server.
 */
export function useWindowDimension(dimension: 'innerWidth' | 'innerHeight'): number {
  const [value, setValue] = useState(
    typeof window !== 'undefined' ? window[dimension] : 0,
  )

  useEffect(() => {
    const handleResize = (): void => setValue(window[dimension])
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [dimension])

  return value
}

/** Returns the current `window.innerWidth`. */
export function useWindowWidth(): number {
  return useWindowDimension('innerWidth')
}

/** Returns the current `window.innerHeight`. */
export function useWindowHeight(): number {
  return useWindowDimension('innerHeight')
}

/**
 * Returns true when the window width exceeds `threshold`.
 * Default 1200px activates the day+agenda split in the bottom panel.
 * Uses matchMedia so it only re-renders when the breakpoint is crossed.
 */
export function useIsWideWindow(threshold = 1200): boolean {
  return useMatchMedia(`(min-width: ${threshold + 1}px)`)
}

/**
 * Returns true when the window height exceeds `threshold`.
 * Default 1400px activates the agenda split panel on tall screens.
 * Uses matchMedia so it only re-renders when the breakpoint is crossed.
 */
export function useIsTallWindow(threshold = 1400): boolean {
  return useMatchMedia(`(min-height: ${threshold + 1}px)`)
}
