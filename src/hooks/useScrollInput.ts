import { useEffect } from 'react'

/**
 * Intercepts wheel events at the document level (capture phase) when a
 * managed date/time input has focus. Prevents the browser's native behaviour
 * which causes double-firing on some platforms.
 */
export function useScrollInput(
  inputs: React.RefObject<HTMLInputElement | null>[]
): void {
  useEffect(() => {
    const isManaged = (el: HTMLElement): boolean =>
      el.tagName === 'INPUT' && inputs.some((r) => r.current === el)

    const handler = (e: WheelEvent): void => {
      // Walk up from the actual target to find a managed input
      let target: HTMLElement | null = e.target as HTMLElement
      while (target && target !== document.body) {
        if (isManaged(target)) break
        target = target.parentElement
      }
      if (!target) return

      const input = target as HTMLInputElement
      if (input.type !== 'date' && input.type !== 'time') return

      e.preventDefault()
      e.stopPropagation()

      // Normalize: trackpads can fire deltaX/Y of 100–200 per "unit" while
      // mouse wheels fire 3–5. Divide to normalize to ~1 unit, then clamp.
      const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const steps = Math.round(rawDelta / 100) // normalize to ±1, ±2, …
      if (steps === 0) return
      const dir = steps > 0 ? -1 : 1

      if (input.type === 'date') {
        const [y, m, d] = (input.value || '').split('-').map(Number)
        if (!y) return
        const date = new Date(y, m - 1, d)
        date.setDate(date.getDate() + dir)
        input.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        input.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        const [h, m] = (input.value || '09:00').split(':').map(Number)
        let minutes = h * 60 + m + dir * 15
        if (minutes < 0) minutes += 24 * 60
        const nh = Math.floor(minutes / 60) % 24
        const nm = minutes % 60
        input.value = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    // Use capture so we intercept BEFORE the browser's own handlers
    document.addEventListener('wheel', handler, { passive: false, capture: true })

    return () => {
      document.removeEventListener('wheel', handler, { capture: true })
    }
  }, [inputs])
}