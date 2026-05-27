# Comprehensive Bug Compilation — Dual-Benchmark Analysis

**Generated:** 2026-05-27
**Source:** Coding Model Benchmark + Calino Code Understanding Benchmark
**Models Tested:** MiMo V2.5 Pro, MiMo V2.5, DeepSeek V4 Pro, DeepSeek V4 Flash, MiniMax M2.7

---

## Part 1: Coding Benchmark — Debug Tasks

These are **real bugs** from the user's actual projects, seeded into the benchmark as debug tasks.
Models had to identify and fix the buggy code.

---

### Task 5: Binary Search Fix

#### Buggy Code (Provided to Models)
```javascript
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    let mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid;       // ← BUG: should be 'lo = mid + 1'
    else hi = mid;
  }
  return -1;
}
```

#### 🐛 Bug Description

| Bug ID | Severity | Description |
|--------|----------|-------------|
| **T5-B1** | 🔴 Critical | **Infinite loop due to `lo = mid` instead of `lo = mid + 1`** — When `arr[mid] < target`, setting `lo = mid` without incrementing means the search range never shrinks when `lo` and `mid` point to the same element. This causes an infinite loop when the target is greater than the last element or when the remaining range is size 1. |

#### Correct Fix
```javascript
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    let mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;   // ← FIXED: increment mid
    else hi = mid;
  }
  return -1;
}
```

#### Model Performance

| Model | Score | Result | Notes |
|-------|-------|--------|-------|
| MiMo V2.5 Pro | ✅ 100% | 12/12 passed | Correct fix applied |
| MiMo V2.5 | ✅ 100% | 12/12 passed | Correct fix applied |
| DeepSeek V4 Pro | ✅ 100% | 12/12 passed | Correct fix applied |
| DeepSeek V4 Flash | ✅ 100% | 12/12 passed | Alternative fix: changed to `lo <= hi` with `hi = arr.length - 1` and `hi = mid - 1` |
| MiniMax M2.7 | ⚠️ 75% | 9/12 passed | Also used `lo = mid` (partial fix — changed bounds but not the core bug) |

#### MiniMax M2.7's Partial Fix (75%)
```javascript
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;        // Changed: arr.length → arr.length - 1
  while (lo < hi) {                         // Still using lo < hi
    let mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;   // Fixed this line
    else hi = mid - 1;                      // Changed: mid → mid - 1
  }
  return -1;
}
```
**Why it fails 3 tests:** With `while (lo < hi)` and both bounds moving by ±1, when the target is the last remaining unchecked element and `lo == hi`, the loop exits without checking it. Should use `while (lo <= hi)`.

---

### Task 6: Race Condition Fix

#### Buggy Code (Provided to Models)
```javascript
let count = 0;
async function increment() {
  let v = count;
  await new Promise(r => setTimeout(r, 1));
  count = v + 1;
}
// Called concurrently 100 times:
// await Promise.all(Array.from({length:100}, () => increment()));
```

#### 🐛 Bug Description

| Bug ID | Severity | Description |
|--------|----------|-------------|
| **T6-B1** | 🔴 Critical | **Classic read-modify-write race condition** — Each `increment()` call reads `count` into local `v`, then suspends at `await`, then writes `v + 1`. When 100 calls run concurrently, they all read `count = 0` before any has written back, so `count` ends up as `1` instead of `100`. |

#### Model Solutions (All 100%)

| Model | Approach | Key Mechanism |
|-------|----------|---------------|
| **MiMo V2.5 Pro** | Promise-chain lock | `lock = lock.then(async () => { read → await → write })` — serializes increments |
| **MiMo V2.5** | Promise-chain + direct increment | `lock = lock.then(() => new Promise(resolve => { setTimeout(() => { count++; resolve(); }, 1) }))` |
| **DeepSeek V4 Pro** | Explicit mutex pattern | Creates a new Promise for each lock; `await prevLock` before critical section, `unlock()` in `finally` |
| **DeepSeek V4 Flash** | Mutex class | Full `Mutex` class with `lock()`/`unlock()` methods and queue |
| **MiniMax M2.7** | Promise-chain + direct increment | `lastOp = lastOp.then(() => { count++ })` — simplest correct solution |

---

### Task 7: SQL Optimization

