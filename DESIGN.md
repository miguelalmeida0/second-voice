---
name: Second Voice — Duet
description: An editorial writing workspace pairing a cream original with a forest rewrite.
colors:
  cream: "#eeeee0"
  forest: "#2a3c32"
  sage: "#dfe5d0"
  apricot: "#ee9965"
  muted: "#536452"
  light-muted: "#c4ceb9"
  line: "#b9c3ab"
  forest-line: "#647665"
  forest-control-line: "#7f917b"
  apricot-hover: "#f5aa78"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(36px, 3.8vw, 56px)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-0.04em"
  original:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(22px, 2vw, 28px)"
    fontWeight: 400
    lineHeight: 1.4
  rewrite:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, serif"
    fontSize: "clamp(22px, 2vw, 28px)"
    fontWeight: 400
    lineHeight: 1.28
  dialog-title:
    fontFamily: "Source Serif 4, Source Serif Pro, Georgia, serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.15
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  action:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  flat: "0"
  prompt: "4px"
  account-field: "8px"
  panel: "12px"
  pill: "100px"
spacing:
  compact: "8px"
  small: "12px"
  control: "16px"
  mobile-gutter: "20px"
  regular: "24px"
  reading: "32px"
  desktop-gutter: "40px"
  output-action-space: "48px"
  tablet-column-gap: "56px"
  desktop-column-gap: "80px"
components:
  button-primary:
    backgroundColor: "{colors.apricot}"
    textColor: "{colors.forest}"
    typography: "{typography.action}"
    rounded: "{rounded.panel}"
    padding: "16px 24px"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.apricot-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.apricot}"
    textColor: "{colors.forest}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.light-muted}"
    typography: "{typography.label}"
    padding: "8px 12px"
  choice:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  choice-selected:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.cream}"
  composer:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    typography: "{typography.original}"
    rounded: "{rounded.flat}"
    padding: "0"
  control-plane:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.forest}"
    rounded: "{rounded.panel}"
    padding: "20px 24px"
  help-panel:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.forest}"
    rounded: "{rounded.panel}"
    padding: "28px"
---

# Design System: Second Voice — Duet

## Current reference: Preview first (2026-10-05)

Latest correction on 2026-10-05: the initial right panel is a concise three-step guide that adapts to the selected mode. Surprise me, See an example, the repeated selected-voice sentence, the allowance explanation, and the optional account-trial nudge are removed. Authors and Outcomes form a full-width two-button switch above their choices, with short purpose labels and a cream selected segment that glides between modes. Selection uses fill and text contrast without a checkmark; reduced motion disables the transition. This supersedes the older preview and action-copy descriptions below. Changing settings preserves an existing result. Desktop uses shared grid rows for the heading, voice toolbar, text canvas, and supporting controls, so draft and rewrite panel edges align even with wrapped choices or long content. Result metadata and optional lab controls sit below the prose; the redundant author-review sentence is hidden in this workspace. Mobile retains the stacked flow and adaptive action dock.

The user's new screenshot supersedes the shared sage control plane described below. The current desktop workspace puts a rounded paper draft and quick starts on cream, and voice choices, a prepared sample preview, three strength positions, and the rewrite action on forest. The split is slightly left of center; desktop gutters scale from 28 to 56px. A short-screen variant reduces heading and preview density. Mobile stacks the draft and forest workspace, uses two author columns through 430px, and retains the single adaptive action dock with keyboard, short-screen, long-editor, and enlarged-text fallbacks.

The sample preview is explicitly labeled and never uses the draft or an API. Surprise me changes only its voice/strength or outcome, without changing the draft or spending allowance. “Rewrite my draft” is the explicit generation action. A completed result remains mounted while previews are explored, with “Back to your rewrite” restoring it. The six original quick starts remain under “More quick starts,” alongside the new Team update, Birthday card, and Apology choices. Outcomes, account, help, legal links, recovery, and optional result features remain available.

The following original Duet notes describe the preceding design where they conflict with this section. Current implementation is in the final “Preview first” block of `src/app/duet.css`; verification is recorded in `PREVIEW-FIRST-REPORT.md`.

## Overview

**Creative North Star: "Duet"**

Second Voice gives the original and rewritten text distinct, equally legible places. Warm cream supports composition; deep forest supports reading the second voice. Pale sage joins the writing controls and apricot identifies the rewrite action. The interface is quiet, flat and editorial, with generous space around text and restrained rules.

The approved supplied raster remains the visual authority, with the user's later action-placement and laptop-density instructions superseding its floating Rewrite treatment and original scale. This record describes the implemented CSS and components; it is not a new concept or a release approval. The exact surface composition and implementation evidence are recorded in `.impeccable/surfaces/second-voice.md`. The product's authentication, allowance, privacy and request contracts constrain how states are presented.

