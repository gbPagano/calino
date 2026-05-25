import { useState, useEffect } from 'react'

/** Returns the current window inner height, updated on resize. */
export function useWindowHeight(): number {
  const [height, setHeight] = useState(window.innerHeight)

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
 */
export function useIsTallWindow(threshold = 1400): boolean {
  const height = useWindowHeight()
  return height > threshold
}

/** Returns the current window inner width, updated on resize. */
export function useWindowWidth(): number {
  const [width, setWidth] = useState(window.innerWidth)

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
 */
export function useIsWideWindow(threshold = 1200): boolean {
  const width = useWindowWidth()
  return width > threshold
}
