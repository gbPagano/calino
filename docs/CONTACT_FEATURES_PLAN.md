# Contact Features Plan — v0.17.0

Six new features to round out the contacts/CardDAV implementation.

---

## Implementation Order

### 1. Undo Deletes

**New file:** `src/lib/deleteContactWithUndo.ts`

Follow the existing `src/lib/deleteWithUndo.ts` pattern:
- Optimistic local delete
- Queue `delete` pending change for CardDAV sync
- Show toast with 8s undo window
- On undo: re-add contact to store + queue `create` pending change + trigger sync

**Modify:** `src/features/carddav/components/ContactsView.tsx`
- Replace current `handleDelete` logic (keep the two-click confirm, add undo toast after)

**Key reference:** `src/lib/deleteWithUndo.ts` (calendar event undo pattern)

---

### 2. Contact Photos

**Already done (type/parser):**
- `Contact.photo: string | null` — data URI or URL
- vCardAdapter parses `PHOTO;ENCODING=b;TYPE=JPEG:base64` and `PHOTO;VALUE=URI:url`
- serializer outputs both formats

**Needs UI work:**

**Modify:** `src/features/carddav/components/ContactFormFields.tsx`
- Add photo upload section at top of form (before Name block)
- Circular preview area showing current photo or initials
- "Choose photo" button → file input (`accept="image/*"`)
- "Remove photo" button when photo exists
- **Use a standard library for image upload/crop/compress** — NOT homebrewed canvas:
  - Consider: `react-easy-crop` (crop UI), `browser-image-compression` (compress), or `image-blob-resize`
  - Resize to max 300×300px, JPEG quality 0.8
  - Warn if compressed result > 500KB (localStorage limits)
- Store as `data:image/jpeg;base64,...`

**Modify:** `src/features/carddav/components/ContactDetail.tsx`
- Hero avatar already renders `<img src={contact.photo}>` when present
- Add camera icon overlay on hover (edit mode) for quick photo change
- Hidden `<input type="file">` triggered by overlay click

**Already works (no changes needed):**
- Contact list items already render photos as thumbnails
- Hero section already shows photo or initials

**Storage concern:** localStorage ~5MB. Compress uploads to keep under 500KB per photo.

---

### 3. Birthday Reminders

**New file:** `src/lib/birthdayReminders.ts`

```typescript
interface CreateBirthdayEventOptions {
  contactId: string
  contactName: string
  birthday: string  // YYYY-MM-DD
  calendarId: string
}

export function createBirthdayEvent(options: CreateBirthdayEventOptions): CalendarEvent
export function hasBirthdayEvent(contactId: string, events: CalendarEvent[]): boolean
```

- Creates annual recurring all-day event: `🎂 {Name}'s birthday`
- Uses `recurrence: { frequency: 'yearly', interval: 1 }`
- Links back via `url: calino:contact:{contactId}`
- `hasBirthdayEvent()` checks if already added

**Modify:** `src/features/carddav/components/ContactDetail.tsx`
- Add "📅 Add to calendar" button inside birthday card (after age display)
- Change text to "Already on calendar" (disabled) if `hasBirthdayEvent()` returns true
- Props: `onAddBirthdayToCalendar?: () => void`

**Modify:** `src/features/carddav/components/ContactsView.tsx`
- Wire the handler: find default calendar, call `createBirthdayEvent()`, `addEvent()`, show toast with undo

**Reference:** `src/lib/recurrence.ts` has `buildRRuleString()` for recurrence patterns

---

### 4. Better Search

**New file:** `src/features/carddav/lib/contactSearchIndex.ts`

Fuse.js-based search (already a project dependency via `src/features/search/`):

```typescript
import Fuse from 'fuse.js'

const FUSE_OPTIONS = {
  keys: [
    { name: 'displayName', weight: 3 },
    { name: 'nickname', weight: 2 },
    { name: 'organization', weight: 1.5 },
    { name: 'department', weight: 1 },
    { name: 'title', weight: 1 },
    { name: 'note', weight: 0.8 },
    { name: 'emails.value', weight: 2 },
    { name: 'phones.value', weight: 2 },
    { name: 'addresses.city', weight: 1 },
    { name: 'addresses.street', weight: 1 },
    { name: 'categories', weight: 0.5 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
}

export function initializeContactSearchIndex(contacts: Contact[]): void
export function searchContacts(query: string, filters?: { addressBookId?: string; tag?: string }): Contact[]
```

**Phone number special case:** If query is all digits (≥3 chars), also do digit-only match against phone values. Merge with Fuse results, dedup by id.

