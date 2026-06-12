import { toast as sonner } from 'sonner'

export interface ShowToastOptions {
  onUndo?: () => void
  duration?: number
  linkText?: string
  onLinkClick?: () => void
}

/**
 * Show a transient notification.
 * Wraps sonner's `toast()` and adds an Undo action button when `onUndo` is
 * provided, or a generic action button when `linkText`/`onLinkClick` are set.
 * Undo takes precedence — when both are set, only the Undo button is shown.
 */
export function showToast(message: string, options?: ShowToastOptions): void {
  const opts: Parameters<typeof sonner>[1] = {
    duration: options?.duration,
  }

  if (options?.onUndo) {
    opts.action = {
      label: 'Undo',
      onClick: () => {
        options.onUndo?.()
      },
    }
  } else if (options?.linkText && options.onLinkClick) {
    opts.action = {
      label: options.linkText,
      onClick: () => {
        options.onLinkClick?.()
      },
    }
  }

  sonner(message, opts)
}


