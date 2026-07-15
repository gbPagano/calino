import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarSettings } from '../components/CalendarSettings'
import { useSettingsStore } from '@/store/settingsStore'

describe('CalendarSettings', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      defaultView: 'month',
      showWeekNumbers: true,
      eventDensity: 'comfortable',
      compactRecurringEvents: true,
      compressPastWeeks: true,
    })
  })

  it('renders calendar settings', () => {
    render(<CalendarSettings />)

    expect(screen.getByText('Calendar')).toBeInTheDocument()
    expect(screen.getByText('Default View')).toBeInTheDocument()
    expect(screen.getByText('Show Week Numbers')).toBeInTheDocument()
    expect(screen.getByText('Event Display Density')).toBeInTheDocument()
  })

  it('toggles compact recurring events', async () => {
    const user = userEvent.setup()
    render(<CalendarSettings />)

    const compactToggle = screen.getByLabelText('Compact recurring events')

    expect(compactToggle).toBeChecked()

    await user.click(compactToggle)

    expect(useSettingsStore.getState().compactRecurringEvents).toBe(false)
  })

  it('toggles compress past weeks', async () => {
    const user = userEvent.setup()
    render(<CalendarSettings />)

    const compressToggle = screen.getByLabelText('Compact past weeks')

    expect(compressToggle).toBeChecked()

    await user.click(compressToggle)

    expect(useSettingsStore.getState().compressPastWeeks).toBe(false)
  })
})
