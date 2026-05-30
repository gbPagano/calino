export function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message } }))
}
