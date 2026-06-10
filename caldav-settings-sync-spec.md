# CalDAV Settings Sync — Feature Spec

## Overview

An optional, opt-in feature that syncs Calino UI settings to a dedicated calendar on the user's primary CalDAV account. Settings are automatically restored on any device that connects to the same account — no separate login, no central server.

The feature is entirely additive. No existing functionality is affected.

---

## Settings Scope

The payload is the existing settings export JSON. It contains UI preferences only.

**Synced:**
- Theme (light / dark / system)
- Event density (comfortable / compact)
- First day of week
- Time format (12h / 24h)
- Default view (month / week / day / agenda)
- Show/hide week numbers
- Show/hide completed tasks
- Calendar colors
- Categories
- Notification preferences

**Not synced:**
- CalDAV account credentials
- Sync config (`primaryAccountId`, `etag`, `lastModified`)

---

## CalDAV Storage Structure

### Calendar collection

A dedicated calendar collection is created on the primary CalDAV server:

- **Display name:** `Calino Settings`
- **Internal name:** `calino-settings`
- **Marked with WebDAV dead property:** `X-CALINO-SETTINGS-CALENDAR: 1` (set via `PROPPATCH`)
- Filtered from the Calino UI during `PROPFIND` — never appears in the sidebar

### Settings VEVENT

A single `VEVENT` with a fixed, hardcoded UUID lives inside the collection:

```
BEGIN:VEVENT
UID:00000000-calino-0000-calino-000000000000
SUMMARY:Calino Settings
DTSTART:19700101T000000Z
DTEND:19700101T000001Z
TRANSP:TRANSPARENT
CLASS:PRIVATE
DTSTAMP:<last write timestamp>
X-CALINO-VERSION:1
ATTACH;ENCODING=BASE64;FMTTYPE=application/json:<base64 settings JSON>
END:VEVENT
```

- `DTSTART` at Unix epoch keeps the event out of every real calendar view
- `TRANSP:TRANSPARENT` — never blocks time
- `CLASS:PRIVATE` — hidden in shared calendar contexts
- `DTSTAMP` — used for conflict resolution (most recent wins)
- `X-CALINO-VERSION` — used for migration; flat property, not part of the settings JSON
- `ATTACH` with inline base64 — avoids iCalendar 75-octet line folding issues on long JSON

---

## localStorage Sync Keys

```json
{
  "calino.settingsSync.primaryAccountId": "abc123",
  "calino.settingsSync.etag": "\"abc-def-123\"",
  "calino.settingsSync.lastModified": 1749456000000
}
```

**`primaryAccountId` is the source of truth for whether sync is active.** There is no separate `enabled` flag. If `primaryAccountId` is set, sync is on. If absent, sync is off. It is written only during discovery or the manual enable flow, and cleared on disable.

`lastModified` is updated whenever local settings change. Used for conflict resolution on startup.

---

## Discovery — On Every Account Add

Every time an account is added and authenticated, regardless of sync state, Calino silently checks for a Calino Settings calendar:

```
Account added + authenticated
  ↓
PROPFIND → list calendars, check for X-CALINO-SETTINGS-CALENDAR: 1
  ↓
Not found → nothing happens
  ↓
Found:
  primaryAccountId already set → note discovery silently, no action
  primaryAccountId not set →
    1. Fetch settings VEVENT from discovered calendar
    2. Resolve conflict (see Conflict Resolution)
    3. Merge winning settings into Zustand
    4. Set primaryAccountId to this account
    5. Store etag + lastModified
    6. Show non-intrusive notification:
       "Calino Settings found on [account URL] — sync enabled automatically."
```

### Multiple accounts discovered with settings

If more than one added account has a calino-settings calendar, **most recent DTSTAMP wins**. That account becomes primary. Others are ignored silently.

---

## Startup Sequence

```
App loads
  ↓
primaryAccountId in localStorage?
  ↓
No → normal startup, load settings from localStorage, done
  ↓
Yes →
  1. Connect to primary CalDAV account
  2. PROPFIND → find calino-settings calendar
     Not found → show modal (see External Deletion)
  3. REPORT with UID filter → fetch settings VEVENT
  4. Resolve conflict (see Conflict Resolution)
  5. Merge winning settings into Zustand
  6. Render app
```

**If CalDAV fetch fails on startup** (server unreachable, timeout):
- Fall back to localStorage silently
- Show a small sync warning indicator
- Do not block the app

---

## Conflict Resolution

Applies on startup and on enable when existing settings are found.

```
Compare DTSTAMP (CalDAV) vs lastModified (localStorage)
  ↓
CalDAV more recent → use CalDAV settings, update localStorage
  ↓
Local more recent → use local settings, write to CalDAV
  ↓
Equal → use either, no action needed
```

