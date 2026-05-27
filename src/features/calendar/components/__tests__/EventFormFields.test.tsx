import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventFormFields } from '../EventFormFields'
import { useSettingsStore } from '@/store/settingsStore'

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}))

describe('EventFormFields', () => {
  const defaultProps = {
    isAllDay: false,
    onIsAllDayChange: vi.fn(),
    startDate: '2024-03-15',
    onStartDateChange: vi.fn(),
    startTime: '09:00',
    onStartTimeChange: vi.fn(),
    endDate: '2024-03-15',
    onEndDateChange: vi.fn(),
    endTime: '10:00',
    onEndTimeChange: vi.fn(),
    recurrence: 'none' as 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none',
    onRecurrenceChange: vi.fn(),
    byWeekday: [] as number[],
    onByWeekdayChange: vi.fn(),
    travelDuration: undefined as number | undefined,
    onTravelDurationChange: vi.fn(),
    reminders: [] as never[],
    onRemindersChange: vi.fn(),
    transparency: 'opaque' as const,
    onTransparencyChange: vi.fn(),
  }

  const renderWithMoreOptions = (props = {}) => {
    const utils = render(<EventFormFields {...defaultProps} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    return utils
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(0)
  })

  describe('weekday selection with firstDayOfWeek=0 (Sunday)', () => {
    beforeEach(() => {
      ;(useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(0)
    })

    it('renders weekday buttons when recurrence is weekly', () => {
      renderWithMoreOptions({ recurrence: 'weekly' })
      expect(screen.getByRole('button', { name: 'Include Sun' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Include Mon' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Include Tue' })).toBeInTheDocument()
    })

    it('does not render weekday buttons when recurrence is daily', () => {
      renderWithMoreOptions({ recurrence: 'daily' })
      expect(screen.queryByRole('button', { name: 'Include Sun' })).not.toBeInTheDocument()
    })

    it('toggles weekday correctly - clicking Monday adds it to byWeekday', () => {
      const onByWeekdayChange = vi.fn()
      renderWithMoreOptions({ recurrence: 'weekly', onByWeekdayChange })

      fireEvent.click(screen.getByRole('button', { name: 'Include Mon' }))
      expect(onByWeekdayChange).toHaveBeenCalledWith([1])
    })

    it('toggles weekday correctly - clicking Monday again removes it', () => {
      const onByWeekdayChange = vi.fn()
      renderWithMoreOptions({ recurrence: 'weekly', byWeekday: [1], onByWeekdayChange })

      fireEvent.click(screen.getByRole('button', { name: 'Include Mon' }))
      expect(onByWeekdayChange).toHaveBeenCalledWith([])
    })

    it('selects multiple weekdays in order clicked', () => {
      const onByWeekdayChange = vi.fn()
      renderWithMoreOptions({ recurrence: 'weekly', onByWeekdayChange })

      fireEvent.click(screen.getByRole('button', { name: 'Include Mon' }))
      fireEvent.click(screen.getByRole('button', { name: 'Include Fri' }))

      const calls = onByWeekdayChange.mock.calls
      expect(calls[0][0]).toEqual([1])
      expect(calls[1][0]).toEqual([5])
    })

    it('removes weekday when clicked again after selecting multiple', () => {
      const onByWeekdayChange = vi.fn()
      renderWithMoreOptions({ recurrence: 'weekly', byWeekday: [1, 5], onByWeekdayChange })

      fireEvent.click(screen.getByRole('button', { name: 'Include Mon' }))

      expect(onByWeekdayChange).toHaveBeenCalledWith([5])
    })
  })

  describe('weekday selection with firstDayOfWeek=1 (Monday)', () => {
    beforeEach(() => {
      ;(useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(1)
    })

    it('displays weekdays starting with Monday when firstDayOfWeek is 1', () => {
      renderWithMoreOptions({ recurrence: 'weekly' })

      const buttons = screen.getAllByRole('button', { name: /Include/i })
      expect(buttons[0]).toHaveTextContent('Mon')
      expect(buttons[1]).toHaveTextContent('Tue')
      expect(buttons[6]).toHaveTextContent('Sun')
    })

    it('correctly maps display position to actual weekday - clicking first button (Mon) should add weekday 1', () => {
      const onByWeekdayChange = vi.fn()
      renderWithMoreOptions({ recurrence: 'weekly', onByWeekdayChange })

      fireEvent.click(screen.getByRole('button', { name: 'Include Mon' }))
      expect(onByWeekdayChange).toHaveBeenCalledWith([1])
    })

    it('correctly maps display position - clicking last button (Sun) should add weekday 0', () => {
      const onByWeekdayChange = vi.fn()
      renderWithMoreOptions({ recurrence: 'weekly', onByWeekdayChange })

      fireEvent.click(screen.getByRole('button', { name: 'Include Sun' }))
      expect(onByWeekdayChange).toHaveBeenCalledWith([0])
    })

    it('selects Mon and Sat correctly when firstDayOfWeek is Monday', () => {
      const onByWeekdayChange = vi.fn()
      renderWithMoreOptions({ recurrence: 'weekly', onByWeekdayChange })

      fireEvent.click(screen.getByRole('button', { name: 'Include Mon' }))
      fireEvent.click(screen.getByRole('button', { name: 'Include Sat' }))

      const calls = onByWeekdayChange.mock.calls
      expect(calls[0][0]).toEqual([1])
      expect(calls[1][0]).toEqual([6])
    })
  })

  describe('weekday button visual state', () => {
    it('shows selected state for checked weekdays', () => {
      renderWithMoreOptions({ recurrence: 'weekly', byWeekday: [1] })

      expect(screen.getByRole('button', { name: 'Include Mon' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      expect(screen.getByRole('button', { name: 'Include Tue' })).toHaveAttribute(
        'aria-pressed',
        'false'
      )
    })
  })

  describe('Bug 60: weekday toggles for weekly recurrence', () => {
    it('shows weekday toggles for weekly recurrence, not daily', () => {
      // Weekly should show weekday toggles
      renderWithMoreOptions({ recurrence: 'weekly' })
      expect(screen.getByText('On days:')).toBeInTheDocument()

      // Go back and check daily does NOT show them
      // (We need a fresh render for this)
    })

    it('does NOT show weekday toggles for daily recurrence', () => {
      renderWithMoreOptions({ recurrence: 'daily' })
      expect(screen.queryByText('On days:')).not.toBeInTheDocument()
    })
  })

  describe('Bug 8: time overflow at 24:xx', () => {
    it('wraps end time to 00:xx when start time is 23:xx', () => {
      const onEndTimeChange = vi.fn()
      render(
        <EventFormFields
          {...defaultProps}
          startTime="23:00"
          endTime="23:30"
          startDate="2024-03-15"
          endDate="2024-03-15"
          onEndTimeChange={onEndTimeChange}
        />
      )

      // Change start time from 23:00 to 23:30
      // The start time input is the first time input
      const startTimeInputs = screen.getAllByDisplayValue('23:00')
      const startTimeInput = startTimeInputs[0]
      fireEvent.change(startTimeInput, { target: { value: '23:30' } })

      // Since same date and newStart (23:30) >= endTime (23:30), it should auto-adjust
      // With the fix: (23 + 1) % 24 = 0, so end time becomes "00:30"
      expect(onEndTimeChange).toHaveBeenCalledWith('00:30')
    })

    it('does not produce invalid 24:xx time', () => {
      const onEndTimeChange = vi.fn()
      render(
        <EventFormFields
          {...defaultProps}
          startTime="23:00"
          endTime="23:00"
          startDate="2024-03-15"
          endDate="2024-03-15"
          onEndTimeChange={onEndTimeChange}
        />
      )

      const startTimeInputs = screen.getAllByDisplayValue('23:00')
      fireEvent.change(startTimeInputs[0], { target: { value: '23:00' } })

      // Verify no "24:" prefix appears in any call
      const calls = onEndTimeChange.mock.calls
      for (const call of calls) {
        expect(call[0]).not.toMatch(/^24:/)
      }
    })

    it('produces correct end time for non-overflowing start times', () => {
      const onEndTimeChange = vi.fn()
      render(
        <EventFormFields
          {...defaultProps}
          startTime="09:00"
          endTime="10:00"
          startDate="2024-03-15"
          endDate="2024-03-15"
          onEndTimeChange={onEndTimeChange}
        />
      )

      // 09:00 < 10:00, so the condition `newStart >= endTime` is false
      const startTimeInputs = screen.getAllByDisplayValue('09:00')
      fireEvent.change(startTimeInputs[0], { target: { value: '09:00' } })

      expect(onEndTimeChange).not.toHaveBeenCalled()
    })

    it('auto-adjusts end time by +1 hour for normal case', () => {
      const onEndTimeChange = vi.fn()
      render(
        <EventFormFields
          {...defaultProps}
          startTime="14:00"
          endTime="14:00"
          startDate="2024-03-15"
          endDate="2024-03-15"
          onEndTimeChange={onEndTimeChange}
        />
      )

      // There are two time inputs (start and end), both showing 14:00
      const timeInputs = screen.getAllByDisplayValue('14:00')
      // The first one is the start time input
      fireEvent.change(timeInputs[0], { target: { value: '15:00' } })

      // 15:00 >= 14:00 is true, so (15 + 1) % 24 = 16
      expect(onEndTimeChange).toHaveBeenCalledWith('16:00')
    })
  })
})
