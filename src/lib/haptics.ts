export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [0, 30, 50, 30],
  warning: [0, 30, 30, 30],
  error: [0, 50, 50, 50],
}

export function haptic(type: HapticType): void {
  if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(HAPTIC_PATTERNS[type])
}

const MOBILE_REGEX = /iPhone|iPad|iPod|Android/i

export function hapticIfEnabled(type: HapticType): void {
  if (MOBILE_REGEX.test(navigator.userAgent)) {
    haptic(type)
  }
}
