import { describe, it, expect } from 'vitest'
import { transitionDirection } from '../App'

describe('transitionDirection', () => {
  it('has no direction on first mount', () => {
    expect(transitionDirection(null, 'month')).toEqual({ axis: 'zoom', dir: 0 })
  })

  it('has no direction when the view is unchanged', () => {
    expect(transitionDirection('week', 'week')).toEqual({ axis: 'zoom', dir: 0 })
  })

  it('zooms in when moving month → week → day', () => {
    expect(transitionDirection('month', 'week')).toEqual({ axis: 'zoom', dir: 1 })
    expect(transitionDirection('week', 'day')).toEqual({ axis: 'zoom', dir: 1 })
    expect(transitionDirection('month', 'day')).toEqual({ axis: 'zoom', dir: 1 })
  })

  it('zooms out when moving day → week → month', () => {
    expect(transitionDirection('day', 'week')).toEqual({ axis: 'zoom', dir: -1 })
    expect(transitionDirection('day', 'month')).toEqual({ axis: 'zoom', dir: -1 })
  })

  it('slides for non-zoom view switches, signed by view order', () => {
    expect(transitionDirection('month', 'agenda')).toEqual({ axis: 'slide', dir: 1 })
    expect(transitionDirection('agenda', 'month')).toEqual({ axis: 'slide', dir: -1 })
    expect(transitionDirection('day', 'todo')).toEqual({ axis: 'slide', dir: 1 })
  })
})
