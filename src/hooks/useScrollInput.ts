import { useEffect, useRef } from 'react'

/**
 * Attaches wheel event listeners to a list of input refs.
 * For <input type="date">: scrolls through days.
 * For <input type="time">: scrolls through 15-minute increments.
 */
export function useScrollInput(
  inputs: React.RefObject<HTMLInputElement | null>[]
): void {
  const handlerRef = useRef<(e: WheelEvent) => void | undefined>(undefined)

  useEffect(() => {
    const handler = (e: WheelEvent): void => {
      const input = e.target as HTMLInputElement
      if (!input || input.tagName !== 'INPUT') return

      e.preventDefault()

      const type = input.type

      if (type === 'date') {
        const current = input.value ? new Date(input.value + 'T00:00:00') : new Date()
        const delta = e.deltaY < 0 ? 1 : -1
        current.setDate(current.getDate() + delta)
        input.value = current.toISOString().split('T')[0]
        input.dispatchEvent(new Event('change', { bubbles: true }))
      } else if (type === 'time') {
        const [h, m] = (input.value || '09:00').split(':').map(Number)
        const dir = e.deltaY < 0 ? 1 : -1
        let minutes = h * 60 + m + dir * 15
        if (minutes < 0) minutes += 24 * 60
        const nh = Math.floor(minutes / 60) % 24
        const nm = Math.floor(minutes % 60)
        input.value = `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    handlerRef.current = handler

    // Attach to all inputs on mount
    const els: HTMLElement[] = []
    for (const ref of inputs) {
      if (ref.current) {
        ref.current.addEventListener('wheel', handler, { passive: false })
        els.push(ref.current)
      }
    }

    // Also attach to future inputs via MutationObserver
    const observer = new MutationObserver(() => {
      for (const ref of inputs) {
        if (ref.current && !els.includes(ref.current)) {
          ref.current.addEventListener('wheel', handler, { passive: false })
          els.push(ref.current)
        }
      }
    })

    // Observe all inputs already in the form
    for (const ref of inputs) {
      if (ref.current?.parentElement) {
        observer.observe(ref.current.parentElement, { childList: true, subtree: true })
      }
    }

    return () => {
      for (const el of els) {
        el.removeEventListener('wheel', handler)
      }
      observer.disconnect()
    }
  }, [inputs])
}