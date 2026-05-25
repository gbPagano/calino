import { useEffect } from 'react'

/**
 * Attaches wheel event listeners to the parent containers of date/time inputs.
 * - For <input type="date">: scrolls by 1 day per scroll unit.
 * - For <input type="time">: scrolls by 15 min per scroll unit.
 *
 * We listen on the parent so we can e.stopPropagation() before the browser's
 * native wheel handler on the input gets the event.
 */
export function useScrollInput(
  inputs: React.RefObject<HTMLInputElement | null>[]
): void {
  useEffect(() => {
    const handler = (e: WheelEvent): void => {
      // Walk up from the target to find an input we manage
      let el: HTMLElement | null = e.target as HTMLElement
      let managedInput: HTMLInputElement | null = null
      while (el && el !== document.body) {
        if (el.tagName === 'INPUT' && inputs.some((r) => r.current === el)) {
          managedInput = el as HTMLInputElement
          break
        }
        el = el.parentElement
      }
      if (!managedInput) return

      const input = managedInput
      const type = input.type
      if (type !== 'date' && type !== 'time') return

      e.stopPropagation()
      e.preventDefault()

      // deltaMode: 0=px, 1=line, 2=page — normalise to "scroll units"
      const steps = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const dir = steps > 0 ? -1 : 1

      if (type === 'date') {
        const current = input.value ? new Date(input.value + 'T00:00:00') : new Date()
        current.setDate(current.getDate() + dir)
        input.value = current.toISOString().split('T')[0]
        input.dispatchEvent(new Event('change', { bubbles: true }))
      } else if (type === 'time') {
        const [h, m] = (input.value || '09:00').split(':').map(Number)
        let minutes = h * 60 + m + dir * 15
        if (minutes < 0) minutes += 24 * 60
        const nh = Math.floor(minutes / 60) % 24
        const nm = Math.floor(minutes % 60)
        input.value = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    // Collect all unique parent containers once
    const containers = new Set<HTMLElement>()
    for (const ref of inputs) {
      if (ref.current) containers.add(ref.current.parentElement ?? ref.current)
    }

    for (const c of containers) {
      c.addEventListener('wheel', handler, { passive: false })
    }

    return () => {
      for (const c of containers) {
        c.removeEventListener('wheel', handler)
      }
    }
  }, [inputs])
}