**Modify:** `src/features/carddav/components/ContactList.tsx`
- Replace current manual `.filter()` chain in `filteredContacts` useMemo
- Call `initializeContactSearchIndex(contacts)` via useEffect when contacts change
- When `searchQuery` is non-empty, use `searchContacts()` instead
- When empty, fall back to existing address-book/tag filter logic

---

### 5. Import/Export

**New file:** `src/features/carddav/lib/vCardFileUtils.ts`

```typescript
export function splitVCards(content: string): string[]
export function parseVCardFile(content: string, addressBookId: string, accountId: string): Contact[]
export function contactsToVCardFile(contacts: Contact[]): string
export function downloadFile(content: string, filename: string, mimeType: string): void
export function readFileAsText(file: File): Promise<string>
```

- `splitVCards()` splits on `BEGIN:VCARD` boundaries
- `parseVCardFile()` calls existing `parseVCard()` for each block
- `contactsToVCardFile()` calls `contactToVCard()` for each contact, joins with `\r\n`

**New file:** `src/features/carddav/components/ImportExportModal.tsx`

Import preview modal (uses existing `Modal.tsx`):
- Table/list of parsed contacts with checkboxes
- Dedup detection: for each parsed contact, check if same email/phone/name+org exists in store
- Show "Duplicate" badge next to matching contacts
- "Select All" / "Deselect All" / "Skip Duplicates" buttons
- Progress bar for large imports (>50 contacts)
- On confirm: `addContact()` + `addPendingChange({ type: 'create' })` for each

**Modify:** `src/features/carddav/components/ContactList.tsx`
- Add "Import" and "Export" buttons in meta bar (next to "+ New")
- Export: calls `contactsToVCardFile()` + `downloadFile()` for visible/selected contacts
- Import: opens file picker (`accept=".vcf,text/vcard"`), parses, opens ImportExportModal

---

### 6. Merge Duplicates

**New file:** `src/features/carddav/lib/mergeContacts.ts`

```typescript
interface DuplicateGroup {
  contacts: Contact[]
  reason: string       // e.g. "Same email: john@example.com"
  confidence: 'high' | 'medium' | 'low'
}

export function findDuplicateGroups(contacts: Contact[]): DuplicateGroup[]
export function mergeContacts(primary: Contact, secondary: Contact): Contact
```

**Duplicate detection (Union-Find):**
1. **High confidence:** Same email (case-insensitive), same phone (digits-only)
2. **Medium:** Same displayName + same organization
3. **Low:** Same displayName only

**Merge strategy:**
- Primary contact keeps its `id`, `url`, `etag` (server record)
- Union arrays (emails, phones, addresses, urls, ims, langs, related), dedup by value
- Preserve primary's `isPrimary` flags
- If primary has no photo but secondary does, use secondary's photo
- Scalar fields: prefer primary, fall back to secondary if empty
- Secondary is deleted after merge

**New file:** `src/features/carddav/components/MergeDuplicatesModal.tsx`

- On open: run `findDuplicateGroups()`, display results
- Each group: contact avatars side by side, highlighted matching fields
- "Merge" button per group → `mergeContacts(primary, secondary)` + queue delete for secondary
- "Skip" button to dismiss
- Toast with undo: "Merged contacts" → undo restores secondary

**Modify:** `src/store/contactStore.ts`
- Add `mergeContacts(primaryId, secondaryId)` action
- Bump persist version to v3

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/lib/deleteContactWithUndo.ts` | Undo pattern for contact deletes |
| `src/lib/birthdayReminders.ts` | Create recurring birthday events |
| `src/features/carddav/lib/vCardFileUtils.ts` | .vcf file parsing/generation |
| `src/features/carddav/lib/contactSearchIndex.ts` | Fuse.js search index for contacts |
| `src/features/carddav/lib/mergeContacts.ts` | Duplicate detection and merge logic |
| `src/features/carddav/components/ImportExportModal.tsx` | Import preview/confirmation modal |
| `src/features/carddav/components/MergeDuplicatesModal.tsx` | Merge duplicates review UI |

## Modified Files Summary

| File | Changes |
|------|---------|
| `src/features/carddav/components/ContactFormFields.tsx` | Photo upload section (use standard library for crop/compress) |
| `src/features/carddav/components/ContactDetail.tsx` | "Add to calendar" button in birthday card, photo overlay |
| `src/features/carddav/components/ContactList.tsx` | Fuse.js search, import/export buttons |
| `src/features/carddav/components/ContactsView.tsx` | Wire all features, undo delete, birthday handler |
| `src/store/contactStore.ts` | `mergeContacts` action, persist v3 |
