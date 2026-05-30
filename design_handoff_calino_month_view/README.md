# Handoff: Calino — Month View (refined)

## Overview
A polished refinement of the Calino calendar's **Month view**. Same product, same
content, same calm-editorial character as the original — sharpened for a more
premium feel. This package covers the Month view only (the Week / Day / Agenda /
Tasks tabs are out of scope here).

## About the design files
The files in this bundle are a **design reference built in HTML/CSS/JS** — a
prototype showing the intended look and behavior, **not production code to copy
verbatim**. The task is to **recreate this design in the target codebase's existing
environment** (React, Vue, Svelte, SwiftUI, etc.) using its established components,
tokens, and patterns. If there is no environment yet, pick the most appropriate
framework and implement it there.

Open `Calino Month View.html` in a browser to see the exact target. It renders
full-window; the calendar fills the viewport (designed around ~1600×1000).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and states below are final.
Reproduce them precisely, mapped onto the codebase's own primitives.

## Screenshots
See the `screenshots/` folder for the rendered target:
- `calino-month-view.png` — the full Month view (the pixel reference).
- `chip-detail.png` — close-up of the chip treatments: event (color rail + soft
  tint), recurring (↻), and task (hollow checkbox).

---

## Layout

Two-region app shell, full viewport, no page scroll (the grid flexes to fill height).

```
┌───────────────────────── TOP BAR (height ~76px) ─────────────────────────┐
│ [◆ Calino]  │  May 2026   ‹ Today ›            🔍  [Month|Week|…]  ▭  ⚙   │
├──────────────┬────────────────────────────────────────────────────────────┤
│  SIDEBAR     │                  MONTH GRID                                  │
│  (300px)     │  (fills remaining width)                                     │
│              │                                                              │
│  · mini-cal  │   W# | MON TUE WED THU FRI SAT SUN   (header row)            │
│    (card)    │   18 |  …   …   …   …   1   2   3                             │
│  · Calendars │   19 |  4   5   6   7   8   9  10                             │
│  · Tasks     │   …  (5 week rows, each flex:1 to fill height)               │
│    (card)    │                                                              │
│  · Categories│                                                              │
│  · footer    │                                                              │
└──────────────┴────────────────────────────────────────────────────────────┘
```

- **Top bar** is a CSS grid: `grid-template-columns: 300px 1fr`. First cell = the
  `Calino` wordmark (aligned over the sidebar). Second cell = a flex row with the
  month title + navigator on the left and search / view-tabs / icon buttons on the
  right. Vertical padding 18px.
- **Body** is a CSS grid: `grid-template-columns: 300px 1fr`, fills remaining height.
- **Sidebar** column: 300px wide, horizontal padding 20px, sections stacked with
  `gap: 16px`. The mini-calendar and the Tasks list each sit on their own white
  **card**; Calendars and Categories are plain (no card) but their content is inset
  16px so it aligns with the card interiors.
- **Month grid**: a rounded bordered panel. Header row (`46px` week-number column +
  7 equal day columns). Body = 5 week rows, each `flex: 1` so the grid always fills
  available height. Cells separated by hairline borders.

---

## Design tokens

### Color
| Token | Value | Use |
|---|---|---|
| `--canvas` | `#faf8f3` | app background (warm paper) |
| `--panel` | `#ffffff` | cards, grid panel, segmented controls |
| `--ink` | `#2c2823` | primary text |
| `--ink-2` | `#6f6a62` | secondary text, day numbers, icons |
| `--ink-3` | `#a39d93` | faint text, weekday labels, week numbers, year |
| `--line` | `rgba(44,40,33,0.09)` | hairline borders (grid, cards, dividers) |
| `--line-2` | `rgba(44,40,33,0.05)` | lightest internal cell separators |
| `--accent` | `#b07d4f` | warm tan — today marker, brand dot, Today button |

**Event colors are USER-CHOSEN**, not a fixed system palette. Each event stores one
base hex (`--c`). The chip treatment derives every shade from it via
`color-mix(in srgb, var(--c) N%, var(--canvas))`, so any color the user picks reads
calm. The sample data uses: rose `#c2697f`, blue `#5b7fb5`, green `#5d9a78`,
amber `#bf944e`, plum `#8a6aa8`. **Do not hard-code these as categories** — they are
example user picks; the renderer must accept an arbitrary per-event color.

