# FOCUS OS PRO — FOREST NOIR V4
## Master design and implementation brief for Codex

**Target:** existing local Electron + React + TypeScript + SQLite desktop application for Windows. This is a design system and UI/UX overhaul, NOT a rewrite of application logic. Keep ten existing sections and user data. Do not add Habits or Finance.

## 0. Non-negotiable workflow
1. Inspect the current codebase, shared components, styles, screenshot baseline, routes, and end-to-end tests before editing.
2. Create a separate `design/forest-noir-v4` branch or worktree; safeguard the user's local database. No destructive DB migrations for styling work.
3. First deliver **three genuinely distinct, implemented** variants of the MAIN DASHBOARD in the running app: A Editorial Forest, B Obsidian Command Center, C Atmospheric Bento. Capture real app screenshots at 1920x1080 and 1366x768 in an isolated demo database (never pollute user data). Differences must include hierarchy, layout, typography and visual treatment, not merely hue.
4. Recommend the strongest variant with concrete rationale; wait for user approval before propagating it to all ten pages. Do not automatically finalize a design direction.
5. After approval, create reusable design tokens/components and refactor page by page. Preserve behavior and test.
6. For each page, deliver **populated and empty** screenshots, plus motion demo recordings for at least task completion, drag/drop, navigation, and command palette.
7. Run TypeScript/lint/unit/integration/E2E/visual regression; run an actual Windows job for the Windows build; distinguish tested from untested. Update IMPLEMENTATION_STATUS.md.

## 1. Research references — curated, not copied
### Eight references EXPLICITLY PRESENT in the user's supplied 25-second video
- https://motionsites.ai — animated hero/background inspiration: use restrained ambient light, atmospheric motion on dashboard and focus screens only; NOT flashy scroll-linked marketing effects.
- https://www.navbar.gallery — navigation inspiration: condensed expandable sidebar, contextual toolbars, search and breadcrumbs for desktop app.
- https://www.footer.design — footer inspiration: adapt to compact app status bar (backup freshness, DB status, keyboard hints); DON'T add a marketing footer.
- https://www.cta.gallery — CTA inspiration: clarify priority action in each view (New task, Start focus, Plan week); DON'T add promotional banners.
- https://www.404s.design — delightful error/empty states: use restrained illustrations, helpful recovery actions, never disruptive 3D.
- https://www.unsection.com — section-wise composition: reusable KPI strips, insights panels, project headers, sectional hierarchy.
- https://bentogrids.com — asymmetrical, coherent bento layouts: dashboard and analytics only; not spreadsheet, calendar or dense lists.
- https://60fps.design — micro-interactions: completion, progress, calendar, drag, empty/success states, keyboard feedback.
### Product references for actual daily usability
- https://linear.app/now/behind-the-latest-design-refresh — prioritize content over sidebar, subtle dividers, visual density, consistent headers.
- https://linear.app/docs/board-layout — list/board view toggles, keyboard-friendly board operations.
- https://manual.raycast.com/quickstart — global command palette, fast actions and shortcuts.
- https://support.strava.com/en-us/articles/15402077-training-log — visual training calendar and per-activity detail.
- Previously identified on Land-book: https://land-book.com/websites/54434-linear-for-startups-linear ; https://land-book.com/websites/97776-nura-a-adaptive-daily-planning ; https://land-book.com/websites/55489-plan-io-to-do-list-by-cansaas-on-dribbble . Treat as inspiration only and inspect actual sources before asserting design details.

Do not copy copyrighted illustrations, screenshots, compositions pixel-for-pixel, brand assets or third-party code. All assets must be licensed for use or originally authored.

## 2. Visual thesis
**Forest Noir — editorial precision, restrained cinema, dark emerald depth.** Not generic neon-green admin UI, not glassmorphism everywhere, not a gaming HUD. Premium and unusually pleasant to use for long sessions.
- Product quality benchmark: Linear's clarity and Raycast's interaction speed, enriched with natural forest atmosphere and tasteful editorial composition.
- 80% quiet function / 15% polished depth / 5% distinctive delight.
- Content always wins over decorative effects.

