# Plan: Dark Theme — Event Modal, Preview Popup & Event Card Readability

**Goal:** Dark theme applies correctly to the EventModal, EventPreviewPopup text is readable, and event cards are clearly distinguishable in dark mode.
**Approach:** Three-pronged fix — (1) replace hardcoded light colors in EventModal with theme variables, (2) fix wrong CSS variable names in EventPreviewPopup, (3) introduce `--event-bg-mix` and `--ink-raw` CSS variables so event cards and hover states adapt per theme. Also fix `rgba(44, 40, 33, …)` hardcodes across grid/sidebar/header components using `--ink-raw`.

**Critical Files:**
- `src/lib/themes/loader.ts`: `getBuiltInThemeCSS()` — add `--event-bg-mix`, `--ink-raw`, `--error-muted` to light and dark theme definitions
- `src/features/calendar/components/EventModal.module.css`: Replace 6+ hardcoded `#faf9f7`/`#fff` backgrounds with `var(--panel)` or `var(--color-surface)`
- `src/features/calendar/components/EventPreviewPopup.module.css`: Fix `--color-text` → `--color-text-primary`, `--color-primary` → `--color-accent`, `--color-primary-hover` → `--color-accent-hover` (~15 occurrences)
- `src/features/calendar/components/EventCard.module.css`: Use `var(--event-bg-mix, 9%)` in `color-mix()` so dark theme gets higher mix (18%)
- `src/features/calendar/components/CalendarGrid.module.css`: Replace `rgba(44, 40, 33, …)` with `rgba(var(--ink-raw), …)`
- `src/features/calendar/components/Sidebar.module.css`: Same `--ink-raw` replacement
- `src/features/calendar/components/CalendarHeader.module.css`: Same `--ink-raw` replacement
- `src/features/calendar/components/DayView.module.css`: Same `--ink-raw` replacement

---

## Tasks

### Task 1: Add dark-aware CSS custom properties to `getBuiltInThemeCSS()`
- [x] In `src/lib/themes/loader.ts`, inside `getBuiltInThemeCSS()`, add to the `:root, [data-theme='light']` block:
  - `--ink-raw: 44, 40, 33;` — RGB triplet for `rgba()` usage in hover states
  - `--event-bg-mix: 9%;` — event card background color-mix percentage
  - `--event-bg-mix-hover: 12%;` — event card hover color-mix percentage
  - `--color-error-muted: #c47068;` — muted error color for delete buttons
  - `--shadow-inset: inset 0 1px 2px rgba(44, 40, 33, 0.06);`
- [x] Add to the `[data-theme='dark']` block:
  - `--ink-raw: 240, 236, 230;`
  - `--event-bg-mix: 18%;` — higher mix for dark backgrounds
  - `--event-bg-mix-hover: 22%;`
  - `--color-error-muted: #d4877f;`
  - `--shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.2);`
- [x] Commit: `fix(theme): add dark-aware CSS variables for event cards and hover states`

### Task 2: Fix EventCard.module.css — event visibility in dark mode
- [x] In `src/features/calendar/components/EventCard.module.css`, replace the `.card` background:
  - From: `background: color-mix(in srgb, var(--event-color, var(--accent)) 9%, var(--canvas, #faf8f3));`
  - To: `background: color-mix(in srgb, var(--event-color, var(--accent)) var(--event-bg-mix, 9%), var(--canvas));`
- [x] Replace `.card:hover` background:
  - From: `background: color-mix(in srgb, var(--event-color, var(--accent)) 12%, var(--canvas, #faf8f3));`
  - To: `background: color-mix(in srgb, var(--event-color, var(--accent)) var(--event-bg-mix-hover, 12%), var(--canvas));`
- [x] Replace `.card:focus-visible` background with the same pattern (var(--event-bg-mix-hover, 12%))
- [x] Commit: `fix(events): use theme-aware color-mix for event card backgrounds`

### Task 3: Fix EventModal.module.css — hardcoded light colors
- [x] Replace `.modalCard { background: #faf9f7 }` with `background: var(--color-bg-secondary, #faf9f7);`
- [x] Replace `.modalBackdrop { background: rgba(26, 26, 26, 0.25) }` with `background: var(--color-overlay, rgba(26, 26, 26, 0.25));`
- [x] Replace `.modalDelete { background: #faf9f7 }` with `background: var(--color-surface, #faf9f7);`
- [x] Replace `.modalCancel { background: #faf9f7 }` with `background: var(--color-surface, #faf9f7);`
- [x] Replace `.titleSuggestions { background: #fff }` with `background: var(--color-surface-raised, #fff);`
- [x] Commit: `fix(modal): use theme variables instead of hardcoded light colors`

