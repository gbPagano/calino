# CardDAV CRUD Implementation Plan

## Current state

**What works:**
- Basic read via tsdav `fetchVCards` (all contacts + by URL)
- Basic create/update/delete via tsdav `createCalendarObject`/`updateCalendarObject`/`deleteCalendarObject`
- ctag-based incremental sync (skip unchanged address books)
- Client caching per account
- Offline change queue with replay

**What's broken or missing (from the reference):**

| Gap | Severity | Why |
|---|---|---|
| No opaque-property round-trip | **Critical** | Any edit silently drops `X-AB*`, `itemN.*`, unknown extensions — corrupts Apple/Google contacts |
| Always writes vCard 4.0 | **High** | iCloud prefers 3.0; `supported-address-data` is never checked |
| No line folding | **High** | Violates RFC 6350 §3.2; some servers reject unfolded cards |
| No RFC 6868 caret-encoding | **Medium** | Breaks `ADR;LABEL=` round-trip on Apple contacts |
| `createCalendarObject` for creates | **Medium** | Wrong tsdav API — should be raw `PUT` with `If-None-Match: *` |
| `updateCalendarObject` for updates | **Medium** | Wrong tsdav API — should be raw `PUT` with `If-Match` |
| No `If-Match` on delete | **Medium** | Can delete a contact someone else changed |
| No service discovery | **Medium** | Relies on tsdav's built-in discovery; no `.well-known` fallback, no periodic re-resolution |
| No `sync-collection` REPORT | **Medium** | Only ctag+multiget fallback; less efficient, more throttling risk |
| No `supported-address-data` read | **Low** | Can't know if 3.0 or 4.0 is accepted |
| No `max-resource-size` check | **Low** | Large photos will get 507 with no client-side guard |
| No `current-user-privilege-set` | **Low** | Can't warn user before attempting a write they don't have permission for |
| No `PRODID` / `REV` on write | **Low** | Missing best-practice metadata |

---

## Phase 1: Parser & Serializer hardening

**Goal:** Survive a parse→reserialize round-trip without losing anything. This must be done before any write reaches a real server.

### 1a. Add `opaqueLines` to Contact type

**File:** `src/features/carddav/types/index.ts`

Add to `Contact`:
```ts
opaqueLines: string[] // raw vCard lines not mapped to a typed field
```

This stores everything the parser doesn't understand: `X-AB*`, `X-ADDRESSBOOKSERVER-*`, `itemN.*` groups, unknown `X-*` extensions, `CLIENTPIDMAP`, `PRODID` (when not authored by us), etc.

### 1b. Parser: collect unknown lines

**File:** `src/features/carddav/adapter/vCardAdapter.ts` — `parseVCard()`

After extracting all known properties, iterate remaining lines. A line is "known" if it matches one of: `BEGIN`, `END`, `VERSION`, `FN`, `N`, `UID`, `URL`, `ORG`, `TITLE`, `ROLE`, `EMAIL`, `TEL`, `ADR`, `IMPP`, `BDAY`, `ANNIVERSARY`, `GENDER`, `NOTE`, `CATEGORIES`, `PHOTO`, `CREATED`, `REV`, `PRODID`. Everything else goes into `opaqueLines` verbatim (including the group prefix if any).

### 1c. Parser: handle `itemN.` grouped properties

**File:** `src/features/carddav/adapter/vCardAdapter.ts`

Before the unknown-line pass, scan for `itemN.X-ABLabel` lines. For each, find the matching `itemN.TEL`/`itemN.EMAIL`/etc. line. Use the `X-ABLabel` value to set a more specific type on the matching field (e.g. `_$!<Mobile>!$_` → `cell`). Preserve both lines in `opaqueLines` regardless, so they round-trip.

### 1d. Parser: RFC 6868 caret-encoding

**File:** `src/features/carddav/adapter/vCardAdapter.ts`

Add `decodeCaretEncoding(s: string): string` — replaces `^n` → newline, `^^` → `^`, `^'` → `"`. Apply to parameter values only (not property values). Add the inverse `encodeCaretEncoding()` for the serializer.

### 1e. Parser: lenient line unfolding

**File:** `src/features/carddav/adapter/vCardAdapter.ts` — `unfoldVCard()`

Current implementation: `vCard.replace(/\r?\n[ \t]/g, '')` — this is correct but should also handle off-by-one fold points and mid-UTF-8 folds defensively. Add a comment documenting the leniency requirement; the current regex is actually fine for real-world data.

### 1f. Parser: derive fallback `FN`

**File:** `src/features/carddav/adapter/vCardAdapter.ts` — `parseVCard()`

If `FN` is empty or missing, derive from `N` (givenName + familyName) or `ORG` rather than returning `'Unknown'`. Only fall back to `'Unknown'` if both `N` and `ORG` are empty.

### 1g. Serializer: emit opaque lines

