import { useEffect, useState } from 'react'

/**
 * Returns whether the user has requested reduced motion via their OS settings
 * (`prefers-reduced-motion: reduce`).
 *
 * Live-updates when the preference changes (e.g. user toggles in System Settings).
 *
 * Use this to:
 *  - disable framer-motion animations
 *  - skip CSS transitions on hover/focus
 *  - avoid auto-scroll-into-view behavior
 *
 * Honors WCAG 2.3.3 (Animation from Interactions).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(mq.matches)
    // `addEventListener` is the modern API; `addListener` is the legacy fallback
    // (older Safari, jsdom test env). Both are harmless to call.
    if (mq.addEventListener) {
      mq.addEventListener('change', onChange)
    } else {
      mq.addListener(onChange)
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', onChange)
      } else {
        mq.removeListener(onChange)
      }
    }
  }, [])

  return reduced
}
