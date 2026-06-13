import { useEffect, useState } from 'react'
import { MOBILE_BREAKPOINT, COMPACT_MOBILE_BREAKPOINT } from '@/config'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}

export function useIsCompactMobile(): boolean {
  const [isCompactMobile, setIsCompactMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${COMPACT_MOBILE_BREAKPOINT}px)`).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${COMPACT_MOBILE_BREAKPOINT}px)`)
    const handler = (e: MediaQueryListEvent) => setIsCompactMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isCompactMobile
}
