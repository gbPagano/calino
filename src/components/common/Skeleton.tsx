import type { JSX } from 'react'
import type { ViewType } from '@/types'
import './Skeleton.css'

interface CalendarSkeletonProps {
  view?: ViewType
}

export function CalendarSkeleton({ view = 'month' }: CalendarSkeletonProps): JSX.Element {
  return (
    <div className="skeleton" aria-hidden="true">
      {view === 'month' && <MonthSkeleton />}
      {view === 'week' && <WeekSkeleton />}
      {view === 'day' && <DaySkeleton />}
      {view === 'agenda' && <AgendaSkeleton />}
      {view === 'todo' && <TodoSkeleton />}
    </div>
  )
}

function MonthSkeleton(): JSX.Element {
  return (
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
  )
}

function WeekSkeleton(): JSX.Element {
  const hours = Array.from({ length: 12 }).map((_, i) => i + 7) // 7am–6pm
  return (
    <div className="skeleton-week">
      <div className="skeleton-week-header">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton-week-day-col">
            <div className="skeleton-bar skeleton-bar--week-day-label" />
            <div className="skeleton-bar skeleton-bar--week-date" />
          </div>
        ))}
      </div>
      <div className="skeleton-week-body">
        {hours.map((h) => (
          <div key={h} className="skeleton-week-row">
            <div className="skeleton-bar skeleton-bar--hour-label" />
            {Array.from({ length: 7 }).map((_, col) => (
              <div key={col} className="skeleton-week-cell">
                {Math.random() > 0.7 && (
                  <div className="skeleton-bar skeleton-bar--week-event" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DaySkeleton(): JSX.Element {
  const hours = Array.from({ length: 14 }).map((_, i) => i + 6) // 6am–7pm
  return (
    <div className="skeleton-day">
      <div className="skeleton-day-header">
        <div className="skeleton-bar skeleton-bar--day-title" />
      </div>
      <div className="skeleton-day-body">
        {hours.map((h) => (
          <div key={h} className="skeleton-day-row">
            <div className="skeleton-bar skeleton-bar--hour-label" />
            <div className="skeleton-day-cell">
              {Math.random() > 0.65 && (
                <div className="skeleton-bar skeleton-bar--day-event" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgendaSkeleton(): JSX.Element {
  return (
    <div className="skeleton-agenda">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-agenda-item">
          <div className="skeleton-bar skeleton-bar--agenda-date" />
          <div className="skeleton-agenda-item-content">
            <div className="skeleton-bar skeleton-bar--agenda-title" />
            <div className="skeleton-bar skeleton-bar--agenda-time" />
          </div>
        </div>
      ))}
    </div>
  )
}

function TodoSkeleton(): JSX.Element {
  return (
    <div className="skeleton-todo">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-todo-item">
          <div className="skeleton-bar skeleton-bar--todo-check" />
          <div className="skeleton-todo-item-content">
            <div className="skeleton-bar skeleton-bar--todo-title" />
            {Math.random() > 0.5 && (
              <div className="skeleton-bar skeleton-bar--todo-due" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