### Task 4: Fix EventPreviewPopup.module.css — wrong CSS variable names
- [x] Replace all `var(--color-text, #202124)` with `var(--color-text-primary, #202124)` (~8 occurrences across `.title`, `.titleInput`, `.field`, `.inlineInput`, `.descriptionText`, `.descriptionInput`)
- [x] Replace `var(--color-primary, #4285f4)` with `var(--color-accent, #4285f4)` in `.titleInput`, `.inlineInput`, `.descriptionInput` border-bottom
- [x] Replace `var(--color-primary-hover, #3367d6)` with `var(--color-accent-hover, #3367d6)` in `.openBtn:hover`
- [x] Commit: `fix(preview): use correct CSS variable names for text and accent colors`

### Task 5: Replace hardcoded `rgba(44, 40, 33, …)` with `rgba(var(--ink-raw), …)` in CalendarGrid
- [x] In `src/features/calendar/components/CalendarGrid.module.css`, replace all instances of `rgba(44, 40, 33, X)` with `rgba(var(--ink-raw, 44, 40, 33), X)` (preserve the same alpha value). Affects: `.weekNumber:hover`, `.day:hover`, `.day:focus-visible`, `.dayNumber:hover`, `.otherMonth`, `.splitHandle:hover`, `.splitHandleH:hover`, scrollbar thumb styles, weekend dimming
- [x] Commit: `fix(grid): use theme-aware ink color for hover and interaction states`

### Task 6: Replace hardcoded `rgba(44, 40, 33, …)` in Sidebar.module.css
- [x] In `src/features/calendar/components/Sidebar.module.css`, replace all `rgba(44, 40, 33, X)` with `rgba(var(--ink-raw, 44, 40, 33), X)`. Affects: `.overlay`, `.expandButton:hover`, `.miniDay:hover`, `.calendarItem:hover`, `.taskRow:hover`, `.categoryItem:hover`, `.sideAdd:hover`, badge backgrounds, dropdown shadows, etc.
- [x] Commit: `fix(sidebar): use theme-aware ink color for hover and interaction states`

### Task 7: Replace hardcoded `rgba(44, 40, 33, …)` in CalendarHeader.module.css
- [x] In `src/features/calendar/components/CalendarHeader.module.css`, replace all `rgba(44, 40, 33, X)` with `rgba(var(--ink-raw, 44, 40, 33), X)`. Affects: `.navigator`, `.navArrow:hover`, `.navToday:hover`, `.iconButton:hover`, `.viewTabs`, `.viewTab:hover`, `.viewDropdownButton:hover`, `.hamburger:hover`, etc.
- [x] Commit: `fix(header): use theme-aware ink color for hover and interaction states`

### Task 8: Replace hardcoded `rgba(44, 40, 33, …)` in DayView.module.css
- [x] In `src/features/calendar/components/DayView.module.css`, replace all `rgba(44, 40, 33, X)` with `rgba(var(--ink-raw, 44, 40, 33), X)`. Affects: `.cell:hover`, `.travelBarInner`, scrollbar thumb
- [x] Commit: `fix(dayview): use theme-aware ink color for hover and interaction states`

### Task 9: Update `src/themes/built-in.css` for consistency
- [x] The `src/themes/built-in.css` file has a different (older) set of variables than `getBuiltInThemeCSS()`. Add `--ink-raw`, `--event-bg-mix`, `--event-bg-mix-hover`, `--color-error-muted` to both the light and dark sections. Also add a `[data-theme='dark']` block mirroring the one in `getBuiltInThemeCSS()`.
- [x] Commit: `fix(theme): sync built-in.css with getBuiltInThemeCSS() dark theme additions`

### Task 10: Verify and test
- [x] Run `pnpm typecheck` to ensure no type errors
- [x] Run `pnpm lint` to check for linting issues
- [x] Run `pnpm test:run` to ensure no test regressions
- [x] Commit: `test: verify dark theme changes pass typecheck and tests`