### Typography
- **Serif — `Newsreader`** (Google Fonts; weights 400/500/600): the `Calino`
  wordmark (27px/500), the month title `May` (40px/400, `letter-spacing:-0.018em`),
  the year `2026` (27px, `--ink-3`), and the mini-calendar title (20px/500).
- **Sans — system stack** (`-apple-system, BlinkMacSystemFont, "Segoe UI",
  system-ui, sans-serif`): everything else. Base 14px / line-height 1.45.
- Section labels (CALENDARS / TASKS / CATEGORIES): 11.5px, weight 700,
  `letter-spacing:.09em`, uppercase, `--ink-3`.
- Weekday headers (MON…SUN): 11.5px, weight 700, `letter-spacing:.08em`, `--ink-3`.
- Day numbers: 14px, weight 500, `--ink-2`, `font-variant-numeric: tabular-nums`.
- Use `tabular-nums` on all dates/times.

### Spacing / radius / shadow
- Sidebar width **300px**; sidebar padding **20px**; section gap **16px**.
- Grid: panel `border-radius:16px`, `1px solid --line`. Week-number column **46px**.
- Cards (mini-cal, Tasks): `border-radius:16px`, `1px solid --line`, padding
  `16px 16px 18px`, shadow `0 1px 2px rgba(44,40,33,.04), 0 6px 16px rgba(44,40,33,.03)`.
- Chips: `border-radius:7px`. Icon buttons: `border-radius:11px`, 40px square.

---

## Components

### Top bar
- **Wordmark** `◆ Calino`: serif 27px/500 in `--ink`, preceded by an 11px accent
  **diamond** (an 11px square, `border-radius:3px`, `background:--accent`,
  `transform:rotate(45deg)`, with a soft `box-shadow:0 0 0 4px` accent@14% halo),
  `gap:11px`. Left padding 36px (aligns over the mini-cal card interior).
- **Month title**: `May` (serif 40px, `--ink`) + `2026` (serif 27px, `--ink-3`).
  `white-space:nowrap`. Sits over the grid's left edge.
- **Navigator** — one grouped segmented control (NOT three loose buttons):
  inline-flex, `background:--panel`, `1px solid --line`, `border-radius:11px`,
  `box-shadow:0 1px 2px rgba(44,40,33,.05)`, `overflow:hidden`, height 38px.
  Contains: prev chevron (40×38), `Today` label (padding `0 18px`, with
  `border-left`/`border-right` `1px solid --line` dividers), next chevron.
  Chevrons are 16px stroked SVGs. Arrow hover: `background rgba(44,40,33,.05)`.
  Today hover: `background` accent@7%, text → `--accent`.
- **Right cluster** (`gap:14px`): search icon button, the view-tab segmented
  control, a display icon button, a settings (gear) icon button. All icon buttons
  40px, `--ink-2`, hover `background rgba(44,40,33,.05)` + `--ink`.
- **View tabs** (Month/Week/Day/Agenda/Tasks): a segmented control —
  `background rgba(44,40,33,.045)`, padding 4px, `border-radius:12px`. Each tab
  32px tall, `border-radius:9px`, 13.5px/500, `--ink-2`. Active tab: `background
  --panel`, `--ink`, `box-shadow:0 1px 2px rgba(44,40,33,.08), 0 0 0 1px --line`.

### Mini-calendar (sidebar card)
- Header: `‹` nav, `May 2026` title (serif bold month + lighter year), `›` nav.
- 7-column weekday row (M T W T F S S, 10.5px/600 `--ink-3`) + 6-row day grid.
- Day cells: `aspect-ratio:1`, 12.5px tabular, `border-radius:9px`, hover
  `background rgba(44,40,33,.06)`. Out-of-month days: `--ink-3`, opacity .55.
  **Today**: `background --accent`, white, weight 600.
- `Today` button below the grid: full width, 38px, `border-radius:10px`, text
  `--accent`, `border:1px solid` accent@22%, `background` accent@6%.

### Calendars section
- Uppercase label + `+` button. One row: a custom 17px checkbox (checked =
  `--accent` fill + white tick via clip-path), a 9px color dot, label "Offline
  calendar". 14px text.

### Tasks section (sidebar card)
- Uppercase `TASKS` label + a count **badge** (pill, `background rgba(44,40,33,.07)`,
  `--ink-2`, 11px) + a collapse chevron.
