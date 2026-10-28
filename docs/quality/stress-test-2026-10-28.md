# Editor stress-test fixes

Input: `app-exploration-2026-10-28 (1).json`, captured at 21:10 UTC. The report covers seven screen visits (including repeated account/legal visits) and three runs per visit: accessibility basics, longer copy, and enlarged text. All reported findings are on the editor. The account, privacy, and legal visits report none.

## Findings and disposition

| Finding | Cause | Resolution |
| --- | --- | --- |
| Mode/author values clip with long copy | The custom trigger forced one line and hid overflow. | Values wrap within the trigger and keep space for the chevron. The shared component also covers outcomes and review navigation. |
| Mode/author values clip vertically at 200% type | A fixed 16px line height could not contain larger glyphs. | Unitless line heights scale with the text. |
| Account and Sign in overlap in both stress screenshots | Identity was absolutely positioned; navigation reserved a fixed amount of space for it. | Identity participates in the navigation's wrapping flex layout. |
| Rewrite label and arrow leave their button in both stress screenshots | A fixed-width action and a no-wrap label. | The action sizes to content within its available width, then wraps. The existing mobile dock remains supported. |
| Hidden 1×1 sign-in button is reported as a tiny/clipped target | The event bridge used `sr-only`, exposing a duplicate control to assistive technology. | The bridge uses `hidden`; the real header control remains accessible and still starts authentication. |
| Hidden heading, editor label, and action hint appear clipped | These are deliberately visually hidden, accessible names/descriptions. | Retained. Removing them to satisfy a visual heuristic would lose accessibility information. |
| Logo picture reports overflow | The supplied image includes a white canvas; the frame deliberately crops that canvas. | Retained. This is intentional image framing, not clipped UI text. |

## Regression coverage

`npm run test:stress` runs the real portfolio layout with mocked auth and provider responses, so it consumes no production rewrites. It applies longer copy and doubles text-node font sizes at 1512, 768, 390, and 320px in desktop and touch Chromium. It checks dropdown clipping and popup bounds, header collisions, button content bounds, the accessible sign-in flow, and the signed-in icon and touch target. The seven desktop checks were first observed failing before the fixes.

The source report is a heuristic scan, not an accessibility certification. Its omissions include form submission and unclassified buttons. Existing browser tests cover rewriting, author/outcome selection, review decisions, undo/reset/copy, and mobile docking separately.

## Verification

- 16 stress checks passed across desktop and touch Chromium.
- All 80 desktop browser cases passed across the initial run and the focused rerun; all 80 mobile cases passed in one run.
- The two existing responsive logo/native-scroll checks passed.
- 245 unit/security tests and 23 scroll guards passed.
- Production build and TypeScript compilation passed. Lint has zero errors and three pre-existing warnings in release/test fixtures.

The broader run also exposed stale test selectors for the old native menus, an ambiguous status locator in Rewrite Lab, and an incorrect author selector in the portfolio film. These tests now exercise the actual controls. The logo check waits for the editor and image readiness directly instead of blocking on the whole page load event.
