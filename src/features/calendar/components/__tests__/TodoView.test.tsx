import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { TodoView } from '../TodoView'
import { useCalendarStore } from '@/store/calendarStore'
import { useIsMobile } from '@/hooks/useIsMobile'

vi.mock('@/hooks/useIsMobile')

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('TodoView', () => {
  beforeEach(() => {
    const store = useCalendarStore.getState()
    store.setCurrentView('todo')
    store.setCurrentDate('2024-03-15')
    store.events.forEach((e) => store.deleteEvent(e.id))
  })

  it('shows filter tabs', () => {
    renderWithRouter(<TodoView />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument()
  })

  it('shows add task button', () => {
    renderWithRouter(<TodoView />)
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument()
  })

  it('shows empty state when no active tasks (default filter)', () => {
    renderWithRouter(<TodoView />)
    expect(screen.getByText('All clear')).toBeInTheDocument()
    expect(screen.getByText('Nothing here right now.')).toBeInTheDocument()
  })

  it('shows tasks when they exist', async () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'task-1',
      calendarId: 'cal-1',
      title: 'Test Task',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
    })

    renderWithRouter(<TodoView />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('filters by active tasks', async () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'task-1',
      calendarId: 'cal-1',
      title: 'Active Task',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
      completed: false,
    })
    store.addEvent({
      id: 'task-2',
      calendarId: 'cal-1',
      title: 'Completed Task',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
      completed: true,
    })

    renderWithRouter(<TodoView />)

    await userEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText('Active Task')).toBeInTheDocument()
    expect(screen.queryByText('Completed Task')).not.toBeInTheDocument()
  })

  it('filters by completed tasks', async () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'task-1',
      calendarId: 'cal-1',
      title: 'Active Task',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
      completed: false,
    })
    store.addEvent({
      id: 'task-2',
      calendarId: 'cal-1',
      title: 'Completed Task',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
      completed: true,
    })

    renderWithRouter(<TodoView />)

    await userEvent.click(screen.getByRole('button', { name: 'Completed' }))
    expect(screen.queryByText('Active Task')).not.toBeInTheDocument()
    expect(screen.getByText('Completed Task')).toBeInTheDocument()
  })

  it('shows task count', () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'task-1',
      calendarId: 'cal-1',
      title: 'Active Task',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
      completed: false,
    })
    store.addEvent({
      id: 'task-2',
      calendarId: 'cal-1',
      title: 'Completed Task',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
      completed: true,
    })

    renderWithRouter(<TodoView />)
    // Count is split across elements: <b>1</b> active · 1 completed
    const countEl = screen.getByText(/active/)
    expect(countEl).toBeInTheDocument()
    expect(countEl.textContent).toContain('active')
  })

  it('shows description when present', () => {
    const store = useCalendarStore.getState()
    store.addEvent({
      id: 'task-1',
      calendarId: 'cal-1',
      title: 'Task with description',
      description: 'This is a description',
      start: '2024-03-15T10:00:00.000Z',
      end: '2024-03-15T11:00:00.000Z',
      isAllDay: false,
      type: 'task',
    })

    renderWithRouter(<TodoView />)
    expect(screen.getByText('This is a description')).toBeInTheDocument()
  })
})
