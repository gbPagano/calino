# Handoff: Calino — Tasks Page

## Overview
A redesign of Calino's **Tasks** view (reached via the "Tasks" tab in the top toolbar). It replaces a flat, full-width list — where priority and due-date metadata floated to the far edge of the window and every dated task dumped into a single "Overdue" bucket — with a focused reading column, time-to-act grouping, and an inverted priority hierarchy.

The page reuses Calino's existing chrome (top toolbar + left sidebar). Only the **main panel** (`.cal-main`) and the toolbar **title** change; the sidebar is untouched.

## About the Design Files
The files in this bundle are **design references created in HTML/CSS/JS** — a working prototype showing the intended look and behavior. They are **not** production code to ship as-is. The task is to **recreate this design inside Calino's real codebase**, using its established framework, component patterns, and state layer.

That said, this prototype is built directly on Calino's own `base.css` / `themes.css` design tokens, so the **CSS in `calino/tasks.css` is highly reusable** — the class names, token usage, and values can port almost verbatim. The grouping/render logic in `calino/tasks.js` documents the exact behavior to reproduce in your component layer.

To view the prototype: open `Calino Tasks.html` in a browser. The full Calino month-view system renders first, then the Tasks renderer swaps in the page.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, interaction states, and behavior. Recreate pixel-faithfully using Calino's existing primitives. All values below are exact.

---

## Screens / Views

### View: Tasks
**Purpose:** Let the user see every to-do grouped by urgency, complete tasks, filter by status, and add new ones.

**Layout**
- Inherits the app shell: a CSS grid `300px | 1fr` (`.cal-body`) — left sidebar, right main.
- The toolbar title area (`.title-left`) is replaced with a single serif `<h1 class="month-title">Tasks</h1>`. The month navigator (`‹ Today ›`) is **removed** on this view. Search icon, the Month/Week/Day/Agenda/Tasks tab group, and the two right-side icon buttons remain. The **Tasks** tab carries `.is-active`.
- The main panel (`.cal-main`) holds a vertically scrolling `.tasks-page`. Inside it, a centered reading column `.tp-inner`: `max-width: 860px; margin: 0 auto; padding: 0 12px`. **This centering is the core fix** — all task metadata stays inside this 860px column instead of spanning the full window width.

**Components**

