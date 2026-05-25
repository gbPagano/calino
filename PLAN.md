# Plan: Month View + Agenda Split Panel

**Goal:** When the window is taller than 1400px and the user is in month view, show the agenda panel below the calendar grid.

**Approach:** Create a `useWindowHeight` hook (pattern-matched on the existing `useIsMobile` hook), then restructure `CalendarGrid` so it renders a flex-column layout — calendar on top, agenda on bottom — when tall enough. The existing `AgendaView` component is reused as-is since it already reads `currentDate` and fetches its own events.

---

## Tasks

### Task 1: Create `useWindowHeight` hook
- [ ] Create `src/hooks/useWindowHeight.ts` — exports `useWindowHeight(): number` (current innerHeight) and `useIsTallWindow(threshold = 1400): boolean`
- [ ] Subscribes to `window` `resize` event, cleans up on unmount
- [ ] Add to `src/hooks/index.ts` barrel export
- [ ] Commit: `feat(hooks): add useWindowHeight hook`

### Task 2: Restructure `CalendarGrid` for split layout
- [ ] In `CalendarGrid.tsx`, import `useIsTallWindow` and `AgendaView`
- [ ] Wrap the return in a conditional: if tall, render a flex-column `<div>` with `<CalendarGrid>` on top and `<AgendaView>` below; else render existing layout unchanged
- [ ] The grid top portion takes ~60% height (`flex: 0 0 60%`); agenda takes remaining space (`flex: 1 1 40%`, also `overflow: auto`)
- [ ] Adjust `CalendarGrid.module.css`: add `.splitContainer`, `.gridTop`, `.agendaBottom` rules
- [ ] The existing `.grid` element becomes the `.gridTop` content — it no longer takes `flex: 1` in tall mode
- [ ] Commit: `feat(month): add agenda split panel below calendar grid when window > 1400px`

### Task 3: Tune layout proportions and polish
- [ ] Ensure both panels scroll independently
- [ ] Remove/reduce top padding from agenda panel to avoid double-padding with the page
- [ ] Verify month navigation in the header updates both the grid and the agenda (AgendaView reads `currentDate` from store, so this should work automatically)
- [ ] Commit: `chore(month): fine-tune split panel proportions and scrolling`

### Verification
- [ ] `pnpm build` passes
- [ ] Month view on window > 1400px: agenda appears below calendar grid
- [ ] Resize window below 1400px: agenda disappears, calendar takes full height
- [ ] Month navigation updates both panels
