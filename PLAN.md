# Build Error Fixes

## Phase 1: WeekView & WeekDayColumn
- [x] Fix unused `idx` params in WeekView.tsx `.map()` calls
- [x] Remove unused `Calendar` import from WeekView.tsx
- [x] Add `import type { JSX } from 'react'` to WeekDayColumn.tsx
- [x] Remove unused `day` prop and `format` import from WeekDayColumn.tsx
- [x] Fix `openModal` type signature in WeekDayColumn.tsx
- [x] Fix ref type in CalendarGrid.tsx (HTMLDivElement → HTMLButtonElement)

## Phase 2: useSearch & uuid
- [x] Fix `useRef` initial value in useSearch.ts
- [x] Add `uuid` package dependency
- [x] Import `v4 as uuidv4` in icalTypeMapping.ts
- [x] Import `v4 as uuidv4` in credentials.ts
- [x] Import `v4 as uuidv4` in accountStorage.ts
- [x] Import `v4 as uuidv4` in EventModal.tsx

## Phase 3: zustand Storage
- [x] Wrap `safeLocalStorage` with `createJSONStorage()` in calendarStore.ts
- [x] Wrap `safeLocalStorage` with `createJSONStorage()` in settingsStore.ts
- [x] Commit and push all fixes to main

## Status
✅ All phases complete — build passes