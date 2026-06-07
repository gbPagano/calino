import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CalDAVClient, createCalDAVClient, buildProxyUrl } from '../CalDAVClient'
import type { CalDAVCredentials } from '../../types'

vi.mock('tsdav', () => ({
  createDAVClient: vi.fn(),
}))

const mockCreateDAVClient = vi.mocked(await import('tsdav').then((m) => m.createDAVClient))

describe('CalDAVClient', () => {
  let client: CalDAVClient
  const mockCredentials: CalDAVCredentials = {
    id: 'cred-1',
    serverUrl: 'https://caldav.example.com',
    username: 'testuser',
    password: 'testpass',
  }

  const mockCalendar = {
    url: 'https://caldav.example.com/calendars/test/default/',
    displayName: 'Default Calendar',
    components: ['VEVENT', 'VTODO'],
  }

  const mockEventObject = {
    url: 'https://caldav.example.com/calendars/test/default/event-1.ics',
    data: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Test Event
DTSTART:20240315T100000Z
DTEND:20240315T110000Z
END:VEVENT
END:VCALENDAR`,
    etag: '"event-etag"',
  }

  const mockTodoObject = {
    url: 'https://caldav.example.com/calendars/test/default/task-1.ics',
    data: `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTODO
UID:task-1
SUMMARY:Test Task
DUE;VALUE=DATE:20240320
STATUS:NEEDS-ACTION
END:VTODO
END:VCALENDAR`,
    etag: '"todo-etag"',
  }

  const mockClientMethods = {
    fetchCalendars: vi.fn(),
    fetchCalendarObjects: vi.fn(),
    createCalendarObject: vi.fn(),
    updateCalendarObject: vi.fn(),
    deleteCalendarObject: vi.fn(),
    davRequest: vi.fn(),
    fetchVCals: vi.fn(),
    getMultipleVCard: vi.fn(),
    getSingleVCard: vi.fn(),
    createVCard: vi.fn(),
    updateVCard: vi.fn(),
    deleteVCard: vi.fn(),
    syncCollection: vi.fn(),
  } as any

  let onLineSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: online
    onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    client = new CalDAVClient(mockCredentials.serverUrl, mockCredentials)

    mockCreateDAVClient.mockResolvedValue(mockClientMethods)
    mockClientMethods.fetchCalendars.mockResolvedValue([mockCalendar])
  })

  afterEach(() => {
    onLineSpy.mockRestore()
  })

  describe('createCalDAVClient', () => {
    it('creates and connects a client', async () => {
      const result = await createCalDAVClient(mockCredentials.serverUrl, mockCredentials)

      expect(mockCreateDAVClient).toHaveBeenCalledWith({
        serverUrl: mockCredentials.serverUrl,
        credentials: {
          username: mockCredentials.username,
          password: mockCredentials.password,
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      })
      expect(result).toBeInstanceOf(CalDAVClient)
    })
  })

  describe('fetchCalendars', () => {
    it('fetches and maps calendars', async () => {
      await client.connect()
      const calendars = await client.fetchCalendars()

      expect(mockClientMethods.fetchCalendars).toHaveBeenCalled()
      expect(calendars).toHaveLength(1)
      expect(calendars[0].url).toBe(mockCalendar.url)
      expect(calendars[0].name).toBe(mockCalendar.displayName)
    })

    // Bug 14: calendar ID should use UUID, not Date.now()
    it('generates unique UUID-based IDs when server does not provide a URL', async () => {
      await client.connect()
      mockClientMethods.fetchCalendars.mockResolvedValue([
        { url: '', displayName: 'Cal 1' },
        { url: '', displayName: 'Cal 2' },
      ])

      const calendars = await client.fetchCalendars()

      expect(calendars[0].id).not.toBe(calendars[1].id)
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(calendars[0].id).toMatch(
        /^cal-0-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    })

    // Bug 16: fetchCalendars should return raw server URLs, not proxy-prefixed
    it('stores raw server URLs even when proxy is configured', async () => {
      const proxyClient = new CalDAVClient(
        mockCredentials.serverUrl,
        mockCredentials,
        'https://proxy.example.com'
      )
      await proxyClient.connect()

      const calendars = await proxyClient.fetchCalendars()

      // Should be the raw URL, NOT proxy-prefixed
      expect(calendars[0].url).toBe(mockCalendar.url)
      expect(calendars[0].url).not.toContain('proxy.example.com')
    })

    // Bug 20: offline detection
    it('throws when offline', async () => {
      onLineSpy.mockReturnValue(false)
      await client.connect()

      await expect(client.fetchCalendars()).rejects.toThrow(
        'No network connection'
      )
    })
  })

  describe('fetchEvents', () => {
    it('fetches both VEVENTs, VTODOs, and VJOURNALs', async () => {
      await client.connect()

      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([mockTodoObject])
        .mockResolvedValueOnce([])

      const result = await client.fetchEvents(
        mockCalendar.url,
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      expect(mockClientMethods.fetchCalendarObjects).toHaveBeenCalledTimes(3)

      expect(result).toHaveLength(2)
      expect(result.find((obj) => obj.url === mockEventObject.url)).toBeDefined()
      expect(result.find((obj) => obj.url === mockTodoObject.url)).toBeDefined()
    })

    it('uses timeRange filter for VEVENTs', async () => {
      await client.connect()

      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      await client.fetchEvents(mockCalendar.url, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z')

      expect(mockClientMethods.fetchCalendarObjects).toHaveBeenNthCalledWith(1, {
        calendar: mockCalendar,
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z',
        },
      })
    })

    it('uses VTODO filter for tasks', async () => {
      await client.connect()

      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockTodoObject])
        .mockResolvedValueOnce([])

      await client.fetchEvents(mockCalendar.url, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z')

      expect(mockClientMethods.fetchCalendarObjects).toHaveBeenNthCalledWith(2, {
        calendar: mockCalendar,
        filters: {
          'comp-filter': {
            _attributes: {
              name: 'VCALENDAR',
            },
            'comp-filter': {
              _attributes: {
                name: 'VTODO',
              },
            },
          },
        },
      })
    })

    it('deduplicates results by URL', async () => {
      await client.connect()

      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([])

      const result = await client.fetchEvents(
        mockCalendar.url,
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      expect(result).toHaveLength(1)
    })

    it('returns empty array when no events or tasks found', async () => {
      await client.connect()

      mockClientMethods.fetchCalendarObjects.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await client.fetchEvents(
        mockCalendar.url,
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      expect(result).toHaveLength(0)
    })

    // Bug 16: calendar lookup uses raw URL matching
    it('finds calendar by raw server URL', async () => {
      await client.connect()

      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await client.fetchEvents(
        'https://caldav.example.com/calendars/test/default/',
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      expect(result).toHaveLength(1)
    })

    // Bug 16: event URLs should be raw, not proxy-prefixed
    it('returns raw event URLs without proxy prefix', async () => {
      const proxyClient = new CalDAVClient(
        mockCredentials.serverUrl,
        mockCredentials,
        'https://proxy.example.com'
      )
      await proxyClient.connect()

      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await proxyClient.fetchEvents(
        mockCalendar.url,
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      expect(result[0].url).toBe(mockEventObject.url)
      expect(result[0].url).not.toContain('proxy.example.com')
    })

    // Bug 20: offline detection
    it('throws when offline', async () => {
      onLineSpy.mockReturnValue(false)
      await client.connect()

      await expect(
        client.fetchEvents(mockCalendar.url, '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z')
      ).rejects.toThrow('No network connection')
    })
  })

  describe('createEvent', () => {
    it('creates a calendar object', async () => {
      await client.connect()

      mockClientMethods.createCalendarObject.mockResolvedValue({
        url: mockEventObject.url,
      })

      const result = await client.createEvent(mockCalendar.url, mockEventObject.data, 'event-1.ics')

      expect(mockClientMethods.createCalendarObject).toHaveBeenCalledWith({
        calendar: mockCalendar,
        filename: 'event-1.ics',
        iCalString: mockEventObject.data,
      })
      expect(result.url).toBe(mockEventObject.url)
    })

    // Bug 16: returned URL should be raw
    it('returns raw URL without proxy prefix', async () => {
      const proxyClient = new CalDAVClient(
        mockCredentials.serverUrl,
        mockCredentials,
        'https://proxy.example.com'
      )
      await proxyClient.connect()

      mockClientMethods.createCalendarObject.mockResolvedValue({
        url: mockEventObject.url,
      })

      const result = await proxyClient.createEvent(
        mockCalendar.url,
        mockEventObject.data,
        'event-1.ics'
      )

      expect(result.url).toBe(mockEventObject.url)
      expect(result.url).not.toContain('proxy.example.com')
    })

    // Bug 20: offline detection
    it('throws when offline', async () => {
      onLineSpy.mockReturnValue(false)
      await client.connect()

      await expect(
        client.createEvent(mockCalendar.url, mockEventObject.data, 'event-1.ics')
      ).rejects.toThrow('No network connection')
    })
  })

  describe('updateEvent', () => {
    it('updates a calendar object', async () => {
      await client.connect()

      mockClientMethods.updateCalendarObject.mockResolvedValue({
        url: mockEventObject.url,
      })

      const result = await client.updateEvent(
        mockCalendar.url,
        mockEventObject.url,
        mockEventObject.data,
        mockEventObject.etag
      )

      expect(mockClientMethods.updateCalendarObject).toHaveBeenCalledWith({
        calendarObject: {
          url: mockEventObject.url,
          etag: mockEventObject.etag,
          data: mockEventObject.data,
        },
      })
      expect(result.url).toBe(mockEventObject.url)
    })

    // Bug 20: offline detection
    it('throws when offline', async () => {
      onLineSpy.mockReturnValue(false)
      await client.connect()

      await expect(
        client.updateEvent(
          mockCalendar.url,
          mockEventObject.url,
          mockEventObject.data,
          mockEventObject.etag
        )
      ).rejects.toThrow('No network connection')
    })
  })

  describe('deleteEvent', () => {
    it('deletes a calendar object', async () => {
      await client.connect()

      await client.deleteEvent(mockEventObject.url, mockEventObject.etag)

      expect(mockClientMethods.deleteCalendarObject).toHaveBeenCalledWith({
        calendarObject: {
          url: mockEventObject.url,
          etag: mockEventObject.etag,
        },
      })
    })

    // Bug 20: offline detection
    it('throws when offline', async () => {
      onLineSpy.mockReturnValue(false)
      await client.connect()

      await expect(
        client.deleteEvent(mockEventObject.url, mockEventObject.etag)
      ).rejects.toThrow('No network connection')
    })
  })

  describe('calendar caching (Bug 32)', () => {
    it('caches calendars after first fetchCalendars() call', async () => {
      await client.connect()

      await client.fetchCalendars()

      // Second call should NOT hit the network again because we cache
      mockClientMethods.fetchCalendars.mockClear()

      // Call fetchEvents which needs to find a calendar
      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      await client.fetchEvents(
        mockCalendar.url,
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      // fetchCalendars should NOT have been called again — cached
      expect(mockClientMethods.fetchCalendars).not.toHaveBeenCalled()
    })

    it('fetches calendars once and reuses cache for createEvent', async () => {
      await client.connect()

      await client.fetchCalendars()
      mockClientMethods.fetchCalendars.mockClear()

      mockClientMethods.createCalendarObject.mockResolvedValue({
        url: mockEventObject.url,
      })

      await client.createEvent(mockCalendar.url, mockEventObject.data, 'event-1.ics')

      expect(mockClientMethods.fetchCalendars).not.toHaveBeenCalled()
    })

    it('fetches calendars once and reuses cache for updateEvent', async () => {
      await client.connect()

      await client.fetchCalendars()
      mockClientMethods.fetchCalendars.mockClear()

      mockClientMethods.updateCalendarObject.mockResolvedValue({
        url: mockEventObject.url,
      })

      await client.updateEvent(
        mockCalendar.url,
        mockEventObject.url,
        mockEventObject.data,
        mockEventObject.etag
      )

      expect(mockClientMethods.fetchCalendars).not.toHaveBeenCalled()
    })

    it('fetches calendars lazily on first findCalendarByUrl if cache is empty', async () => {
      await client.connect()
      // Do NOT call fetchCalendars() explicitly — cache should be populated lazily

      mockClientMethods.fetchCalendars.mockClear()
      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      await client.fetchEvents(
        mockCalendar.url,
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z'
      )

      // Should have fetched calendars once (lazy init)
      expect(mockClientMethods.fetchCalendars).toHaveBeenCalledTimes(1)

      // Now subsequent calls should use cache
      mockClientMethods.fetchCalendars.mockClear()
      mockClientMethods.fetchCalendarObjects
        .mockResolvedValueOnce([mockEventObject])
        .mockResolvedValueOnce([])

      await client.createEvent(mockCalendar.url, mockEventObject.data, 'event-1.ics')

      // Should NOT fetch calendars again
      expect(mockClientMethods.fetchCalendars).not.toHaveBeenCalled()
    })
  })

  describe('network timeout (Bug 13)', () => {
    it('abort controller is used in proxy fetch path', async () => {
      const proxyClient = new CalDAVClient(
        mockCredentials.serverUrl,
        mockCredentials,
        'https://proxy.example.com'
      )

      // Spy on global fetch to verify AbortController is passed
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status: 200 })
      )

      await proxyClient.connect()

      // Verify createDAVClient was called with a custom fetch function
      expect(mockCreateDAVClient).toHaveBeenCalledWith(
        expect.objectContaining({
          fetch: expect.any(Function),
        })
      )

      // Extract the custom fetch function and invoke it to test timeout
      const customFetch = mockCreateDAVClient.mock.calls[0][0].fetch
      await customFetch('https://caldav.example.com/dav.php')

      // Verify fetch was called with a signal (from AbortController)
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      )

      fetchSpy.mockRestore()
    })
  })

  describe('buildProxyUrl', () => {
    it('encodes the target URL', () => {
      const result = buildProxyUrl('https://proxy.example.com', 'https://caldav.example.com/dav')
      expect(result).toBe(
        `https://proxy.example.com/${encodeURIComponent('https://caldav.example.com/dav')}`
      )
    })

    it('strips trailing slash from proxy base', () => {
      const result = buildProxyUrl('https://proxy.example.com/', 'https://target.com')
      expect(result).toBe(`https://proxy.example.com/${encodeURIComponent('https://target.com')}`)
    })
  })
})
