import type { JSX } from 'react'
import './Skeleton.css'

export function CalendarSkeleton(): JSX.Element {
  return (
    <div className="skeleton" aria-hidden="true">
      {/* Header skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-bar skeleton-bar--icon" />
        <div className="skeleton-bar skeleton-bar--title" />
        <div className="skeleton-row">
          <div className="skeleton-bar skeleton-bar--nav" />
          <div className="skeleton-bar skeleton-bar--nav" />
        </div>
      </div>

      {/* Body: sidebar + grid */}
      <div className="skeleton-body">
        {/* Sidebar skeleton */}
        <div className="skeleton-sidebar">
          <div className="skeleton-bar skeleton-bar--sidebar-title" />
          <div className="skeleton-bar skeleton-bar--sidebar-item" />
          <div className="skeleton-bar skeleton-bar--sidebar-item" />
          <div className="skeleton-bar skeleton-bar--sidebar-item" />
          <div className="skeleton-bar skeleton-bar--sidebar-title" style={{ marginTop: 16 }} />
          <div className="skeleton-bar skeleton-bar--sidebar-item" />
          <div className="skeleton-bar skeleton-bar--sidebar-item" />
        </div>

        {/* Grid skeleton */}
        <div className="skeleton-grid">
          <div className="skeleton-grid-header">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton-bar skeleton-bar--day-label" />
            ))}
          </div>
          <div className="skeleton-grid-body">
            {Array.from({ length: 5 }).map((_, row) => (
              <div key={row} className="skeleton-grid-row">
                {Array.from({ length: 7 }).map((_, col) => (
                  <div key={col} className="skeleton-cell">
                    {Math.random() > 0.6 && (
                      <div className="skeleton-bar skeleton-bar--event" />
                    )}
                    {Math.random() > 0.8 && (
                      <div className="skeleton-bar skeleton-bar--event skeleton-bar--event-short" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
