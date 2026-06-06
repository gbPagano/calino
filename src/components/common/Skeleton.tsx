import type { JSX } from 'react'
import './Skeleton.css'

export function CalendarSkeleton(): JSX.Element {
  return (
    <div className="skeleton" aria-hidden="true">
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
  )
}
