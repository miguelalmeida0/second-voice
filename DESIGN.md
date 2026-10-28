---
name: Second Voice — Duet
description: A compact cream original and forest rewrite workspace.
colors:
  cream: "#eeeee0"
  forest: "#2a3c32"
  apricot: "#ee9965"
  muted: "#536452"
  light-muted: "#c4ceb9"
  disabled: "#3b5042"
  control-border: "#647665"
typography:
  heading: "600 24px/1.15 Inter"
  original: "400 16px/1.5 Inter"
  rewrite: "400 16px/1.5 Source Serif 4"
  utility: "400 12px/1.5 Inter"
spacing: [8, 12, 16, 24]
---

# Second Voice — Duet

## Current composition — 28 October 2026

The original editor occupies the cream left half; the rewrite occupies the forest right half. The background division stays at the viewport midpoint. Controls must not cross into the cream side. Supplied desktop wordmark and mobile icon remain unchanged.

The writing surfaces are the main content. Both start directly below compact headings and a single settings/context row. Do not reserve multiple empty rows above the draft to match stacked right-hand controls. Do not move settings into a full-width colored banner.

### Desktop, 768px and wider

One centered shell, two equal columns, one native document scroller. The current responsive shell gutters and center gap remain in use.

Five shared grid rows:
1. Left: “Your words.” Right: “Another voice.”
2. Left: short writing hint, character count, Clear. Right: Mode, Author and Strength; Outcomes replaces Author/Strength with its outcome selector.
3. Original and rewrite surfaces with matching top and bottom edges.
4. On the left, Rewrite aligned to the draft’s right edge, availability/recovery beside it, then quick starts.
5. Privacy and legal links.

Mode and author/outcome use StudioSelect comboboxes with persistent labels, forest listboxes, apricot selected checkmarks and chevrons inset 12px from the right edge. Menus overlay the page without shifting the aligned editors. Strength retains the native range and the existing 0/50/100 values. All canonical authors/outcomes and existing change handlers remain available. Settings preserve the draft and previously returned text.

The action is 10.25rem wide (164px at the default text size) and at least 40px tall on desktop; it sits 12px below the original editor, aligned to its right edge. Its width scales with enlarged text, and the action row can wrap without overlap. It follows growing writing surfaces in native document flow. Allowance messages must not enlarge the heading or create a blank area above the source.

### Mobile, below 768px

Source and its action/availability row come first, followed by the output heading, compact settings and result. Preserve the adaptive single-node action dock, safe-area spacing, keyboard avoidance and fallbacks for short screens, enlarged text and oversized focused editors. Touch controls are at least 44px tall. At 480px and below, and in narrow 768–900px split layouts, Mode and Author share one row and Strength uses a compact full-width row so selected names remain readable. Avoid duplicating the Rewrite button or changing selected values across breakpoints.

### Type and spacing

Keep the existing Inter UI/source and Source Serif returned-prose pairing. Headings are 24px; original and returned text are 16px. Utility labels are 12px, with sufficient contrast. Use 8/12/16px gaps around controls and 14px padding inside the writing surfaces. Minimum text-surface height is 128px; content grows naturally. Larger output can increase the shared writing row without introducing an internal textarea scrollbar.

### States

- Empty output: “Your rewrite will appear here.”
- Draft present: “Choose a voice, then rewrite.”
- Empty input: action disabled; source stays editable.
- Ready: apricot action, forest text; one rewrite per activation.
- Requesting: existing loading label/spinner, synchronous duplicate-request protection and disabled settings. Preserve the draft.
- Disabled by allowance/availability: muted forest button with readable light text and border; exact server-derived explanation in the support row. Never imply enabled state through the active orange treatment.
- Failure: existing error and permitted recovery; do not fabricate quota restoration or retry automatically.
- Completed: preserve copy, review changes, accept-all, undo/reset, and rewritten text. Accept-all becomes inactive once no changes remain.
- Clipboard success is announced only after a successful write; preserve manual-copy fallback.

### Access and behavior

StudioSelect supports arrows, Home/End, type-ahead, Enter/Space, Escape, Tab and outside-click dismissal. Focus stays on the trigger; opening and cancellation preserve the current selection. An intentional bounded listbox scroll region keeps long menus inside the viewport. Range announces the selected percentage and author-specific mood. All fields have accessible labels and visible focus. The action references its availability explanation. Help retains its dialog semantics, Escape, focus trap and focus return. Reduced motion disables nonessential playback/movement.

Authentication, allowance, provider, challenge, idempotency and spending policies are unchanged. Lab remains gated by actual availability; do not expose an entry to its disabled live endpoint.

### Release checks

At 1024×640, 1280×720 and 1512×738, verify text panels align, controls stay in the forest half, editors begin within 300 CSS pixels of the page top, and the action remains fully visible before interaction. Check empty/filled/long drafts, both modes, loading, results, exhausted allowance and recoverable errors. Inspect mobile at 320px and 390px, keyboard focus, enlarged text and the page bottom. No horizontal scrollbar or development indicator. Run the repository scroll guard and interaction regressions; geometric checks do not replace visual inspection.