**Key Characteristics:**
- Cream composition and forest reading surfaces.
- Sans-serif originals and controls, serif rewritten text.
- A shared sage control plane containing the apricot action, with one adaptive mobile dock.
- Native document scrolling and content-driven height.
- Visible state, focus and recovery without decorative noise.

## Colors

A muted green and warm paper palette separates writing, reading and action without gradients.

### Primary
- **Forest:** rewritten-text canvas, primary ink on light surfaces, selected choices and range thumb.
- **Apricot:** Rewrite action in enabled, disabled and loading states, text selection and inserted rewrite passages; also identifies copy-error text on forest.
- **Apricot hover:** enabled primary-action hover.

### Secondary
- **Sage:** shared control plane, supporting account controls and authentication messages.

### Neutral
- **Cream:** original-writing canvas, legal/account/sign-in shells and primary text on forest.
- **Muted:** secondary text on cream and sage.
- **Light muted:** secondary text and copy actions on forest.
- **Line:** quiet light-surface dividers, choice borders and mood track.
- **Forest line / forest control line:** divisions and secondary action borders on forest.

**The Surface Contrast Rule.** Use forest ink on cream or sage, and cream or light-muted ink on forest. Reassign secondary text with its surface.

## Typography

**Display and control font:** Inter, with system-ui and sans-serif fallbacks.
**Reading font:** Source Serif 4, with Source Serif Pro, Georgia and serif fallbacks.

Large sans-serif headings keep the two canvases aligned. Rewritten prose carries the editorial serif contrast. `layout.tsx` supplies the fonts through Next font variables; the Duet layer overrides legacy font utility names where they remain in component markup.

### Hierarchy
- **Display:** the two workspace headings use the reduced display token for windowed laptops. Mobile uses `clamp(32px, 8vw, 40px)`.
- **Original:** the original token follows the growing textarea; mobile fixes its font size at 22px.
- **Rewrite:** the rewrite token handles both animated and complete prose with wrapping preserved. The empty state uses a quieter 24px serif with 1.5 line height.
- **Dialog title:** the dialog-title token marks the help heading.
- **Label and action:** compact sans-serif UI; labels remain secondary to the draft and result.

**The Two Texts Rule.** Keep original text sans-serif and rewritten prose serif. Do not use a display font to distinguish author choices; selection is typographic text in a pill.

## Layout

The workspace uses two equal desktop tracks with an 80px gap inside a centered shell capped at 1600px, with 40px side padding. The forest background starts at the viewport midpoint. The compact header has 16px top padding and 60px minimum row height; the workspace starts 24px below it. The original field starts after 24px with a 96px minimum height. Output uses a 168px playback minimum height with 48px bottom padding for its action. These reduced sizes and gaps implement the user's windowed-laptop density request while retaining content-driven growth.

The sage control plane starts 24px below the canvases. At 1200px and above, its grid is `minmax(0, 1.35fr) minmax(0, .85fr) minmax(260px, 280px)` with a 32px gap: voice, mood/direction, then the action column. Rewrite fills that column inside the plane; there is no negative-margin overlap. From 768–1199px, voice and mood/direction share two equal tracks and the actions occupy a separate full-width row with a thin top rule, 16px top padding and a 32px column gap. The nested action row pairs `minmax(260px, 1fr)` with `minmax(0, 1fr)`.

The narrower comparison-shell adjustment remains 768–1100px: 28px gutters, a 56px canvas gap, tighter navigation and choice padding, and 20px control-plane side padding. This is distinct from the 1199px action-layout breakpoint. Mobile (up to 767px) uses original → controls with actions → forest output, 20px shell gutters, edge-to-edge control/output planes and a single control column. The control plane uses 16px top margin, 16px gaps and 16px 20px padding; mobile output uses a 150px minimum playback height.

On mobile the same primary action node may dock at the viewport bottom, with sage backing, a top rule, 8px minimum vertical padding and safe-area-aware 20px minimum side padding. Docking requires visual viewport height of at least 480px, no keyboard-height reduction below 75% of the layout viewport, root text below 24px, and an action no taller than 36% of the visual viewport. A focused textarea taller than the available height minus the action and 48px also returns it to normal flow. Short screens, enlarged text, keyboard use and oversized focused editors therefore retain the in-flow action. When docked, measured action height plus 24px reserves page clearance and scroll padding, and focus is revealed above the dock. Automatic result scrolling occurs only while the mobile action is docked, with reduced motion respected.

Preserve one native document scroller. Use horizontal clipping for page containment, retain the horizontal-only scrollbar guard, and keep the composer auto-growing with no resize handle or internal scrolling. Help is the intentional modal exception with its own bounded content region and focus handling. Keep `devIndicators: false` to prevent the bottom-left development portal artifact.

## Elevation & Depth

