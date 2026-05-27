# Plan: Fix Search Module Bugs

Branch: `fix/search-index-bugs`

## Phase 1: Core Pipeline Fixes

- [ ] **C1** — Move `limit` out of `fuseInstance.search()`, apply after filtering + sorting via `.slice()`
- [ ] **C2** — Replace pure date sort with composite score (relevance × recency blend)
- [ ] **C4** — Change `dateFrom && dateTo` guard to `dateFrom || dateTo`, support half-open ranges
- [ ] **C12** — Pre-parse event dates into a Map once, reuse in filter + sort (eliminates redundant parseISO)

## Phase 2: API Behavior Fixes

- [ ] **C5** — Add `console.warn` when `fuseInstance` is null in `search()`
- [ ] **C6** — Allow filter-only search when query is empty (bypass Fuse, filter collection directly)
- [ ] **C3** — Make key remapping unconditional: `if (options?.keys)` instead of `if (options?.keys && options?.weights)`
- [ ] **C11** — Add optional `options` param to `updateSearchIndex()`

## Phase 3: Robustness & Cleanup

- [ ] **C9** — Wrap `parseISO` calls in sort comparator with try-catch, fallback to epoch 0
- [ ] **C13** — Remove redundant `key` field from `SearchMatch` type and mapping
- [ ] **C12** — (covered in Phase 1)

## Phase 4: Verify

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:run` passes

---

## Out of Scope

| Bug | Reason |
|-----|--------|
| C7 — Sort direction | Design choice, not a bug |
| C8 — SearchOptions spread type-unsafe | Not present in actual code |
| C10 — Module-level singleton | Requires architecture refactor |