**File:** `src/features/carddav/adapter/vCardAdapter.ts` — `contactToVCard()`

After writing all known properties, emit each line from `contact.opaqueLines` verbatim. Position: after known properties, before `END:VCARD`.

### 1h. Serializer: version-aware output

**File:** `src/features/carddav/adapter/vCardAdapter.ts` — `contactToVCard()`

Add a `targetVersion: '3.0' | '4.0'` parameter (default `'4.0'`). When `'3.0'`:
- Write `VERSION:3.0`
- Write `PHOTO;ENCODING=b;TYPE=JPEG:<base64>` instead of `PHOTO:data:...`
- Write `TYPE=pref` instead of `PREF=1`
- Write `TYPE=HOME,VOICE` (comma-joined) instead of separate `TYPE=HOME;TYPE=VOICE`

### 1i. Serializer: line folding

**File:** `src/features/carddav/adapter/vCardAdapter.ts`

Add `foldLine(line: string): string` — split at 75 octets (not characters — must count UTF-8 bytes), continuation lines start with a single space. Apply to every output line.

### 1j. Serializer: `REV` and `PRODID`

**File:** `src/features/carddav/adapter/vCardAdapter.ts` — `contactToVCard()`

- Always set `REV` to current UTC `YYYYMMDDTHHMMSSZ`
- Set `PRODID` to `-//Calino//Calino 0.15//EN` (or read from `package.json`)
- If the original card had a `PRODID` and we're only doing a minor edit, preserve the original in `opaqueLines` and don't overwrite it

### 1k. Serializer: escape property values

**File:** `src/features/carddav/adapter/vCardAdapter.ts`

