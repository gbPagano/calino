# Code Quality Improvements

## Phase 1: Dead Code & Duplication
- [x] Extract `isUUID` to `src/lib/uuid.ts` — eliminated 3 duplicate copies
- [x] Share `HOURS` constant in `src/lib/hours.ts`
- [x] Consolidate event positioning logic in `src/lib/eventPositioning.ts`

## Phase 2: React Anti-patterns
- [x] Fix stale closure in EventModal useEffect (closeModalRef pattern)
- [x] Fix dual wheel listeners in CalendarGrid (consolidated to single handler)
- [x] Fix throw statements in EventModal (toast + early return)

## Phase 3: Test Coverage
- [x] Add 29 tests for `useCalDAV` hook

## Status
✅ All improvements complete — build passes
✅ 12 files changed, 779 insertions(+), 709 deletions(-)