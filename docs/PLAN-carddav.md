# CardDAV Implementation Plan

## Goal

Read-only CardDAV support with full CRUD preparation. Contacts appear in a separate "Contacts" tab (next to Journal) only when the account has address books.

## Architecture

```
src/features/carddav/
├── types/index.ts          ✅ Contact, AddressBook, sync types
├── adapter/vCardAdapter.ts ✅ Parse/serialize vCard strings
├── client/CardDAVClient.ts ✅ Fetch address books, contacts, CRUD methods
├── hooks/useCardDAV.ts     ✅ React hook for sync state
└── components/
    ├── ContactsView.tsx    ⬜ Main view (3-column layout)
    ├── ContactList.tsx     ⬜ Left panel: contact list with search
    ├── ContactDetail.tsx   ⬜ Right panel: contact details
    └── ContactDetail.module.css

src/store/contactStore.ts   ✅ Zustand store for contacts
src/types/index.ts          🔧 Add 'contacts' to ViewType
src/App.tsx                 🔧 Add /contacts route
src/features/calendar/components/CalendarHeader.tsx  🔧 Add Contacts tab
src/features/settings/components/GeneralSettings.tsx 🔧 Add contactsEnabled toggle
src/features/caldav/hooks/useCalDAV.ts              🔧 Detect address books on addAccount
```

## Data Flow

```
CalDAV Account Added
  → Check if server has address books (CardDAVClient.fetchAddressBooks)
  → If yes: auto-enable contactsEnabled, sync contacts
  → If no: leave contactsEnabled off

Manual Sync (periodic or on-demand)
  → For each account: fetch address books → fetch contacts
  → Merge into contactStore (upsert by id)
  → UI reactively updates

Read-Only (Phase 1)
  → No create/edit/delete UI
  → Client methods exist but not exposed to UI
  → Store has addContact/updateContact/deleteContact for future use
```

## Detection Logic

When `addAccount()` in `useCalDAV.ts` succeeds:
1. Create a `CardDAVClient` with the same credentials
2. Try `client.fetchAddressBooks()`
3. If it returns > 0 address books → set `contactsEnabled: true` in settings
4. If it fails or returns 0 → leave `contactsEnabled` as-is

Also: on app mount, check existing accounts for address books.

## UI Layout (Reference)

```
┌─────────────────────────────────────────────────────┐
│ Header: Brand | Nav | Title | View Tabs | Settings  │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │  ┌──────────┬────────────────────────┐  │
│          │  │ Contacts │  Contact Detail         │  │
│ Calendars│  │ Search   │  ┌──────────────────┐  │  │
│          │  │          │  │ Name             │  │  │
│          │  │ Alice    │  │ Org              │  │  │
│          │  │ Bob   ★  │  │ Email            │  │  │
│          │  │ Charlie  │  │ Phone            │  │  │
│          │  │          │  │ Address          │  │  │
│          │  │          │  │ Notes            │  │  │
│          │  └──────────┴────────────────────────┘  │
└──────────┴──────────────────────────────────────────┘
```

## Settings Integration

- Add `contactsEnabled: boolean` to `UserSettings` (default: `false`)
- Toggle in Settings → General (like Journal)
- When `contactsEnabled` is false, hide the Contacts tab

## Files to Modify

1. `src/types/index.ts` — add `'contacts'` to `ViewType`
2. `src/App.tsx` — add `/contacts` route, import ContactsView
3. `src/features/calendar/components/CalendarHeader.tsx` — add Contacts tab
4. `src/features/settings/components/GeneralSettings.tsx` — add contactsEnabled toggle
5. `src/features/caldav/hooks/useCalDAV.ts` — detect address books on addAccount
6. `src/store/settingsStore.ts` — add contactsEnabled to defaults

## Questions to Resolve

- [ ] Should contacts sync on app mount (like calendars) or only on manual trigger?
- [ ] Should the Contacts tab show a count badge?
- [ ] Mobile layout: single column with back navigation?
