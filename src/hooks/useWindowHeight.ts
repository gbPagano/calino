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
