export function showToast(message: string, options?: { onUndo?: () => void; duration?: number; linkText?: string; onLinkClick?: () => void }): void {
  window.dispatchEvent(new CustomEvent('show-toast', {
    detail: {
      message,
      onUndo: options?.onUndo,
      duration: options?.duration,
      linkText: options?.linkText,
      onLinkClick: options?.onLinkClick,
    },
  }))
}
