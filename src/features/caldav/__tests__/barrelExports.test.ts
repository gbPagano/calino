import { describe, it, expect } from 'vitest'

describe('CalDAV barrel exports', () => {
  describe('Bug 34: taskToICAL is exported from barrel', () => {
    it('exports taskToICAL from caldav/index.ts barrel', async () => {
      const barrel = await import('../index')
      expect(typeof barrel.taskToICAL).toBe('function')
    })

    it('exports eventToICAL from caldav/index.ts barrel', async () => {
      const barrel = await import('../index')
      expect(typeof barrel.eventToICAL).toBe('function')
    })

    it('exports parseICALData from caldav/index.ts barrel', async () => {
      const barrel = await import('../index')
      expect(typeof barrel.parseICALData).toBe('function')
    })

    it('exports isUUID from caldav/index.ts barrel', async () => {
      const barrel = await import('../index')
      expect(typeof barrel.isUUID).toBe('function')
    })
  })
})