## 3. Design tokens
Use CSS variables with semantic names; separate neutral layers from accent and status colors.
```
--bg-canvas: #080E0B;
--bg-sidebar: #0C1510;
--surface-1: #101B15;
--surface-2: #16251B;
--surface-3: #1C3023;
--border-soft: rgba(165, 205, 178, 0.09);
--border-emphasis: rgba(165, 205, 178, 0.19);
--text-primary: #F1F7F2;
--text-secondary: #9FB7A7;
--text-muted: #718B7A;
--accent-primary: #73D99B;
--accent-active: #9AEAB6;
--accent-deep: #285A3B;
--danger: #EE897F;
--warning: #E9BA72;
--info: #86B8D8;
--focus-ring: #9AEAB6;
```
Other UI tokens: 4/8pt spacing grid; radii 8 (controls), 12 (cards), 18 (hero); shadows subtle, mostly dark with negligible green cast; no universal neon outlines. Keep green for salient states and progress, not all text. Use accessible contrast, WCAG AA for primary text and interactive labels. Use typefaces with **full Cyrillic support**; candidates: Inter + Manrope with local installation/licensed redistribution; fallback Segoe UI. Numeric dashboard display uses tabular numerals. Build actual type scale: 11/12 metadata; 13/14 body; 16/18 section; 28/36/44 featured KPIs. Avoid tiny 10px text for dense 1366x768 views. Icons: single consistent 1.75–2px outline stroke, avoid redundant decoration.

## 4. Responsive desktop frame
- Window min size 1100x700; tested layouts 1366x768, 1440x900, 1920x1080, 2560x1440 at Windows DPI 100/125/150%; no cropped content.
- Sidebar: 232px full, 64px collapsed; low contrast inactive items; keyboard shortcut `Ctrl+K` for commands, `Ctrl+N` to add task (when context permits).
- Header: breadcrumb, meaningful context actions, date, global search; consistent across ten pages.
- Content max width ~1680px with adaptive grid; allow wide table/cal grid without giant line lengths.
- Functional bottom status strip only if there is actual status to show; never a marketing footer.
- Layered hierarchy: background, panel surface, raised active card, focus/hover. At most one scenic/atmospheric visual focal point per page.

## 5. Signature visual techniques to implement meaningfully
1. **Atmospheric masthead:** an ORIGINAL, locally bundled forest/mountain panorama or tasteful vector landscape only on dashboard and optional focus. Height 185–250px, dark legibility overlay, no continuous video required, offline safe; provide non-image plain alternative. No third-party hotlinks.
2. **Asymmetric bento:** dashboard: 12-column grid, hero score spans 5, day focus spans 4, week timetable spans 3; second row weekly plan spans 7 / training spans 5; adjust after real layout evaluation. Heights must make sense, not all cards equal.
3. **Data storytelling:** giant useful number + comparison + confidence/definition + small sparkline. Never fabricated activity metrics. Use placeholders labeled DEMO only in isolated demo DB.
4. **Contextual side sheet:** clicking a task opens a 400–500px side panel without losing context, keyboard accessible, scrolls independently.
5. **Smart visual feedback:** checkbox morph + unobtrusive particle/ripple (<300ms), progress chart interpolates and honors reduced motion; calendar drag preview with snapping and clear collision feedback.
6. **Single command center:** fuzzy global search, navigate, create task/project, start focus timer, add workout, jump to subject; keyboard navigation and results grouped by type.
7. **Thoughtful empty/error states:** illustrative but subtle original assets, reason and next action; no dead controls, no fake data.
8. **Focus ambience:** soft concentric rings and dim forest silhouette, optional animations with no flashing/parallax traps.
9. **Microcopy:** concise Russian UI, correct Russian pluralization/time formats, real helpful states, no odd literal translations.
10. **Optional density control:** comfortable / compact for Task, Study, Analytics; saves local preference.

## 6. Exact redesign per page
**01 Dashboard — Command Center**: distinct scenic hero; prominent efficiency KPI with definition and week-over-week delta; daily task progress; TODAY list; miniature day timeline; weekly completion bars; nearest deadlines; workouts this week; focus time; project pulse; meaningful bento composition. Configurable widgets only if actual persistence works. Two states: genuine empty setup and rich isolated demo. A user should grasp priorities in 5 seconds.

**02 Calendar / Planner**: functional calendar dominates above the fold; day/week/month segmented switch, all-day row, 30/60-minute grid, drag/resize feedback, overlapping events stacking, right backlog, load-meter per day, protected academic/travel/training slots. Scene background NONE. Calendar events are never illegibly dark green on dark green. Visible current time line.

**03 Tasks**: mode switch list / board / week; filter chips, saved filters, sortable density, priorities as restrained colored indicators, markdown-free title clarity, project tag, due time, duration, checklist progress, fast add, batch selection, keyboard shortcuts; side-sheet details; undo toast after completion/move.