1. **Top bar** (`.tp-bar`) — flex row, space-between, `padding: 8px 14px 14px`, bottom border `1px solid var(--line-2)`.
   - **Left — count summary** (`.tp-count`): `14px`, color `--ink-2`. Active number is `--ink`, weight 600, tabular-nums. The "·" separator is `--ink-3`. Copy: `**10** active · 4 completed`.
   - **Right — controls** (`.tp-controls`): flex, gap `14px`.
     - **Segmented filter** — reuses the toolbar's `.tabs` / `.tab` styles exactly (pill group: track `rgba(44,40,33,.045)`, `padding: 4px`, `border-radius: 12px`; active tab gets white panel + `0 1px 2px rgba(44,40,33,.08), 0 0 0 1px var(--line)` shadow). Options: **All · Active · Completed**. Default **Active**.
     - **Add task button** (`.add-task`): `height: 36px; padding: 0 15px; border-radius: 10px`, background `--accent` (#b07d4f), white text `13.5px`/500, leading `+` icon (14px stroke icon), shadow `0 1px 2px rgba(44,40,33,.14)`. Hover darkens to `color-mix(in srgb, var(--accent) 88%, #000)`. Active: `translateY(1px)`.

2. **Group section** (`.tg`) — one per populated bucket. Hidden entirely if empty.
   - **Header** (`.tg-head`): flex row, `padding: 0 14px; margin: 26px 0 2px` (first group `margin-top: 14px`).
     - Title (`.tg-title`): `11.5px`, weight 700, `letter-spacing: .09em`, uppercase, color `--ink-3`.
     - Count badge (`.tg-count`): `11px`/600, `--ink-2`, background `rgba(44,40,33,.07)`, `border-radius: 999px; padding: 1px 8px`, tabular-nums.
     - Rule (`.tg-rule`): `flex: 1; height: 1px; background: var(--line-2)` — a faint editorial line extending right.
   - **Overdue variant** (`.tg.is-overdue`): title color `#bb5d6e`; count badge color `#bb5d6e` on `color-mix(in srgb, #c2697f 13%, transparent)`.

3. **Task row** (`.task`) — `display: grid; grid-template-columns: 22px 1fr auto; gap: 14px; align-items: start; padding: 12px 14px; border-radius: 13px`. Hover: background `color-mix(in srgb, var(--ink) 3.5%, transparent)`.
   - **Completion control** (`.task-check`): `20px` circle, `border: 1.7px solid color-mix(in srgb, var(--c) 55%, var(--ink-3))` where `--c` is the task's category color. Holds a check icon (11px, 2px stroke) hidden by default. Hover: border → `--c`, faint `--c` 9% fill, check at `opacity .4`. Done: solid `--c` fill, white check `opacity 1`. **Clickable** — toggles completion.
   - **Body** (`.task-body`):
     - Title (`.task-title`): `14.5px`/500, `--ink`, line-height 1.35.
     - Note (`.task-note`, optional): `12.5px`, `--ink-2`, `margin-top: 2px`, single-line truncated (ellipsis).
     - Done state: title gets `line-through`, `--ink-3`, weight 400; note → `--ink-3`.
   - **Meta cluster** (`.task-meta`): flex, gap `12px`, right-aligned in the column, `padding-top: 2px`, nowrap. Holds priority chip + due label. **This is the gulf fix** — metadata lives here, beside the task, not at the window edge.

4. **Priority chip** (`.pri`) — **weight is inverted: Low recedes, High is the only loud one.**
   - `.pri-high`: `padding: 2px 7px; border-radius: 6px; background: color-mix(in srgb, #b0584a 15%, var(--canvas)); color: #a4503f`. Label "High".
   - `.pri-med`: `padding: 1px 6px; border-radius: 6px; border: 1px solid var(--line); color: var(--ink-2)`. Label "Medium".
   - `.pri-low`: text only — no chip, no border. `color: var(--ink-3); letter-spacing: .05em`. Label "Low".
   - All: `10px`, weight 700, `letter-spacing: .06em`, uppercase.

5. **Due label** (`.due`): `12.5px`, `--ink-3`, tabular-nums, `min-width: 56px; text-align: right`. Overdue → `#bb5d6e`. Today → `--accent`, weight 600. (See "Relative date formatting" below.)

6. **Inline composer** (`.tp-compose`, conditional) — appears at the top of the list when "Add task" is clicked. Grid `22px | 1fr`, gap `14px`, `padding: 12px 14px`, background `color-mix(in srgb, var(--accent) 5%, transparent)`, inset ring `0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)`. Holds a disabled-looking check circle + a borderless transparent text input (`14.5px`, placeholder "What needs doing?" in `--ink-3`). Auto-focused.

7. **Empty state** (`.tp-empty`, conditional): centered, `padding: 64px 0`, `--ink-3`, `14px`. Bold line (`b`) in Newsreader serif `19px`, `--ink-2`. Copy: "All clear" / "Nothing here right now."

---

## Interactions & Behavior

- **Filter (All / Active / Completed):** clicking sets the filter and re-renders.
  - **Active** (default): show only non-completed tasks, grouped by time-to-act (below). Completed section hidden.
  - **Completed**: show only completed tasks under a single "Completed" group.
  - **All**: active groups first, then the "Completed" group.
- **Complete a task:** click the circle → toggles `done`. Task moves between Active/Completed groupings on re-render; counts update; checkmark fills in the task's category color and the title strikes through.
- **Add task:** click "+ Add task" → inserts the inline composer at the top (auto-focused). If the current filter is "Completed", it switches to "Active" first. **Enter** with non-empty text prepends a new task (no due date, low priority); **Escape** dismisses the composer.
- No page navigation occurs within this view; the toolbar tabs switch to the other Calino views.

### Time-to-act grouping (the core information-architecture change)
Bucket each **active** task by its due date relative to **today**:
| Bucket | Condition | Header |
|---|---|---|
| `overdue` | due date < today | **Overdue** (rose-tinted) |
| `today` | due date == today | **Today** |
| `week` | 1–6 days from today | **This week** |
| `later` | ≥ 7 days from today | **Later** |
| `nodate` | no due date | **No due date** |

Render order: Overdue → Today → This week → Later → No due date. **Sorting:** all active tasks sorted by due date ascending (earliest first; no-date last). Completed tasks sorted by due date descending (most recently done first). Empty buckets render nothing.

> Note: in the prototype, today is fixed at **2026-05-30** and the task dataset is a representative spread so every bucket is populated. In production, compute "today" live; the buckets self-populate from real due dates.

### Relative date formatting (`.due` text)
- due < today → month-day, e.g. `May 9` (rose)
- due == today → `Today` (accent, bold)
- due == today + 1 → `Tomorrow`
- 2–6 days out → weekday short name, e.g. `Tue`, `Thu`
- ≥ 7 days out → month-day, e.g. `Jun 11`
- no due date → `—`

---

## State Management
- `tasks: Task[]` — the task collection (see model below).
- `filter: 'all' | 'active' | 'completed'` — default `'active'`.
- `composing: boolean` — whether the inline add-task composer is shown.
- Derived (recomputed on render): active count, completed count, and the per-bucket grouping.

**Task model** (fields used by this design):
```
{
  id: string | number,
  title: string,
  note?: string,           // optional one-line description
  color: string (hex),     // category color, drives the --c custom property
  priority: 'high' | 'med' | 'low',
  due: string | null,      // ISO 'YYYY-MM-DD' or null
  done?: boolean
}
```
> The existing `calino/data.js` already carries `title`, `color`, and (for some) `note`, plus an `overdue` flag on sidebar tasks. **You'll need to add a `priority` field** and a real `due` ISO date per task (the prototype derives buckets and relative labels from `due`, not from a precomputed `overdue` flag).

---

## Design Tokens
All inherited from `calino/base.css` (`.calino` scope) unless noted.

**Colors**
- `--canvas` `#faf8f3` (warm paper) · `--panel` `#ffffff` · `--side` `#f6f3ed`
- `--ink` `#2c2823` · `--ink-2` `#6f6a62` · `--ink-3` `#a39d93`
- `--line` `rgba(44,40,33,0.09)` · `--line-2` `rgba(44,40,33,0.05)`
- `--accent` `#b07d4f` (brand tan) · `--accent-soft` `#efe7db`
- Overdue / rose accent: `#bb5d6e` (text), `#c2697f` (badge tint base)
- High-priority chip: text `#a4503f`, fill `color-mix(in srgb, #b0584a 15%, var(--canvas))`
- Category colors (per task, `--c`): rose `#c2697f`, blue `#5b7fb5`, green `#5d9a78`, amber `#bf944e`, plum `#8a6aa8`

**Typography**
- UI font: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- Display serif (titles, empty-state head): `"Newsreader", Georgia, serif`
- Title `Tasks`: 40px / 400 / `letter-spacing: -0.018em`
- Task title 14.5/500 · note 12.5 · due 12.5 (tabular-nums) · priority 10/700 uppercase · group header 11.5/700 uppercase · count badge 11/600

**Radius**: rows/composer `13px` · add button & filter track `10–12px` · priority chip `6px` · check circle `50%` · count badge `999px`

**Shadow**: add button `0 1px 2px rgba(44,40,33,.14)` · active filter pill `0 1px 2px rgba(44,40,33,.08), 0 0 0 1px var(--line)`

**Spacing**: reading column max-width `860px` · row padding `12px 14px` · group header margin `26px 0 2px` · row grid gap `14px` · meta gap `12px`

---

## Assets
No raster/image assets. All icons are inline SVG (stroke-based, `currentColor`):
- Checkmark (completion + composer): `viewBox="0 0 14 14"`, 2px stroke.
- Plus (add button): `viewBox="0 0 14 14"`, 2px stroke.
- Search / tab icons live in the shared toolbar (`calino/render.js`).

Font: **Newsreader** via Google Fonts (`opsz 6..72`, weights 400/500/600). Use your codebase's existing font pipeline.

---

## Files
In this bundle:
- `Calino Tasks.html` — entry point; renders the month-view chrome, then calls the Tasks renderer.
- `calino/tasks.css` — **all Tasks-page styling** (ports nearly verbatim).
- `calino/tasks.js` — Tasks data, grouping, relative-date logic, render, and interactions. The authoritative spec for behavior.
- `calino/base.css` — shared design tokens + toolbar/sidebar/grid styles (reference; already in the app).
- `calino/themes.css` — chip theme treatment (reference; already in the app).
- `calino/data.js` — existing sample data (shows the current task shape to extend).
- `calino/render.js` — existing month-view renderer + shared toolbar/sidebar (reference for how chrome is built).
- `screenshots/tasks-page.png` — reference render of the Active view.

### How the prototype wires up (for reference)
`renderCalino(app, 'theme-rail')` builds the full shell, then `renderCalinoTasks(app)`:
1. replaces `.title-left` with the serif "Tasks" heading (drops the month nav),
2. sets `.is-active` on the Tasks tab,
3. replaces `.cal-main` contents with the tasks page,
4. attaches delegated click/keydown handlers for filtering, completing, and adding.

In production, model this as a proper route/view component with the state above, not a DOM swap.
