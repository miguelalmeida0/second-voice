# Rewrite discoverability correction

Follow-up: [deep functional parity verification](DUET-DEEP-TEST-REPORT.md) passed 235 browser tests, isolated service integration and quota tests; it also fixed stale clipboard errors and restored Quick starts collapse on Rewrite.

Branch: `design/duet-responsive`, in the existing Second Voice Duet checkout. All prior redesign work is retained. The user's action-layout override and later compact-density request supersede only the relevant geometry of the approved reference. Cream, forest, sage, apricot and the existing font families remain.

## Implementation

- At 1200px and wider, Rewrite occupies a dedicated 280px column inside the right end of the sage controls. At 768–1199px, settings wrap into two columns followed by a deliberate action row. No seam overlap or floating desktop pill remains.
- One primary button appears in DOM order after voice/outcome and mood settings. Its labels are `Rewrite text`, `Rewriting…`, and `Rewrite again`. It stays apricot when unavailable, with the empty-draft explanation or existing allowance/service message. The arrow is decorative. The existing generation guard, retries, Copy, Surprise, authentication and allowance semantics remain unchanged.
- On phones, the same element becomes a full-width bottom action with selected voice/outcome and the actual policy-supplied allowance sentence. The remaining policy explanation stays in the page. No quota is fabricated.
- The dock uses safe-area padding and measured document clearance. It falls back into normal flow below 480px visual height, when the virtual viewport shrinks substantially, at enlarged root text, when the action would take more than 36% of the visible height, or while an oversized composer is focused. Resize and focus changes recheck focused-control clearance. A fallback action does not trigger an automatic scroll to the result.
- Desktop headings now top out at 56px (previously 68px); draft/result text at 28px (previously 34/36px). Smaller header/editor gaps and a 96px minimum auto-growing composer bring the controls into a normal laptop window. Touch targets remain at least 44px and the primary is at least 56px, growing with text.
- Forest/apricot label contrast is 5.24:1. Forest/sage focus contrast is 9.08:1. Tests check rendered text/focus contrast and visible outline thickness.

Primary files: `src/app/duet.css`, `GhostwriterPage.tsx`, `DuetControls.tsx`, `QuickStartsPanel.tsx`, and `useDuetActionDock.ts`. Existing Playwright selectors and layout contracts now reflect the stable labels. `DESIGN.md` and both Impeccable records describe the revised surface.

Long drafts and long results expand the native document. On desktop the action remains inside the same control-bar column/row and can move down with that content; it is not pinned over the result. On mobile the dock remains at the viewport edge when space permits. Copy stays with its result.

## Verification

The initial regression failed on the old UI before implementation; its screenshots are preserved. Commands use Node 22.23.2 via `PATH=/Users/malmeida/.nvm/versions/node/v22.23.2/bin:$PATH`.

| Command | Actual result |
| --- | --- |
| `npm run lint` | PASS, zero errors; three pre-existing warnings in unrelated files |
| `npx tsc --noEmit` | PASS |
| `npm run test:scroll` | PASS, 22/22 |
| `npm run test:security` | PASS, 207/207 |
| `GHOSTWRITER_NEXT_DIST_DIR=.tmp/next-duet-action-build npm run build` | PASS |
| `GHOSTWRITER_NEXT_DIST_DIR=.tmp/next-duet-action-build node scripts/release/test-portfolio-browser.mjs` | PASS, 10 viewport sizes, zero live provider calls |
| `npm run test:e2e -- --workers=2` | PASS, 215/215 across all five projects; 6.5 minutes |

The targeted Chromium action suite passed 4/4. An intermediate 70-test cross-browser run passed 68 and failed two exact-outline assertions: emulated mobile browsers provided a 3px native focus ring instead of exactly 2px. The final assertion checks the actual requirement, a visible ring of at least 2px plus verified contrast. Earlier testing also caught and corrected an empty live-status element, which made existing status assertions ambiguous. No passing result is inferred from those intermediate failures. Logs are `.tmp/duet-action-{lint,types,scroll,security,build,portfolio-final,full-final}.log`.

Coverage includes all requested sizes: 320×568, 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900 and 1920×1080. The existing five projects remain: desktop Chromium, Firefox and WebKit, Pixel 7 Chromium, and iPhone 13 WebKit. Breakpoint checks include 767/768/769, 1099/1100/1101, 1199/1200/1201px and visual heights 479/480/481px, plus the existing broad 320–2560px sweep.

New checks measure the initial action before any click or scroll, exactly one primary, unforced click/tap, rapid repeated activation, request counts, loading/completed anchoring, no clipped labels, horizontal overflow, focused-control and footer clearance, draft and text-selection preservation, author/mood preservation, enlarged text and reduced motion. Long-draft and long-result cases are explicit. Production UI checks use synthetic backend responses and verify allowance, exhausted recovery, 429 cooldown, service/network failures, modal focus, accessibility and scroll integrity without provider calls.

## Before/after evidence

- Desktop: [before](artifacts/duet-action/before/chromium/1280x720.png), [after](artifacts/duet-action/after/chromium/1280x720.png).
- Phone: [before](artifacts/duet-action/before/chromium/390x844.png), [after](artifacts/duet-action/after/chromium/390x844.png).
- Small phone: [320×568](artifacts/duet-action/after/chromium/320x568.png).
- User's actual Chrome window, with their draft preserved: [live window](artifacts/duet-action/after/live-window.png).
- Per-browser result, page-end, enlarged-text and long-result clearance images are under `artifacts/duet-action/after/`.

The independent Impeccable reviewer confirmed its three mobile findings resolved in one correction batch: in-flow loading scroll, oversized focused draft, and focus clearance after resizing. That is a scoped review, not deployment approval.

Evidence limits: phone tests use browser emulation and synthesized taps. No physical keyboard/device or native virtual-keyboard session was exercised. Enlarged text uses a 200% root font, not OS text scaling or an actual browser-zoom session. No live generation was triggered by this UX verification. No merge or deployment was performed.