Current `escapeVCardValue` handles `\`, `;`, `,`, `\n`. Verify this is correct per RFC 6350 §3.4. Add unescaping to the parser for the same set.

---

## Phase 2: Write path (PUT with precondition headers)

**Goal:** Replace tsdav's `createCalendarObject`/`updateCalendarObject` with raw `PUT` using proper `If-Match`/`If-None-Match` headers.

### 2a. Replace `createContact` with raw PUT

**File:** `src/features/carddav/client/CardDAVClient.ts` — `createContact()`

- Generate a filename from the contact's UID: `${contact.id}.vcf`
- Read `supported-address-data` from the address book (cache it on the DAV address book object) to decide 3.0 vs 4.0
- Serialize with `contactToVCard(contact, targetVersion)`
- Check `max-resource-size` before sending
- `PUT` to `${addressBook.url}/${filename}` with:
  - `Content-Type: text/vcard; charset=utf-8`
  - `If-None-Match: *` (prevents overwrite of existing)
  - `Authorization` header
- On 412: throw a specific `ConflictError` (contact already exists)
- On 415: retry once with the other vCard version
- On 507: throw with "contact too large" message
- Return `{ url, etag }` from response headers

### 2b. Replace `updateContact` with raw PUT

**File:** `src/features/carddav/client/CardDAVClient.ts` — `updateContact()`

- Same serialization logic as create
- `PUT` to `contactUrl` with:
  - `Content-Type: text/vcard; charset=utf-8`
  - `If-Match: "${etag}"` (prevents lost-update)
  - `Authorization` header
- On 412: refetch the contact from server, surface conflict (for now, server wins — log warning, update local)
- On 415: retry once with other version
- Return `{ url, etag }` from response

### 2c. Add `If-Match` to `deleteContact`

**File:** `src/features/carddav/client/CardDAVClient.ts` — `deleteContact()`

- `DELETE` to `contactUrl` with `If-Match: "${etag}"`
- On 412: refetch, if 404 then contact already deleted (remove from local), else surface conflict

### 2d. Custom error classes

**File:** `src/features/carddav/client/errors.ts`

```ts
class CardDAVConflictError extends Error { currentEtag: string; serverData?: string }
class CardDAVPermissionError extends Error { }
class CardDAVSizeLimitError extends Error { maxSize: number }
```

---

## Phase 3: Sync improvements

**Goal:** `sync-collection` as primary, ctag+multiget as fallback.

### 3a. Implement `sync-collection` REPORT

**File:** `src/features/carddav/client/CardDAVClient.ts`

New method `syncCollection(addressBook, syncToken)`:
- Send `REPORT` with `sync-collection` XML body containing the stored `sync-token`
- Parse multistatus response: each `D:response` is either a changed/added href (with new etag) or a removed href (404 status)
- Return `{ changes: { url, etag, status }[], newSyncToken }`
- On 507/400 (token invalidation): return `{ tokenInvalidated: true }` so caller can fall back to full resync

### 3b. Implement `addressbook-multiget` REPORT

**File:** `src/features/carddav/client/CardDAVClient.ts`

New method `fetchContactsByUrls(addressBook, urls)`:
- Send `REPORT` with `addressbook-multiget` XML body listing the hrefs
- Parse multistatus: each 200 response has `address-data` with the vCard
- More efficient than individual GETs for batch fetches

### 3c. Integrate `sync-collection` into sync flow

**File:** `src/features/carddav/hooks/useCardDAV.ts`

In `syncAccount`:
1. If address book has a stored `syncToken`, try `syncCollection`
2. On success: fetch only changed contacts (via multiget), update local, store new token
3. On token invalidation: fall back to ctag + full multiget
4. On first sync (no token): do full fetch, store the initial `syncToken`

### 3d. Store sync tokens

**File:** `src/store/contactStore.ts`

`AddressBook` already has `syncToken`. Ensure it's persisted and updated after each sync. The hook already does this for `ctag`; extend to `syncToken`.

---

## Phase 4: Service discovery

**Goal:** Proper `.well-known` → principal → home-set → collections flow.

### 4a. Implement discovery chain

**File:** `src/features/carddav/client/CardDAVClient.ts`

New method `discover()`:
1. `GET` or `PROPFIND` `/.well-known/carddav` — follow 301/302 redirect
2. `PROPFIND` (Depth: 0) for `current-user-principal`
3. `PROPFIND` (Depth: 0) on principal for `addressbook-home-set`
4. `PROPFIND` (Depth: 1) on home-set for collections with `resourcetype` containing `addressbook`

### 4b. Read collection metadata

**File:** `src/features/carddav/client/CardDAVClient.ts`

Enhance `fetchAddressBooks()` to also request:
- `supported-address-data` — cache on CardDAVClient instance
- `max-resource-size` — cache on CardDAVClient instance
- `current-user-privilege-set` — cache on CardDAVClient instance

### 4c. Cache and periodically re-resolve

**File:** `src/features/carddav/client/CardDAVClient.ts`

- Cache the well-known redirect target
- Re-resolve every 2–4 weeks (per RFC 6764)
- Store resolution timestamp alongside the cached target

---

## Phase 5: Error handling & edge cases

### 5a. Retry with backoff

**File:** `src/features/carddav/client/CardDAVClient.ts`

Add `withRetry(fn, maxRetries=3)` wrapper with exponential backoff. Respect `Retry-After` header if present. Apply to all server calls.

### 5b. 207 Multi-Status parsing

**File:** `src/features/carddav/client/CardDAVClient.ts`

Add `parseMultiStatus(text)` helper that parses each `D:response` independently, extracting per-resource status codes. Don't assume uniform success from a 207 envelope.

### 5c. Extend `AddressBook` type

**File:** `src/features/carddav/types/index.ts`

Already added:
```ts
supportedVersions?: ('3.0' | '4.0')[]
maxResourceSize?: number | null
canWrite?: boolean
```

---

## Deferred

- **vCard 2.1 read-only support** — Samsung/old Outlook exports. Can be added later as a parser-only enhancement.
- **Contact groups** — `isGroup` and `memberUids` fields added to type; `X-ADDRESSBOOKSERVER-KIND`/`MEMBER` read/write deferred.
- **Google OAuth 2.0** — Current auth model works for Basic auth servers. Google's OAuth bearer token support is a separate feature.
- **`addressbook-query` REPORT** — Server-side filtered search. Nice-to-have for large address books.

---

## Execution order

```
Phase 1 (parser/serializer) ─── no dependencies, start here
    │
    ├── 1a: opaqueLines type field
    ├── 1b-1f: parser improvements
    ├── 1g-1k: serializer improvements
    │
Phase 2 (write path) ─── depends on 1g (version-aware serialization)
    │
    ├── 2a: create via PUT
    ├── 2b: update via PUT
    ├── 2c: delete with If-Match
    ├── 2d: error classes
    │
Phase 3 (sync) ─── depends on 2 (write path for conflict handling)
    │
    ├── 3a: sync-collection REPORT
    ├── 3b: addressbook-multiget REPORT
    ├── 3c: integrate into sync flow
    ├── 3d: store sync tokens
    │
Phase 4 (discovery) ─── can run parallel with Phase 3
    │
    ├── 4a: discovery chain
    ├── 4b: collection metadata
    ├── 4c: cache + periodic re-resolve
    │
Phase 5 (error handling) ─── can run parallel with Phase 3-4
    │
    ├── 5a: retry with backoff
    ├── 5b: 207 parser
    ├── 5c: AddressBook type extension
```

## Decisions

- **tsdav raw fetch access:** Use `this.proxyFetch` directly for `PUT`/`REPORT` since tsdav doesn't expose raw PUT with custom headers. The `createDAVClient` returns a client we use for discovery/multiget, but writes go through raw fetch.
- **`supported-address-data` caching:** Cache on `CardDAVClient` instance (not persisted in store). Populated during `fetchAddressBooks()`.
- **vCard 2.1:** Deferred.
- **Groups:** Type fields (`isGroup`, `memberUids`) added to Contact. Read/write of `X-ADDRESSBOOKSERVER-KIND`/`MEMBER` deferred.
