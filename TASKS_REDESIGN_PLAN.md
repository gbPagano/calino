# Tasks Redesign — Implementation Plan

## Overview
Replace the current TodoView with a focused reading column design that groups tasks by time-to-act (Overdue → Today → This week → Later → No due date) with inverted priority hierarchy (Low recedes, High is the only loud one).

## Design Reference
- **Prototype**: `tasks_design/Calino Tasks.html`
- **CSS**: `tasks_design/calino/tasks.css` — highly reusable, ports nearly verbatim
- **JS Logic**: `tasks_design/calino/tasks.js` — grouping, relative dates, interactions
- **Screenshot**: `tasks_design/screenshots/tasks-page.png`

## Key Design Principles
1. **Centered reading column**: `max-width: 860px; margin: 0 auto` — metadata stays with its task, not at window edge
2. **Time-to-act grouping**: Overdue → Today → This week → Later → No due date (not one alarming "overdue" dump)
3. **Inverted priority**: Low whispers (text only), Medium has border, High is the only one that speaks up (colored chip)
4. **Editorial styling**: Group headers with uppercase labels, count badges, and faint rule lines

## Implementation Phases

### Phase 1: CSS Module Rewrite (TodoView.module.css)
**Goal**: Replace all styles with editorial design tokens

**Components to style**:
1. `.container` — flex column, full height, `--canvas` background
2. `.tpInner` — centered column: `max-width: 860px; margin: 0 auto; padding: 0 12px`
3. `.tpBar` — top bar: flex, space-between, bottom border
4. `.tpCount` — count summary: 14px, `--ink-2`, bold number in `--ink`
5. `.tpControls` — right controls: flex, gap 14px
6. `.segmentedControl` — filter tabs: reuses toolbar `.tabs`/`.tab` styles
7. `.addTask` — add button: 36px height, `--accent` bg, white text, shadow
8. `.taskGroup` — group section wrapper
9. `.groupHeader` — flex row: title + count badge + rule line
10. `.groupTitle` — 11.5px/700 uppercase `--ink-3`
11. `.groupCount` — 11px/600, pill badge, `rgba(44,40,33,.07)` bg
12. `.groupRule` — flex 1, 1px `--line-2`
13. `.overdueGroup` — rose-tinted header (#bb5d6e)
14. `.taskRow` — grid: `22px 1fr auto`, gap 14px, padding 12px 14px, radius 13px
15. `.taskCheck` — 20px circle, border color-mix(--c, --ink-3)
16. `.taskBody` — min-width 0
17. `.taskTitle` — 14.5px/500 `--ink`, line-through when done
18. `.taskNote` — 12.5px `--ink-2`, truncated
19. `.taskMeta` — flex, gap 12px, right-aligned
20. `.priorityHigh` — chip: bg color-mix(#b0584a 15%, --canvas), color #a4503f
21. `.priorityMed` — chip: border `--line`, color `--ink-2`
22. `.priorityLow` — text only: color `--ink-3`
23. `.dueLabel` — 12.5px, `--ink-3`, tabular-nums, right-aligned
24. `.dueOverdue` — color #bb5d6e
25. `.dueToday` — color `--accent`, weight 600
26. `.inlineComposer` — grid: 22px 1fr, accent-tinted bg, inset ring
27. `.emptyState` — centered, "All clear" in Newsreader serif 19px

### Phase 2: Component Rewrite (TodoView.tsx)
**Goal**: Implement new grouping logic and interactions

**State**:
- `filter: 'all' | 'active' | 'completed'` (default: 'active')
- `composing: boolean` (inline composer visibility)

**Data Flow**:
1. Get tasks from store, map calendar colors
2. Compute `activeCount` and `completedCount`
3. Group active tasks by time-to-act:
   - `overdue`: due < today
   - `today`: due == today
   - `week`: 1-6 days from today
   - `later`: ≥ 7 days from today
   - `nodate`: no due date
4. Sort: overdue ascending (earliest first), others ascending (soonest first)
5. Completed tasks: sort descending (most recent first)
6. Filter by `filter` state

**Relative Date Formatting**:
- due < today → `MMM d` (e.g., "May 9") in rose
- due == today → `Today` in accent, bold
- due == today + 1 → `Tomorrow`
- 2-6 days → weekday short (e.g., "Tue")
- ≥ 7 days → `MMM d` (e.g., "Jun 11")
- no due date → `—`

**Interactions**:
- Filter tabs: click to switch (All/Active/Completed)
- Task checkbox: toggle completion, moves between groups
- Add task button: shows inline composer
- Composer: Enter to create (no due date, low priority), Escape to dismiss
- Task click: opens modal for editing

### Phase 3: Route & Header Integration
**Goal**: Ensure "Tasks" tab works correctly

**Changes**:
- Verify `/tasks` route renders TodoView
- Ensure header shows "Tasks" title (no month navigator)
- Ensure "Tasks" tab is active in ViewSwitcher

### Phase 4: Testing
**Goal**: Verify all interactions work

**Test Cases**:
- Filter switching (All/Active/Completed)
- Task completion toggling
- Task creation via inline composer
- Empty states for each filter
- Responsive behavior

## Subagent Tasks

### Subagent 1: CSS Module
**File**: `src/features/calendar/components/TodoView.module.css`
**Input**: `tasks_design/calino/tasks.css` (reference)
**Output**: Complete CSS module with all classes from Phase 1

### Subagent 2: Component
**File**: `src/features/calendar/components/TodoView.tsx`
**Input**: Current file + design spec
**Output**: Complete component rewrite with Phase 2 logic

### Subagent 3: Integration
**Files**: `src/App.tsx`, `src/features/calendar/components/CalendarHeader.tsx`
**Input**: Current files
**Output**: Verify/update routing and header for Tasks view

## Design Token Mapping
| Prototype | Calino |
|-----------|--------|
| `--canvas` | `--canvas` (#faf8f3) |
| `--panel` | `--panel` (#ffffff) |
| `--ink` | `--ink` (#2c2823) |
| `--ink-2` | `--ink-2` (#6f6a62) |
| `--ink-3` | `--ink-3` (#a39d93) |
| `--line` | `--line` (rgba(44,40,33,0.09)) |
| `--line-2` | `--line-2` (rgba(44,40,33,0.05)) |
| `--accent` | `--accent` (#b07d4f) |
| `--c` (category color) | `--event-color` or inline style |

## Success Criteria
1. ✅ Centered reading column (max-width 860px)
2. ✅ Time-to-act grouping (5 buckets)
3. ✅ Inverted priority (Low=text, Med=border, High=colored chip)
4. ✅ Relative date formatting (Today, Tomorrow, weekday, MMM d)
5. ✅ Inline composer for adding tasks
6. ✅ Filter controls (All/Active/Completed)
7. ✅ Empty state with "All clear" message
8. ✅ All 664 tests pass
9. ✅ TypeScript compiles cleanly
