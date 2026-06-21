# CalDAV Calendar Color Support — Spec

**Status:** Draft
**Date:** 2026-06-20

## Problem

Calino hardcodes all calendar colors to `#4285F4` during fetch, ignoring server-provided colors. The existing PROPPATCH code uses the wrong XML namespace. Users see uniform blue calendars regardless of what color they set in Apple Calendar, Nextcloud, or other clients.

## Goals

1. Read calendar colors from Apple (`calendar-color`) and RFC 7986 (`COLOR`) sources
2. Write calendar colors via Apple's `calendar-color` (broadest server support)
3. Round-trip correctly: set color in Calino → appears correctly in Apple Calendar/Nextcloud → syncs back
4. Gracefully handle servers that don't support color properties

## Non-Goals

- Per-event colors (separate feature, RFC 7986 supports it but low server adoption)
- Calendar ordering (`calendar-order`)
- Category colors (local-only concept)

---

## Properties

### Apple `calendar-color`

- **Namespace:** `http://apple.com/ns/ical/`
- **Element:** `<I:calendar-color xmlns:I="http://apple.com/ns/ical/">`
- **Format:** CSS hex color, e.g. `#2952A3` or `#FF5722FF` (with optional alpha)
- **Also supports:** `symbolic-color` attribute with predefined names (`Tangerine`, `Blue`, `Green`, `Seafoam`, etc.)
- **Location:** WebDAV property on calendar collection
- **Set via:** PROPPATCH
- **Read via:** PROPFIND
- **Supported by:** iCloud, Nextcloud, Sabre/dav, Cyrus, Radicale, Baikal

### RFC 7986 `COLOR`

- **Namespace:** `urn:ietf:params:xml:ns:icalendar` (IANA)
- **Element:** `<C:COLOR xmlns:C="urn:ietf:params:xml:ns:icalendar">`
- **Format:** CSS color name or hex, e.g. `turquoise` or `#FF0000`
- **Location:** iCalendar property inside VCALENDAR, OR WebDAV property on calendar collection
- **Set via:** PROPPATCH (as WebDAV property) or embedded in .ics data
- **Read via:** PROPFIND or calendar data parsing
- **Supported by:** Nextcloud, Sabre/dav, Cyrus, Radicale
- **NOT supported by:** Apple iCloud

---

## Read Strategy

When fetching calendars, parse color from the PROPFIND response:

```
1. Check for RFC 7986 COLOR (urn:ietf:params:xml:ns:icalendar:COLOR)
2. Check for Apple calendar-color (http://apple.com/ns/ical/:calendar-color)
3. Fall back to default color (#4285F4)
```

**Priority:** RFC 7986 > Apple > default

**Why this priority:** RFC 7986 is the standard. If a server returns both, the RFC value should win. In practice, Apple servers only return Apple's, and Nextcloud/Sabre return both (Apple first, RFC 7986 as `COLOR`).

### tsdav behavior

tsdav's `fetchCalendars()` already fetches `calendarColor` by default (Apple namespace). The property is available on the returned `DAVCalendar` object as `calendarColor`. For RFC 7986 `COLOR`, we need to add it to the PROPFIND request props.

---

## Write Strategy

When user changes calendar color, send PROPPATCH with **both** properties for maximum compatibility:

### Apple `calendar-color` (for iCloud/Apple compatibility)

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<propertyupdate xmlns="DAV:">
  <set>
    <prop>
      <ICAL:calendar-color xmlns:ICAL="http://apple.com/ns/ical/">#FF5722</ICAL:calendar-color>
    </prop>
  </set>
</propertyupdate>
```

### RFC 7986 `COLOR` (for Nextcloud/Sabre compatibility)

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<propertyupdate xmlns="DAV:">
  <set>
    <prop>
      <ICAL:COLOR xmlns:ICAL="urn:ietf:params:xml:ns:icalendar">#FF5722</ICAL:COLOR>
    </prop>
  </set>
</propertyupdate>
```

### Combined PROPPATCH (single request)

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<propertyupdate xmlns="DAV:">
  <set>
    <prop>
      <ICAL:calendar-color xmlns:ICAL="http://apple.com/ns/ical/">#FF5722</ICAL:calendar-color>
      <ICAL:COLOR xmlns:ICAL="urn:ietf:params:xml:ns:icalendar">#FF5722</ICAL:COLOR>
    </prop>
  </set>