#### Buggy Query (Provided to Models)
```sql
SELECT u.name, COUNT(o.id) as order_count
FROM u# Comprehensive Bug Compilation — Dual-Benchmark Analysis

**Generated:** 2026-05-27
**Source:** Coding Model Benchmark + Calino Code Understanding Benchmark
**Models Tested:** MiMo V2.5 Pro, MiMo V2.5, DeepSeek V4 Pro, DeepSeek V4 Flash, MiniMax M2.7

---

## Part 1: Coding Benchmark — Debug Tasks

These are **real bugs** from the user's actual projects, seeded into the benchmark as debug tasks.
Models had to identify and fix the buggy code.

---

### Task 5: Binary Search Fix

#### Buggy Code (Provided to Models)
```javascript
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    let mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid;       // ← BUG: should be 'lo = mid + 1'
    else hi = mid;
  }
  return -1;
}
```

#### 🐛 Bug Description

| Bug ID | Severity | Description |
|--------|----------|-------------|
| **T5-B1** | 🔴 Critical | **Infinite loop due to `lo = mid` instead of `lo = mid + 1`** — When `arr[mid] < target`, setting `lo = mid` without incrementing means the search range never shrinks when `lo` and `mid` point to the same element. This causes an infinite loop when the target is greater than the last element or when the remaining range is size 1. |

#### Correct Fix
```javascript
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    let mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;   // ← FIXED: increment mid
    else hi = mid;
  }
  return -1;
}
```

#### Model Performance

| Model | Score | Result | Notes |
|-------|-------|--------|-------|
| MiMo V2.5 Pro | ✅ 100% | 12/12 passed | Correct fix applied |
| MiMo V2.5 | ✅ 100% | 12/12 passed | Correct fix applied |
| DeepSeek V4 Pro | ✅ 100% | 12/12 passed | Correct fix applied |
| DeepSeek V4 Flash | ✅ 100% | 12/12 passed | Alternative fix: changed to `lo <= hi` with `hi = arr.length - 1` and `hi = mid - 1` |
| MiniMax M2.7 | ⚠️ 75% | 9/12 passed | Also used `lo = mid` (partial fix — changed bounds but not the core bug) |

#### MiniMax M2.7's Partial Fix (75%)
```javascript
function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;        // Changed: arr.length → arr.length - 1
  while (lo < hi) {                         // Still using lo < hi
    let mid = Math.floor((lo + hi) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;   // Fixed this line
    else hi = mid - 1;                      // Changed: mid → mid - 1
  }
  return -1;
}
```
**Why it fails 3 tests:** With `while (lo < hi)` and both bounds moving by ±1, when the target is the last remaining unchecked element and `lo == hi`, the loop exits without checking it. Should use `while (lo <= hi)`.

---

### Task 6: Race Condition Fix

#### Buggy Code (Provided to Models)
```javascript
let count = 0;
async function increment() {
  let v = count;
  await new Promise(r => setTimeout(r, 1));
  count = v + 1;
}
// Called concurrently 100 times:
// await Promise.all(Array.from({length:100}, () => increment()));
```

#### 🐛 Bug Description

| Bug ID | Severity | Description |
|--------|----------|-------------|
| **T6-B1** | 🔴 Critical | **Classic read-modify-write race condition** — Each `increment()` call reads `count` into local `v`, then suspends at `await`, then writes `v + 1`. When 100 calls run concurrently, they all read `count = 0` before any has written back, so `count` ends up as `1` instead of `100`. |

#### Model Solutions (All 100%)

| Model | Approach | Key Mechanism |
|-------|----------|---------------|
| **MiMo V2.5 Pro** | Promise-chain lock | `lock = lock.then(async () => { read → await → write })` — serializes increments |
| **MiMo V2.5** | Promise-chain + direct increment | `lock = lock.then(() => new Promise(resolve => { setTimeout(() => { count++; resolve(); }, 1) }))` |
| **DeepSeek V4 Pro** | Explicit mutex pattern | Creates a new Promise for each lock; `await prevLock` before critical section, `unlock()` in `finally` |
| **DeepSeek V4 Flash** | Mutex class | Full `Mutex` class with `lock()`/`unlock()` methods and queue |
| **MiniMax M2.7** | Promise-chain + direct increment | `lastOp = lastOp.then(() => { count++ })` — simplest correct solution |

---

### Task 7: SQL Optimization

#### Buggy Query (Provided to Models)
```sql
SELECT u.name, COUNT(o.id) as order_count
FROM users u LEFT JOIN orders o ON u.id = o.user_id
WHERE o.created_at > '2024-01-01'
GROUP BY u.name
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC;
```

#### 🐛 Bugs Found

| Bug ID | Severity | Category | Description |
|--------|----------|----------|-------------|
| **T7-SQL1** | 🔴 Critical | Logic | **`WHERE` defeats the `LEFT JOIN`** — The `WHERE o.created_at > '2024-01-01'` filters on the right table `o`, which implicitly converts the `LEFT JOIN` into an `INNER JOIN`. Users with zero matching orders (or only orders before 2024) are excluded entirely, making the `LEFT JOIN` meaningless. Fix: Move the date filter into the `ON` clause or use a subquery. |
| **T7-SQL2** | 🟡 Medium | Performance | **Missing index on `orders.created_at`** — The query filters and groups on this column without an index, causing a full table scan on the orders table. |
| **T7-SQL3** | 🟡 Medium | Performance | **Missing index on `orders.user_id`** — The JOIN condition `o.user_id = u.id` would benefit from an index on `orders.user_id` for the foreign key lookup. |
| **T7-SQL4** | 🟡 Medium | Logic | **`GROUP BY u.name` may be ambiguous** — If two users have the same name, their orders are incorrectly merged. Should use `GROUP BY u.id` instead (or include `u.id` in SELECT and GROUP BY). |
| **T7-SQL5** | 🟢 Low | Correctness | **`COUNT(o.id)` vs `COUNT(*)`** — `COUNT(o.id)` skips NULL order IDs. For a LEFT JOIN, `COUNT(*)` would count the row (including NULL-padded user rows with no orders) while `COUNT(o.id)` correctly counts only actual orders. In this query it's correct since we want to count actual orders, but the intent should be explicit. |

**Note:** Task 7 (SQL Optimization) was listed with `-` scores in the report, indicating it was not automatically scored. It was likely a manual review task.

---

## Part 2: Calino Benchmark — Search Implementation Bugs (Task 7)

The Calino CalDAV calendar app's search module (`searchIndex.ts`) was analyzed by all 5 models.
Each model independently found bugs. Below is the **complete union** of all bugs found across all models.

---

### 🔴 Critical / High Severity

#### Bug C1: Fuse.js `limit` Applied BEFORE Chronological Re-Sort
**Found by:** DeepSeek V4 Flash, MiMo V2.5

```typescript
const results = fuseInstance.search(query, { limit: options?.limit ?? 50 })
// ... filter by calendar/date ...
return filteredResults.sort((a, b) => { ... })  // Re-sort happens AFTER limit
```

**Problem:** Fuse returns the top 50 results by relevance score, then those 50 are re-sorted by date. If 100 events match "meeting" and the most chronologically relevant one is ranked #51 by Fuse score, it gets **discarded** before the date sort ever sees it. The user never sees it.

**Fix:** Either apply limit after sorting, or use a much larger pre-sort limit.

---

#### Bug C2: Relevance Score Completely Discarded by Date Re-Sort
**Found by:** MiMo V2.5

```typescript
// Fuse ranks by relevance, then this completely overrides it:
.sort((a, b) => {
  const dateA = parseISO(a.item.start).getTime()
  const dateB = parseISO(b.item.start).getTime()
  return dateB - dateA  // Pure date sort — relevance ignored
})
```

**Problem:** The `score` field in returned results is **misleading** — a high-relevance result from 6 months ago always ranks below a low-relevance result from yesterday. The user gets results that may be chronologically ordered but semantically poor.

**Fix:** Sort by a composite score: `(score * weight) + dateRecency`, or let the caller choose sort mode.

---

#### Bug C3: `options.keys` Corrupted When Passed Without `options.weights`
**Found by:** DeepSeek V4 Pro, MiMo V2.5 Pro

```typescript
const fuseOptions: IFuseOptions<CalendarEvent> = {
  ...DEFAULT_OPTIONS,
  ...options,    // ← options.keys (string[]) overwrites DEFAULT_OPTIONS.keys ({name, weight}[])
}