- To-do rows: a hollow 18px **circle** checkbox (`1.6px solid --ink-3`, hovers to
  `--accent`), title (14px, ellipsis), and a right-aligned due date (12.5px tabular,
  `--ink-3`). **Overdue** dates render in rose `#c2697f`.
- `View all →` link centered below (13.5px, `--ink-2`).

### Month grid cell
- Padding `8px 10px 10px`. Right border `1px solid --line-2`; row bottom border
  `1px solid --line`.
- **Day number**: 14px/500 `--ink-2`, in a 28px circle (no fill normally). **Today**:
  circle filled `--accent`, white, weight 600. Out-of-month cells: faint number +
  `background` ink@3%.
- **Today cell** also gets a barely-there warm wash (`--accent` @ 4%).
- Events stacked with `gap:3px`.

### Event chip (`.evt`) — the Accent Rail treatment
The defining detail. Color signals category **without shouting**; text stays in calm
ink. Four variants, all driven by the event's `--c`:

- **Event**: `padding:4px 9px 4px 13px`, `border-radius:7px`,
  `background: color-mix(in srgb, var(--c) 9%, --canvas)`, and a **3px rounded color
  rail** pinned to the left inset (`left:5px; top:5px; bottom:5px`, `background:--c`).
  Title 13px/500 `--ink`. Title truncates with ellipsis.
- **Timed event**: shows a second line of meta (e.g. `12:00 – 14:00 · Cafe Rouge`),
  11.5px `--ink-2`, tabular.
- **All-day / multi-day** (holidays, vacations): same chip but stronger fill
  (`--c` @ 16%), rail kept.
- **Recurring**: a small ↻ glyph (12px stroked SVG, `--ink-3`, opacity .7) on the
  right of the chip.
- **Task chip**: **no fill, no rail.** Leads with a 15px rounded-square **checkbox**
  bordered in the user's color (`1.6px solid color-mix(--c 60%, --ink-3)`). When
  checked: box fills `--c` with a white tick, and the title gets `line-through` +
  `--ink-3`. This is what makes to-dos read differently from events.

### Footer
`Privacy` · `GitHub` links, 13px `--ink-3`, hover `--ink`.

---

## Interactions & states
- Hover states defined per component above (icon buttons, tabs, nav, mini-cal days,
  to-do rows, Today button). All transitions ~`.12–.14s`.
- The prototype is **static** (no click handlers wired). Expected real behavior:
  - `‹` / `›` navigate months; `Today` returns to current month.
  - View tabs switch Month/Week/Day/Agenda/Tasks.
  - Clicking a day / event opens detail or create (per product spec — not designed here).
  - Task checkboxes (sidebar + chips) toggle done → strikethrough + filled check.
  - Calendar checkbox toggles that calendar's visibility.
- No responsive/mobile breakpoints are specified — this is the desktop Month view.

## Data model
`calino/data.js` is the single source of truth and documents the shape the renderer
expects:
- `events`: keyed by ISO date (`"2026-05-05"`) → array of items.
  - Item: `{ title, color (hex), type: 'event' | 'task', recur?, allday?, done?, time?, location? }`.
- `tasks`: sidebar to-do list → `{ title, due, overdue }`.
- `today` (ISO), `month` (0-indexed), `year`, `taskCount`.
`calino/render.js` shows exactly how each field maps to markup and which CSS classes
toggle each state (`is-task`, `is-recur`, `is-allday`, `is-done`, `is-today`,
`is-out`).

## Assets
- **Font**: Newsreader (Google Fonts). No image assets — all icons are inline SVG
  (chevrons, search, recurring ↻, display, gear, checkmarks). The brand mark is a
  CSS-drawn diamond, not an image.

## Files in this bundle
- `Calino Month View.html` — entry point; renders the final design full-window.
- `calino/base.css` — design system: tokens, shell, top bar, sidebar, grid, chip skeleton.
- `calino/themes.css` — the Accent Rail chip treatment (event / task / all-day / recurring).
- `calino/data.js` — sample data + the data shape.
- `calino/render.js` — reference renderer (vanilla JS) mapping data → DOM + classes.
- `screenshots/calino-month-view.png`, `screenshots/chip-detail.png` — rendered reference.