</propertyupdate>
```

**Note:** Send both in a single PROPPATCH. Servers that don't support a property will ignore it (HTTP 207 with error for that specific property, but overall success).

---

## Color Normalization

Apple servers sometimes return colors with alpha: `#FF5722FF`. Calino should normalize:

1. Strip alpha suffix if present (8-char hex → 6-char hex)
2. Ensure `#` prefix
3. Validate it's a valid hex color
4. Fall back to default if invalid

```typescript
function normalizeColor(color: string | null | undefined): string {
  if (!color) return DEFAULT_COLOR
  let c = color.trim()
  // Strip alpha channel (e.g. #FF5722FF → #FF5722)
  if (/^#[0-9A-Fa-f]{8}$/.test(c)) {
    c = c.slice(0, 7)
  }
  // Validate
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c.toUpperCase()
  if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
    // Expand shorthand: #F52 → #FF5522
    return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toUpperCase()
  }
  return DEFAULT_COLOR
}
```

---

## Changes Required

### 1. `src/features/caldav/client/CalDAVClient.ts`

**`fetchCalendars()`** — Read color from tsdav response instead of hardcoding:

```typescript
// Before:
color: '#4285F4',

// After:
color: normalizeColor(cal.calendarColor),
```

**`createCalendar()`** — Fix namespace (currently uses CALDAV namespace, should use Apple):

```xml
<!-- Before (wrong namespace) -->
<C:calendar-color xmlns:C="urn:ietf:params:xml:ns:caldav">

<!-- After (Apple namespace for max compat) -->
<ICAL:calendar-color xmlns:ICAL="http://apple.com/ns/ical/">
```

**`updateCalendar()`** — Send both Apple and RFC 7986 properties:

```xml
<!-- Send both in single PROPPATCH -->
<ICAL:calendar-color xmlns:ICAL="http://apple.com/ns/ical/">#FF5722</ICAL:calendar-color>
<ICAL:COLOR xmlns:ICAL="urn:ietf:params:xml:ns:icalendar">#FF5722</ICAL:COLOR>
```

### 2. `src/features/caldav/client/CalDAVClient.ts` (new helper)

Add `normalizeColor()` function.

### 3. `src/features/caldav/hooks/useCalDAV.ts`

**`addAccount()`** — Already uses `cal.color` from `fetchCalendars()` result. Once `fetchCalendars()` reads the real color, this automatically works.

**`syncCalendars()`** — When doing incremental sync, re-fetch calendar list and update colors if changed on server.

### 4. `src/features/caldav/sync/syncEngine.ts`

No changes needed — syncEngine only deals with events, not calendar metadata.

### 5. Tests

- `CalDAVClient.test.ts`: Mock PROPFIND responses with `calendarColor` property, verify normalization
- `CalDAVClient.test.ts`: Verify PROPPATCH XML contains both Apple and RFC 7986 properties
- `useCalDAV.test.ts`: Verify calendar color flows through to store

---

## Edge Cases

1. **Server returns no color:** Use default `#4285F4`
2. **Server returns invalid color:** Use default `#4285F4`
3. **Server returns alpha hex (`#RRGGBBAA`):** Strip alpha, use `#RRGGBB`
4. **Apple server ignores RFC 7986 COLOR:** Fine — Apple reads its own `calendar-color`
5. **Nextcloud ignores Apple `calendar-color`:** Doesn't happen — Nextcloud supports both
6. **Google CalDAV:** Returns no color — use default (unchanged behavior)
7. **Offline:** Color changes queue in pendingChanges, applied on next sync

---

## Server Compatibility Matrix

| Server | Read Apple `calendar-color` | Read RFC 7986 `COLOR` | Write Apple | Write RFC 7986 |
|--------|---------------------------|----------------------|-------------|---------------|
| iCloud | ✅ | ❌ | ✅ | ❌ |
| Nextcloud | ✅ | ✅ | ✅ | ✅ |
| Sabre/dav | ✅ | ✅ | ✅ | ✅ |
| Cyrus | ✅ | ✅ | ✅ | ✅ |
| Radicale | ✅ | ✅ | ✅ | ✅ |
| Baikal | ✅ | ✅ | ✅ | ✅ |
| Google | ❌ | ❌ | ❌ | ❌ |

---

## Implementation Order

1. Add `normalizeColor()` helper
2. Fix `fetchCalendars()` to read `cal.calendarColor`
3. Fix `createCalendar()` namespace
4. Fix `updateCalendar()` to send both properties
5. Add/update tests
6. Manual testing with Davis + proxy
