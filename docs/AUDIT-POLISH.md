# Calino Polish Audit Plan

**Version:** 1.0 — **Focus:** Polish (UI/UX consistency, interaction quality, accessibility, performance, code cleanliness)
**Scope:** Frontend only (`src/`). No CalDAV/CardDAV protocol behavior changes unless they surface as UX bugs.

> "Polish" = the difference between *works* and *feels good*. This audit is about finding and fixing the small inconsistencies, janky transitions, accessibility gaps, and code smells that cumulatively make the app feel unrefined.

---

## 0. How to use this plan

Each section is independently actionable. Work top-to-bottom for a systematic pass, or cherry-pick by priority.
Every finding should produce:

1. A **Finding** (what's wrong + where + evidence)
2. A **Fix** (concrete change)
3. A **Verification** (manual repro / test / screenshot before-after)

Add findings inline under each section as you go. Check the box when verified fixed. Do not check based on "looks fine" — always confirm via build (`pnpm check`) + visual check in dev.

---

## Priority tiers

- **P0 — Ship-blockers**: crashes, broken core flows, accessibility violations that block use.
- **P1 — Visible polish**: things a user notices in the first 5 minutes (alignment, fl/jank, inconsistent spacing, focus states, empty states).
- **P2 — Refined polish**: things a discerning user notices (motion timing, microcopy, keyboard consistency, color contrast edges).
- **P3 — Internal hygiene**: code smells, dead CSS, duplication that doesn't affect users directly but slows future polish work.

---

## 1. Visual & design consistency

### 1.1 Spacing & layout tokens
- [ ] Audit all hardcoded `px`/`rem`/`gap`/`padding` values across CSS modules. Are spacing values sourced from a shared scale, or ad-hoc?
- [ ] Check `index.css` token set — is there a `--space-*` scale? If not, consider introducing one and migrating the most-duplicated values.
- [ ] Verify `--sidebar-width`, `--header-height`, `--mobile-breakpoint` are used consistently (note: `config.ts` has `MOBILE_BREAKPOINT` — confirm CSS media queries match it; `App.css` already has a comment about this, verify it holds everywhere).

### 1.2 Color & theming
- [ ] Cross-reference every `var(--color-*)` usage against `themes/built-in.css`. Find colors used in code that aren't defined as tokens (grep for raw hex/rgb in `.module.css`).
- [ ] Verify light + dark themes both pass for every view (month/week/day/agenda/todo/journal/contacts/settings/setup). Screenshot matrix.
- [ ] Check contrast ratios on: muted text (`--color-text-secondary`/tertiary), event card text on colored backgrounds, sidebar mini-calendars, disabled states. Target WCAG AA (4.5:1 body, 3:1 large).
- [ ] Event color palette (`lib/eventColor.ts`) — confirm colors render acceptably in both themes and on the agenda list + week grid + month chip.

### 1.3 Typography
- [ ] Font-size scale: are headings/buttons/body using a consistent set, or ad-hoc `font-size` declarations? Grep `font-size:` per module.
- [ ] Truncation: events with long titles in week/day/month — confirm `text-overflow: ellipsis` + tooltip/preview on hover. Test with a 200-char title.
- [ ] Number/tabular alignment in time columns (week/day) — consider `font-variant-numeric: tabular-nums` for time labels.

### 1.4 Iconography
- [ ] Inventory all inline `<svg>` usage. `MobileFAB` in `App.tsx` has 5 inline SVGs; check how many more exist across features.
- [ ] Consolidate into `components/common/icons.tsx` (or a per-feature icon file) with consistent `size`/`strokeWidth` props and `aria-hidden` + titles for meaningful icons.
- [ ] Verify every interactive icon-only button has an `aria-label`.

---

## 2. Interaction & motion quality

### 2.1 Transitions
- [ ] Confirm motion durations follow the AGENTS convention (200–300ms CSS, framer-motion for complex). Grep `transition:` and `duration:` for outliers (<100ms = jumpy, >400ms = sluggish).
- [ ] `ViewLoader` uses 150ms opacity fade — confirm lazy `Suspense` fallback (`CalendarSkeleton`) doesn't flash on slow loads *and* doesn't delay on fast loads.
- [ ] Hover/active/focus-visible states exist on every clickable surface (buttons, cards, list rows, calendar cells). Pay attention to *active* (press) feedback on touch.
- [ ] AnimatePresence usage — ensure `exit` animations don't leave the app in a state where clicks pass through a fading overlay (z-index/pointer-events).

### 2.2 Keyboard
- [ ] Two global `keydown` handlers in `App.tsx` (`useViewManager` + `CalendarApp`). Audit for conflicts, double-handling, and inconsistent "ignore when typing/modal/overlay" guards (currently duplicated — extract a shared `isTypingTarget`/`isShortcutAllowed` helper).
- [ ] Document the full shortcut set in `ShortcutsHelp` and confirm it matches actual behavior. Drift here is a classic polish miss.
- [ ] Tab order: modals (EventModal, JournalDayModal, RecurrenceDialog, AddCalendarModal, DeleteDialog) — confirm focus trap, initial focus, and Escape-to-close (Escape currently handled only for `/settings`).
- [ ] `>` / `<` wrap around the view list — is that intended? It's a polish decision; confirm and document.

### 2.3 Touch & mobile
- [ ] Hit-target audit: every interactive element ≥ 44×44 CSS px (buttons, checkboxes, FAB options, mini-calendar days, event drag handles).
- [ ] Pinch-to-zoom on week/day — confirm it doesn't fight browser zoom and that `useGestures` doesn't double-handle.
- [ ] Mobile FAB menu: confirm it dismisses on outside-click, Escape, and route change. Check stacking vs modals.
- [ ] Safe-area insets (`--safe-area-*`) actually applied to header, FAB, sidebar, bottom bars — verify on a notched-device simulation.

### 2.4 Loading & empty states
- [ ] Every async list (events, tasks, contacts, search results, calendars) has a `Skeleton` *and* an `EmptyState`. Inventory with `components/common/EmptyState.tsx` + `Skeleton.tsx`.
- [ ] Empty-state copy: is it helpful and consistent in tone? (e.g. "No events" vs "Your agenda is clear" — pick one voice.)
- [ ] Error states: does every data-fetching surface show a recoverable error UI (not just a toast)? Check `ErrorBoundary` coverage per view.

---

## 3. Accessibility (a11y)

### 3.1 Structural
- [ ] Run an axe-core pass (browser extension or `@axe-core/playwright`) on each route. Triage all critical/serious.
- [ ] Landmarks: `<main>`, nav/header roles present and unique. Sidebar should be a `complementary`/`aside` with an accessible name.
- [ ] Heading hierarchy: one `h1` per view, logical `h2`/`h3` nesting. Calendar grids — confirm day cells use a sensible role (`gridcell`/`button`) and are keyboard-navigable.

### 3.2 Interactive
- [ ] All custom widgets (recurrence picker, color picker, context menu, command palette, FAB menu) follow a WAI-ARIA pattern or have a documented equivalent.
- [ ] Focus management on view switches, modal open/close, undo toasts.
- [ ] Color is never the only signal (event category, completed tasks, sync status) — add icon/text/checkbox.
- [ ] `prefers-reduced-motion`: confirm `useReducedMotion` actually gates framer-motion + CSS animations app-wide (not just in one or two components).

### 3.3 Forms
- [ ] Every `Input` (`components/common/Input.tsx`) has associated `<label>`/`aria-labelledby`. EventFormFields, ContactFormFields, settings forms — audit each field.
- [ ] Required-field indication + inline validation messaging consistency.
- [ ] `<select>`/date inputs — confirm they're keyboard-operable and announce changes.

---

## 4. Performance

### 4.1 Render hot paths
- [ ] Calendar grids (month/week/day) re-render on every store change? Profile with React DevTools profiler while dragging / navigating. Look for selectors returning new array references each call (Zustand anti-pattern).
- [ ] `events.find(...)` in `PreviewPopupWrapper` and similar — O(n) lookups in render. Confirm event counts are bounded; consider a `Map` index in the store if not.
- [ ] `useCalendarStore` selector breadth — over-selecting causes re-renders. Audit the big consumers (`CalendarGrid`, `WeekView`, `Sidebar`).

### 4.2 Bundle & lazy-loading
- [ ] Confirm each view chunk is truly lazy and not pulled into the main bundle (check `pnpm build` output sizes). `ContactsView`, `JournalView`, `SetupPage` are heavy — verify they split cleanly.
- [ ] `ical.js`, `tsdav`, `rrule` — are they in the main chunk or code-split behind CalDAV/settings? Move sync-heavy deps out of the initial bundle.
- [ ] Inspect `vite.config.ts` manual chunks if any; consider splitting vendor groups.

### 4.3 Assets & CSS
- [ ] Images in `public/` — are PNGs optimized? (`sharp` is a devDep — is it actually used in a script?) Check `og-image.png`, `web-app-manifest-*` sizes.
- [ ] CSS: 14k total lines. Run [PurgeCSS-style analysis] or grep for unused class names per module (high effort — sample the biggest: Settings, Sidebar, EventModal).
- [ ] `index.css` global vs CSS Modules — confirm no accidental global leakage from feature modules.

---

## 5. Code quality & hygiene

### 5.1 Component size
- [ ] `EventModal.tsx` (47 KB), `CalendarGrid.tsx` (40 KB), `Sidebar.tsx` (35 KB) — break into subcomponents where reasonable. Goal: each file <300 lines of *logic* (presentational sub-splits optional).
- [ ] Identify dead props / unused exported subcomponents across `features/*/index.ts` barrels.

### 5.2 State & effects
- [ ] Audit `useEffect` deps for stale-closure risks (the `currentViewRef` dance in `useViewManager` is a smell — document or simplify).
- [ ] Optimistic-update + CalDAV queue: confirm rollback on failure shows a clear toast and doesn't leave ghost events.
- [ ] Persisted Zustand stores — confirm migrations exist for any breaking schema change (search for `version:`/`migrate:` in store files).

### 5.3 Error handling
- [ ] Custom error classes per AGENTS — confirm they're actually used in CalDAV/CardDAV/NLP paths and surface user-friendly messages (not raw `e.message`).
- [ ] `ErrorBoundary` — does it have a reset affordance (retry button) or just a static message?

### 5.4 Consistency / lint
- [ ] Run `pnpm lint` and `pnpm typecheck` clean. Triage warnings, not just errors.
- [ ] Import ordering (AGENTS specifies React → External → Internal → Types → Styles) — verify with a grep spot-check across recently-touched files.
- [ ] `any` usage: AGENTS allows it only for incompatible third-party types (e.g. cached CalDAV calendars). Grep `: any` and `as any` — justify each.

---

## 6. Microcopy & content

- [ ] Button labels consistent: "Save" vs "Create" vs "Add" — pick per context and apply globally.
- [ ] Toast messages: tense and tone consistent ("Event deleted" vs "Deleted event" vs "Removed"). Check `lib/toast.ts` + sonner calls.
- [ ] Empty/error/loading copy reviewed for tone.
- [ ] Settings labels: do descriptions match what the toggle actually does? (Settings is a polish hotspot — 1612 lines of CSS.)

---

## 7. PWA / install / notifications

- [ ] Manifest (`public/manifest.json`) icons + maskable icon present; install prompt works on Android + iOS.
- [ ] Notification permission flow: ask *in response to a user action*, never on load. Check `useNotifications` + `lib/notifications.ts`.
- [ ] Service worker is disabled by default per AGENTS — confirm it stays disabled for GH Pages build and that self-host enabling is documented and tested.
- [ ] Offline: what does the app show with no network? CalDAV errors should be graceful, not a white screen.

---

## 8. Cross-cutting final pass

- [ ] **Screenshot matrix**: every view × light/dark × desktop/mobile. Review side-by-side for drift. This is the single highest-value polish step.
- [ ] **First-run experience**: clear browser storage, load app, walk onboarding → add calendar → create event → sync. Note every jank.
- [ ] **Reduced-motion + high-contrast OS modes**: render the app with both enabled.
- [ ] **i18n readiness** (even if not localized): are strings hardcoded in JSX? Grep for obvious user-facing literals to gauge future localization cost. (Informational only — not a fix target unless requested.)

---

## Output template per finding

```
### [Pn] <short title>
**Where:** `src/path/to/file.tsx:NN`
**Evidence:** <screenshot / profiler trace / axe result / grep count>
**Fix:** <concrete change>
**Verify:** <how to confirm — manual repro + `pnpm check`>
```

---

## Suggested execution order (one PR per tier is ideal)

1. Run the **§8 screenshot matrix** first — it surfaces 80% of P1 findings.
2. Sweep **§3.1 axe-core** — gives a concrete P0/P1 list for free.
3. **§2.2 keyboard** + **§1.4 icons** — high-visibility, low-risk consolidation.
4. **§4.1 render hot paths** + **§4.2 bundle** — measurable perf wins.
5. **§5.1 large components** + **§5.4 lint/any** — hygiene that unblocks future polish.
6. **§6 microcopy** + **§2.4 empty states** — last, since they depend on structure being settled.
