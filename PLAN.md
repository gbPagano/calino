# Plan: Fix Search Module Bugs

Branch: `fix/search-index-bugs` ✅ Committed

## Phase 1: Core Pipeline Fixes

- [x] **C1** — Moved `limit` out of `fuseInstance.search()`, applied after filtering + sorting via `.slice()`
- [x] **C2** — Replaced pure date sort with composite score (70% relevance × 30% recency blend)
- [x] **C4** — Changed `dateFrom && dateTo` guard to `dateFrom || dateTo`, support half-open ranges
- [x] **C12** — Pre-parse event dates into a Map once, reuse in filter + sort

## Phase 2: API Behavior Fixes

- [x] **C5** — Added `console.warn` when `fuseInstance` is null in `search()`
- [x] **C6** — Allow filter-only search when query is empty (bypass Fuse, filter collection directly)
- [x] **C3** — Made key remapping unconditional: `if (options?.keys)` instead of `if (options?.keys && options?.weights)`
- [x] **C8** — Stopped spreading `SearchOptions` into `IFuseOptions` (was type-unsafe)
- [x] **C11** — Added optional `options` param to `updateSearchIndex()`

## Phase 3: Robustness & Cleanup

- [x] **C9** — Wrapped `parseISO` in sort comparator with try-catch, fallback to epoch 0
- [x] **C13** — Removed redundant `key` field from `SearchMatch` type and mapping

## Phase 4: Verify

- [x] `pnpm typecheck` passes
- [x] `pnpm test:run` — all 14 search tests pass (1 pre-existing failure in EventPreviewPopup, unrelated)