if (options?.keys && options?.weights) {  // ← SKIPPED if no weights!
  fuseOptions.keys = options.keys.map((key) => ({
    name: key,
    weight: options.weights?.[key] ?? 1,
  }))
}
```

**Problem:** If a caller passes `{ keys: ['title', 'location'] }` **without** `weights`, the spread sets `fuseOptions.keys` to a raw `string[]` (overwriting the properly-formatted `{name, weight}[]` objects from defaults). The remap block is skipped because `options.weights` is falsy. Fuse.js accepts plain strings for keys, but all weight configuration is silently lost.

**Additionally:** If `options.keys` is passed with `options.weights`, the spread already sets the raw strings, then the `if` block overwrites again — redundant and confusing.

**Fix:** Make the remap unconditional when `options.keys` is present:
```typescript
if (options?.keys) {
  fuseOptions.keys = options.keys.map((key) => ({
    name: key,
    weight: options.weights?.[key] ?? 1,
  }))
}
```

---

### 🟡 Medium Severity

#### Bug C4: Partial Date Range Silently Ignored
**Found by:** MiMo V2.5 Pro, MiMo V2.5, DeepSeek V4 Flash, MiniMax M2.7

```typescript
if (filters.dateFrom && filters.dateTo) {  // ← BOTH required!
  // ... date filtering logic ...
}
// If only dateFrom OR only dateTo is provided → entire block skipped
```

**Problem:** If a caller passes `{ dateFrom: '2024-01-01' }` to get all events from 2024 onward, the filter block is completely skipped — **no date filtering at all**. The caller expects "from X onward" to work but gets unfiltered results.

**Fix:** Support half-open ranges:
```typescript
const fromDate = filters.dateFrom ? startOfDay(parseISO(filters.dateFrom)) : null
const toDate = filters.dateTo ? endOfDay(parseISO(filters.dateTo)) : null
// Then check individually
```

---

#### Bug C5: Silent Empty Return When Index Not Initialized
**Found by:** ALL 5 MODELS

```typescript
if (!fuseInstance || !query.trim()) {
  return []   // ← No error, no warning, indistinguishable from "no results found"
}
```

**Problem:** If a developer forgets to call `initializeSearchIndex()` before `search()`, or if there's a race condition where `search()` fires before async initialization completes, the function silently returns `[]`. The UI renders "No results found" with no indication the index was never built.

**Fix:** Add a warning:
```typescript
if (!fuseInstance) {
  console.warn('[Search] Index not initialized. Call initializeSearchIndex() first.')
  return []
}
```

---

#### Bug C6: Empty Query With Filters Returns Nothing
**Found by:** MiMo V2.5

```typescript
if (!fuseInstance || !query.trim()) {
  return []   // ← "Show all events in calendar X this week" (query="") → returns []
}
```

**Problem:** A caller passing `query=""` with filters (e.g., "show me all events in calendar X this week") gets an empty array because of the `!query.trim()` guard. There's no way to do a filter-only search.

**Fix:** Only guard on `!query.trim()` when no filters are provided:
```typescript
if (!fuseInstance) return []
if (!query.trim() && !filters) return []
```

---

#### Bug C7: Sort Direction — Newest First (Likely Wrong for Calendar)
**Found by:** DeepSeek V4 Flash, MiniMax M2.7

```typescript
return dateB - dateA   // ← Descending: newest first
```

**Problem:** For a calendar app, users typically search to find upcoming events. Sorting newest-first means the first result shown is the most distant future event, not the soonest. Searching "coffee" on May 26 would show the December coffee meeting before today's.

**Fix:** Sort ascending (soonest first) or make it configurable:
```typescript
return dateA - dateB   // ← Ascending: soonest first
```

---

#### Bug C8: `SearchOptions` Spread Into `IFuseOptions` — Type-Unsafe
**Found by:** DeepSeek V4 Flash, DeepSeek V4 Pro

```typescript
const fuseOptions: IFuseOptions<CalendarEvent> = {
  ...DEFAULT_OPTIONS,
  ...options,    // SearchOptions may have non-IFuseOptions fields (like 'limit')
}
```

**Problem:** `SearchOptions` (a custom type from `../types`) is spread directly into `IFuseOptions`. Extra fields like `limit` are included in the Fuse config object. Fuse.js ignores unknown properties, but the type cast `as IFuseOptions<CalendarEvent>` suppresses potential type errors. Additionally, `SearchOptions` serves dual purposes — carrying both initialization config (`keys`, `weights`, `threshold`) and runtime config (`limit`), which is misleading API design.

**Fix:** Destructure only the relevant fields or use a more specific type for initialization.

---

### 🟢 Low Severity

#### Bug C9: No Error Handling for Invalid/Malformed Dates
**Found by:** DeepSeek V4 Flash, MiMo V2.5

```typescript
const dateA = parseISO(a.item.start).getTime()
const dateB = parseISO(b.item.start).getTime()
return dateB - dateA
```

**Problem 1 (parseISO throws):** If any `event.start` is a malformed date string, `parseISO` can throw, crashing the entire search.

**Problem 2 (NaN sort):** If `parseISO` returns an `Invalid Date` object (which is a valid Date), `.getTime()` returns `NaN`. `NaN - NaN = NaN`, and Array.sort with a `NaN` comparator has **implementation-defined** behavior — results could appear in any order.

**Fix:** Wrap in try-catch and skip invalid events:
```typescript
try {
  const dateA = parseISO(a.item.start).getTime()
  const dateB = parseISO(b.item.start).getTime()
  if (isNaN(dateA) || isNaN(dateB)) return 0
  return dateB - dateA
} catch { return 0 }
```

---

#### Bug C10: Module-Level Singleton — Design Hazard
**Found by:** ALL 5 MODELS

```typescript
let fuseInstance: Fuse<CalendarEvent> | null = null
```

**Problem:** The module-scoped singleton means:
- Only **one** search index can exist at a time
- Per-calendar or per-context search is impossible
- In React, component unmount/remount can trigger `initializeSearchIndex` while a debounced `search()` is pending, causing search on a stale/empty index
- Testing is difficult — tests can't have independent indexes

**Fix:** Use a class-based design or factory function for testability and isolation.

---

#### Bug C11: `updateSearchIndex` Cannot Change Search Options
**Found by:** MiMo V2.5 Pro, DeepSeek V4 Flash

```typescript
export function updateSearchIndex(events: CalendarEvent[]): void {
  if (fuseInstance) {
    fuseInstance.setCollection(events)   // ← No options parameter!
  } else {
    initializeSearchIndex(events)        // ← No options parameter either!
  }
}
```

**Problem:** `updateSearchIndex` preserves whatever config was set during the initial `initializeSearchIndex` call. To change search weights, keys, or threshold after initialization, you must call `initializeSearchIndex` again (creating a new Fuse instance). This is a design limitation worth documenting.

**Fix:** Accept an optional `SearchOptions` parameter and create a new Fuse instance if options differ.

---

#### Bug C12: Repeated `parseISO` Calls — Minor Performance Issue
**Found by:** MiMo V2.5 Pro

**Problem:** `parseISO` is called on every event's `start` date **every time** `search()` runs, even if the same events are in the index across multiple searches. No caching. For large event sets with frequent searches, this is wasteful.

**Fix:** Pre-compute and cache parsed dates, or store timestamps alongside events in the index.

---

#### Bug C13: Redundant `key` Field in Match Results
**Found by:** MiniMax M2.7

```typescript
matches: result.matches?.map((match) => ({
  field: match.key as 'title' | 'description' | 'location',
  indices: match.indices as [number, number][],
  value: match.value ?? '',
  key: match.key ?? '',   // ← Same as 'field', redundant
}))
```

**Problem:** The `key` field duplicates `field`. This indicates either a type mismatch or unintentional duplication.

**Fix:** Remove the redundant `key` field or rename `field` to be the typed version and `key` the raw string.

---

## Part 3: Bug Summary Matrix

### Coding Benchmark — Debug Tasks

| Task | Bug | Severity | MiMo V2.5 Pro | MiMo V2.5 | DS V4 Pro | DS V4 Flash | MiniMax M2.7 |
|------|-----|----------|:---:|:---:|:---:|:---:|:---:|
| T5 - Binary Search | `lo = mid` → infinite loop | 🔴 Critical | ✅ Fixed | ✅ Fixed | ✅ Fixed | ✅ Fixed (alt) | ⚠️ Partial |
| T6 - Race Condition | Read-modify-write race | 🔴 Critical | ✅ Fixed | ✅ Fixed | ✅ Fixed | ✅ Fixed | ✅ Fixed |
| T7 - SQL | WHERE defeats LEFT JOIN | 🔴 Critical | Manual review | Manual review | Manual review | Manual review | Manual review |
| T7 - SQL | Missing indexes | 🟡 Medium | — | — | — | — | — |
| T7 - SQL | GROUP BY name ambiguous | 🟡 Medium | — | — | — | — | — |

### Calino Benchmark — Search Implementation

| Bug ID | Bug Description | Severity | DS V4 Flash | DS V4 Pro | MiMo V2.5 | MiMo V2.5 Pro | MiniMax M2.7 |
|--------|----------------|----------|:---:|:---:|:---:|:---:|:---:|
| C1 | Limit before chronological re-sort | 🔴 High | ✅ | — | ✅ | — | — |
| C2 | Relevance score discarded by date sort | 🔴 High | — | — | ✅ | — | — |
| C3 | keys without weights corrupts config | 🔴 High | — | ✅ | — | ✅ | — |
| C4 | Partial date range silently ignored | 🟡 Medium | ✅ | — | ✅ | ✅ | ✅ |
| C5 | Silent empty return on uninit | 🟡 Medium | ✅ | ✅ | ✅ | ✅ | ✅ |
| C6 | Empty query + filters returns nothing | 🟡 Medium | — | — | ✅ | — | — |
| C7 | Sort direction newest-first (wrong) | 🟡 Medium | ✅ | — | — | — | ✅ |
| C8 | SearchOptions spread type-unsafe | 🟡 Medium | ✅ | ✅ | — | — 