export function showToast(message: string, options?: { onUndo?: () => void; duration?: number }): void {
  window.dispatchEvent(new CustomEvent('show-toast', {
    detail: {
      message,
      onUndo: options?.onUndo,
      duration: options?.duration,
    },
  }))
}