The workspace relies on color planes and thin borders. Original, rewrite, controls, choices and primary action do not use floating-card shadows. The help dialog is the deliberate exception: its `0 16px 60px #10251b30` shadow separates an overlay from the work beneath it, with a `#10251b66` backdrop and no backdrop blur.

**The Flat Workspace Rule.** Use tonal planes for the main workspace; reserve overlay depth for the help dialog.

## Shapes

The text canvases are square and unboxed. Controls, help and Rewrite use the panel radius; author/outcome choices and the sign-in action retain the pill radius, and quick-start choices use the small prompt radius. Account fields retain their compact rounded shape. On mobile the shared control plane and dock backing become edge-to-edge square surfaces. Thin rules organize content without enclosing every piece of text.

## Components

### Buttons

Rewrite is an apricot rounded rectangle with forest text, a 56px minimum height, the primary action token's padding and a trailing SVG arrow. It fills the desktop action column or intermediate/mobile action region. Hover uses apricot-hover; disabled and loading retain apricot, forest and full opacity. The label is “Rewrite text”, “Rewriting…” while requesting, or “Rewrite again” after a completed result. Loading replaces the arrow with the existing loader icon; text may wrap without clipping. Empty input exposes “Add text to enable rewriting.” in a reserved 1.5em hint row. The first sentence of the real allowance/status message remains beside the primary action; remaining detail and Surprise me stay in normal flow. Mobile includes the current author/outcome above the action. Copy is a quiet text-and-SVG action on forest, with a 44px minimum height; confirmation keeps the action position. Try another rewrite remains an underlined secondary action in the result.

Keyboard focus in the studio uses a 2px current-color outline with 4px offset. Preserve visible focus on both canvases and avoid replacing it with a diffuse glow.

### Choices and mode controls

Author and outcome choices are text-only wrapping pills with 44px minimum height and a 1px line border. Selected choices use forest fill and cream text. Hover strengthens the border. Authors / Outcomes use real buttons with pressed state and underline selection; do not require portraits to identify a voice.

### Inputs and shared control plane

The composer is transparent and borderless, with a visible focus-within outline, an accessible label, character count and Clear text action. Preserve the 2,000-character limit and original line breaks. The native mood range has a 44px control area, a 2px track and 12px forest thumb, with real endpoints and the current percentage. Outcomes substitute the selected writing direction for author mood.

The sage plane joins voice, mood/direction and actions across the desktop canvases. It is a shared working surface, not a collection of floating cards. The action component is rendered once inside this plane; mobile docking repositions that node without duplicating the CTA. Quick Starts remain a secondary disclosure with wrapping choices that populate the editor.

### Navigation and identity

A compact SVG mark and Second Voice name anchor the cream side. Help, Account and session-dependent identity controls sit on the forest side at desktop widths. Mobile moves navigation to its own cream row. Links and buttons retain practical 44px target heights. Account, sign-in and legal shells use cream, forest ink and serif reading headings without adopting the comparison split.

### Playback, status and recovery

Requesting presents a real waiting state and preserves the original in the editor. Prelude and edit animation begin with returned rewrite data; do not present these client playback phases as backend progress. Inserted text is apricot; removed text is muted and struck through. Skip animation and reduced-motion behavior remain available.

Copy confirmation is shown only after clipboard success. Failure announces that copying failed and gives manual-copy guidance. Preserve real provider, validation, allowance and authentication recovery semantics. Public sharing remains explicit; a generated public link and a successfully copied link are distinct states.

### Help panel

The cream panel uses the dialog-title role, restrained border, sage supporting buttons and the sole overlay shadow. Desktop width is capped at 500px; mobile uses the available width, a dynamic-viewport height limit and safe-area padding. Retain dialog announcement, focus trap, Escape handling, focus restoration and scroll locking.

## Do's and Don'ts

### Do:
- **Do** preserve cream originals, forest rewrites, sage controls and apricot primary actions.
- **Do** retain one native document scroller and grow the composer with its content.
- **Do** preserve keyboard operation, visible focus, reduced motion and practical 44px targets.
- **Do** present actual request, allowance, authentication and clipboard states truthfully.
- **Do** use the approved raster with the user's later action-placement and density overrides; keep feature references for product behavior only.
- **Do** keep Rewrite inside the sage plane and use one mobile action with measured clearance and in-flow fallbacks.

### Don't:
- **Don't** introduce glass, neon, purple, blue accents, AI gradients, decorative orbs or unnecessary illustrations.
- **Don't** compress the desktop split into two narrow phone columns.
- **Don't** add nested page scroll regions, broadly hide vertical scrollbars or weaken the horizontal artifact guard.
- **Don't** invent backend progress stages, authentication outcomes, clipboard success or release approval.
- **Don't** turn the existing section indices or legal/loading kickers into a reusable decorative label system.
