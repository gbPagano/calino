import type { JSX, MouseEvent, ReactNode } from 'react'

interface LocationLinkProps {
  location: string
  className?: string
  /**
   * Custom content to render inside the link. When omitted, the location
   * string is rendered as a span (and the showIcon indicator, if set, is
   * appended).
   */
  children?: ReactNode
  /**
   * If provided, replaces the default `open in new tab` behavior with a
   * callback. Used in EventPreviewPopup where the location field is
   * also clickable to start editing.
   */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  /** Show a small external-link affordance after the location text. */
  showIcon?: boolean
  /**
   * When true, renders only the external-link icon (no text). Use when the
   * location text is already shown separately (e.g. in a click-to-edit field)
   * and you just want a small icon button to open the maps link.
   */
  iconOnly?: boolean
  /** ARIA label override; defaults to "Open [location] in Google Maps". */
  ariaLabel?: string
}

/**
 * Renders an event location as a link that opens a maps search in a new tab.
 * Click propagation is stopped so embedding this inside an event card doesn't
 * trigger the card's own click handler.
 */
export function LocationLink({
  location,
  className,
  children,
  onClick,
  showIcon = false,
  iconOnly = false,
  ariaLabel,
}: LocationLinkProps): JSX.Element {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
  const handleClick = (e: MouseEvent<HTMLAnchorElement>): void => {
    e.stopPropagation()
    onClick?.(e)
  }
  if (iconOnly) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={handleClick}
        aria-label={ariaLabel ?? `Open ${location} in Google Maps`}
        title={`Open in Google Maps: ${location}`}
      >
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    )
  }
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={handleClick}
      aria-label={ariaLabel ?? `Open ${location} in Google Maps`}
      title={`Open in Google Maps: ${location}`}
    >
      {children ?? <span>{location}</span>}
      {showIcon && (
        <svg
          aria-hidden="true"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="locationLinkIcon"
          style={{ marginLeft: 4, verticalAlign: '-1px' }}
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )}
    </a>
  )
}