**04 Projects**: variable-size project cards with progress, milestones, upcoming deadline, current next action; detail view with timeline/Gantt; avoid fake cover pictures, show meaningful icons/identity, nuanced muted accents distinct across project categories.

**05 Study**: no scenic hero. Professional spreadsheet-like tracker based on original 9 subjects and 54 status cells. Frozen subject column, grouped stage headers, keyboard navigation, 3-state cells (done/not done/unknown), compact/comfortable density, clear legend, subject completion KPIs and progress; never merge submitted and defended; preserve source and history; explicit import confidence where mapping uncertain.

**06 Fitness**: calendar + running distance/pace and strength training logs; week totals with real metrics; trend graphs; exercise details with sets/weight/reps; training load indicators; workout templates; rest-day visualization as planned, not failure. Use Strava-like scanability but original styling.

**07 Insights**: analytical canvas with a feature chart, date compare, multi-dimensional views, heatmap, planned vs actual, completion and deadline rates, efficiency composition, chart tooltips, consistent labeling, export, caveats for insufficient data. Charts must have units, axis labels, 0/empty states, accessible colors.

**08 Focus**: immersive yet readable timer, task context, session progress, pause/resume, break controls, recent sessions, completed-focus stats; optional scenic background subdued, no full-screen video requirement.

**09 Notes**: restrained editorial typography, three-pane structure, markdown editing/preview, backlinks/tags/search; accessible editor; avoid hero and excessive cards.

**10 Settings**: organized tabs or sections: appearance, planner logic, keyboard shortcuts, data/backup, privacy, performance, integrations. Clear backup status, real path and last operation; restore confirmation.

## 7. Motion system
- Interaction feedback 100–180ms; panel transitions 180–260ms; meaningful scene transitions <320ms. Stable easing. Prefer compositor-friendly transforms and opacity.
- Animated counters only when values truly change. No continuous glow loops behind tables, no overly bouncy microinteractions. No artificial 3D cursor following.
- Honor `prefers-reduced-motion`, Windows text scaling and high DPI.
- Target 60fps in core interactions on reasonable Windows hardware; benchmark, do not assert without profiling.

## 8. Accessibility and robustness
Keyboard navigation, focus rings, escape-to-close, proper labels, sufficiently large hit targets, tooltip delay, usable screen-reader semantics where applicable. No green-only status distinctions: include text/icons. No data loss. Existing features and DB persist unchanged. No third-party trackers. No dependency on internet for layout or imagery.

## 9. Implementation and sign-off gates
**Gate A — Audit:** capture before screenshots and baseline tests, propose three concrete dashboard variants, record design decision matrix.
**Gate B — Main dashboard:** actual running screenshots for A/B/C at 1920x1080 AND 1366x768, with empty and populated states; user chooses one. Do NOT continue to all pages before selection.
**Gate C — Design foundation:** tokens, typography, icon system, Sidebar, Header, cards, buttons, side-sheets, forms, toasts, charts, empty states, component gallery.
**Gate D — 9 remaining pages:** implement by workflow clusters Calendar+Tasks; Projects+Study; Fitness+Insights; Focus+Notes+Settings. Screenshot & test after each cluster.
**Gate E — QA/Release:** automated screenshot diff and human inspection, overflow audit, keyboard navigation, low-data states, high DPI, Windows E2E and builds; actual ZIP/setup ready; all restrictions plainly documented.

## 10. Visual acceptance criteria (objective)
- Every page has ONE obvious primary focal area/action and a defined scanning path.
- Not more than 2 large highlight cards in a single screen; sidebar notably quieter than content.
- Full 10-page screenshot set, populated/empty at 1920x1080; six core screens at 1366x768; focus states and motion snippets.
- At least 80% of first screen height on calendar/study/tasks is productive workspace instead of headers/decor.
- No truncation of essential task names/status, no overlapping graphs/legends, no illegible font, no fake metrics; visual distinction of priorities/status not dependent on green alone.
- Screenshot comparison against the baseline proves visible redesign, not just color swaps.
- Tests pass, database untouched by preview data, builds open on Windows (or marked unverified), backups restore correctly.

## 11. What to send back after Gate B
Provide (1) A/B/C dashboard screenshots in both resolutions, (2) concise rationale for each, (3) link/path to real locally runnable build, (4) tokens draft, (5) audit of current UI weakness, (6) list of components added, (7) test results and known issues. Then request visual direction approval. This approval gate is deliberate.
