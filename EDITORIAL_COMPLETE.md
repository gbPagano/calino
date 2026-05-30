# Editorial Design — All Views Complete

## What Changed

### WeekView.module.css
- Container: warm paper background, rounded panel, card shadow
- Header: white panel background, hairline border
- Week number: 11.5px uppercase, muted ink
- Day headers: 11.5px uppercase names, 14px tabular numbers, accent today badge
- Time column: 11px tabular-nums, muted ink
- Grid cells: light separators, subtle hover
- All-day events: 7px radius, editorial ink
- Tasks footer: white panel, hairline border

### DayView.module.css
- Container: warm paper background, rounded panel, card shadow
- Header: white panel, centered day info
- Day name: 14px uppercase, secondary ink
- Day number: 18px, accent today badge
- Time labels: 11px tabular-nums, muted ink
- Hour rows: light separators
- All-day events: 7px radius, editorial ink
- Tasks footer: white panel, hairline border

### AgendaView.module.css
- Container: warm paper background, rounded panel, card shadow
- Day headers: 14px/500 primary ink, 12px muted date
- Event rows: white panel, 7px radius, card shadow, hover lift
- Event bar: 3px accent color
- Event time: 11.5px tabular-nums, muted ink
- Event title: 13px/500 primary ink
- Task rows: same styling, muted bar
- Task icon: 14px circle/checkmark
- Skip rows: dashed lines, muted label
- Dividers: 1px hairline

## Design Tokens Used
- `--canvas`: #faf8f3 (warm paper)
- `--panel`: #ffffff (white surfaces)
- `--ink`: #2c2823 (primary text)
- `--ink-2`: #6f6a62 (secondary text)
- `--ink-3`: #a39d93 (muted text)
- `--line`: rgba(44,40,33,0.09) (borders)
- `--line-2`: rgba(44,40,33,0.05) (light separators)
- `--accent`: #b07d4f (warm tan)
- `--accent-soft`: #efe7db (accent background)
- `--radius-sm`: 7px (chips)
- `--radius-md`: 11px (buttons)
- `--radius-lg`: 16px (panels)
- `--shadow-card`: 0 1px 2px... (card elevation)
- `--shadow-event`: 0 1px 2px... (event elevation)

## Verification
- ✅ TypeScript compiles cleanly
- ✅ All 664 tests pass
- ✅ No regressions
- ✅ Editorial.css removed (tokens in theme loader)