---

## Write Flow

Triggered by any settings change while `primaryAccountId` is set.

```
Settings change
  ↓
Update lastModified to now
  ↓
Debounce 2s
  ↓
Serialize Zustand settings slice to JSON
  ↓
Base64 encode
  ↓
Update DTSTAMP to now
  ↓
PUT with If-Match: <stored etag>
  ↓
Success → store new etag
  ↓
ETag mismatch (412) → fetch latest, resolve conflict, re-PUT
```

---

## Enable Flow (Manual)

Triggered by the user clicking **Enable** in settings. Ends identically to auto-discovery — `primaryAccountId` is written, sync begins.

### Single account

Skip account selection, go straight to confirmation.

### Multiple accounts

Show an account picker. Each entry displays:
- Account URL
- Status badge: **Settings found** or **No settings**

Status is pre-populated from discovery results — no additional network calls at this point.

### Confirmation dialog

> "This will create a **Calino Settings** calendar on **[selected account URL]**.
> It will be hidden from your calendar view and used to sync your settings across devices."
>
> [Cancel] [Confirm]

### On confirm

```
hasSettingsCalendar = true (existing settings found):
  1. Fetch + load settings VEVENT
  2. Resolve conflict
  3. Write merged settings back if local won
  4. Set primaryAccountId, store etag + lastModified

hasSettingsCalendar = false (fresh setup):
  1. MKCALENDAR → create calino-settings collection
  2. PROPPATCH → set X-CALINO-SETTINGS-CALENDAR: 1
  3. PUT → write initial settings VEVENT
  4. Set primaryAccountId, store etag + lastModified
```

If any step fails, roll back cleanly. Do not leave a half-created calendar. Show an error message.

---

## Disable Flow

User toggles sync off in settings.

```
Show prompt:
"Also delete the Calino Settings calendar from your server?"
[Keep it] [Delete it]
  ↓
Keep → clear primaryAccountId, etag, lastModified from localStorage
Delete → DELETE calendar collection, clear sync keys from localStorage
```

Either way, sync stops immediately.

---

## Edge Cases

### External deletion of calino-settings calendar

Detected during startup `PROPFIND` when `primaryAccountId` is set but the calendar is not found.

Show modal:
> "CalDAV Settings Sync is enabled, but no Calino Settings calendar was detected on [account URL].
> It may have been deleted externally."
>
> [Disable Sync] [Recreate Calendar]

- **Disable Sync** → clears sync keys, continues with localStorage settings
- **Recreate Calendar** → runs the fresh setup path (MKCALENDAR + initial PUT)

### Primary account removed

If the user deletes the account currently set as primary:

```
Show prompt:
"This account is used for CalDAV Settings Sync. Remove it anyway?"
  ↓
[Cancel] [Remove + Disable Sync] [Remove + Choose New Primary]
```

- **Remove + Disable Sync** → removes account, clears sync keys
- **Remove + Choose New Primary** → removes account, opens account picker filtered to remaining accounts, with discovery results shown

---

## Version Migration

`X-CALINO-VERSION` is a flat property on the VEVENT, separate from the settings JSON.

On read, Calino checks the version before parsing:

```
version === current → parse normally
version < current  → run migration pipeline, write upgraded settings back
version > current  → show warning:
                     "Settings were saved by a newer version of Calino.
                      Some preferences may not be applied."
```

Migration functions are defined as a keyed map applied sequentially:

```typescript
const migrations: Record<number, (settings: unknown) => unknown> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
}
```

---

## UI Components

| Component | Description |
|---|---|
| Settings section | Collapsed section in settings panel, clearly labelled Optional |
| Enable button | Opens account picker (if multiple accounts) or confirmation directly |
| Account picker | Lists accounts with Settings found / No settings badges |
| Confirmation dialog | Explains what will be created, requires explicit confirm |
| Auto-enable notification | Non-intrusive toast: "Calino Settings found on [URL] — sync enabled automatically." |
| Sync status indicator | Small indicator in settings showing last synced time or error state |
| External deletion modal | Blocking modal with Disable Sync / Recreate Calendar options |
| Primary account removal prompt | Shown when deleting the primary account while sync is active |
| Disable prompt | Asks whether to keep or delete the calendar on the server |

---

## What Does Not Change

- Calendar rendering
- Event sync logic
- VTODO support
- Account management (add / remove / edit)
- Existing localStorage settings structure
- Export / import settings flow

The sync layer sits entirely behind the existing Zustand settings slice. The rest of the app is unaware of it.
