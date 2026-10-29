# Second Voice stress-audit repairs — 29 October 2026

Source: `run-e35283d2-ea82-4ade-ade6-2e5978c69f6c.json`; SHA-256 `407c59a340f0b627eb8b2f90fd1552b4cb7235db0ad22420968d37abb94e805a`. The report contains 900 cases and 77 distinct rule/selector/summary combinations. The six discovered page entries include repeated legal links/fragments; these are four canonical routes.

## Findings and resolution

| Finding family | Cause and resolution |
| --- | --- |
| Storage-denied runtime errors (15 cases) | Unguarded preference reads and writes threw SecurityError. Preference storage is optional; failures preserve in-memory operation and always complete editor readiness. |
| Mobile controls obscured by the rewrite dock | The dock had no collision check and its original section collapsed to zero height. Its slot now retains the button height before paint. The dock yields to visible controls and uses the actual safe-area inset. |
| Layout-shift budget | The dock no longer collapses its original row after hydration. Its button has the same minimum mobile height in both positions; clearance and eligibility use stable candidate dimensions. Initial-layout checks exercise all five audit viewports with delayed identity. Synthetic text/spacing mutations in the original audit themselves cause shifts, so they are not treated as initial-load performance measurements. |
| Legal title clipping at enlarged type | Unbroken words could exceed the viewport and be clipped by the page boundary. Legal copy now wraps within its reading width. |
| Legal navigation collisions and obscured brand | Extended labels could squeeze or overlap the adjacent action. Navigation wraps with explicit gaps and shrinkable text. |
| Privacy provider links overlap with extended text | Multi-line inline link bounding boxes intersected. Provider links are now independent wrapping inline blocks. |
| Legal/account keyboard visibility | Reading links have scroll clearance; legal links receive an explicit focus ring. Regression checks traverse actual Tab stops with enlarged and extended text. |
| Missing CSP on legal/privacy responses (600 repeated cases) | The nonce policy covered the studio/account and share routes only. Both legal routes now receive it, and render per request so Next can apply the matching nonce to scripts. |
| Landscape contrast needs-review alerts | A full-panel pseudo-element prevented axe from identifying backgrounds. A real noninteractive background element preserves the split and makes contrast measurable. |
| Legal decorative-arrow contrast alert | A text arrow prompted a non-text-character review. It is now an aria-hidden SVG. |
| Accessible-name mismatch under extended copy | Clear and the legal brand repeated visible labels in fixed aria-label attributes. Redundant overrides were removed so accessible names follow visible copy. |
| Error-state contrast review | The root error surface now uses the existing Duet error colors and an opaque reading surface. |
| Logo bounds and RTL | The image intentionally extends outside a clipped frame to remove the supplied white canvas. The frame remains fixed and uses left-to-right image coordinates in RTL documents. Visible crop is intentional. |
| Hidden heading, textarea label and action hint clipping | These are intentionally screen-reader-only elements, not lost visible text. Their accessible information is retained. |
| Textarea focus-style heuristic | Focus is drawn on the enclosing field. A real focused-browser check also confirms a computed editor outline. No accessibility labels or focus treatment were removed to silence the heuristic. |
| One account hydration error under long-text injection | Not reproduced after hydration with extended text and real keyboard navigation. The audit mutates React-owned text and can race hydration; no mismatch was observed on unmodified production navigation. Storage-denied errors were separately reproduced and fixed. |

## Verification

- The new pre-fix checks reproduced storage failure, dangling dialog references, collapsed dock layout, enlarged legal text clipping, and missing legal CSP. The editor focus check already passed.
- All 36 desktop/touch Chromium stress checks passed across the full run and the final CSP rerun. Coverage includes these failures, contrast evaluation, safe-area sizing, stable docking at control edges, keyboard traversal, and initial layout shifts at 320×640, 390×844, 844×390, 768×1024 and 1440×900.
- The existing 160-case desktop/touch browser suite was exercised. The focused rerun passed all six cases after updating the backdrop assertion and safe-dock expectations. One first-run failure was test-artifact interference between concurrent runners, rather than an application assertion.
- Eight checks against the optimized production server passed, including legal CSP headers, matching script nonces, client navigation, dialog interaction, storage denial, measurable contrast, and the 0.1 initial-layout shift budget.
- 245 unit/security checks and 23 native-scroll guards passed. Build and type checking passed. Lint has no errors and three existing warnings.
- The stress suite is now part of the existing first-paint CI workflow.

## Limits

Local browser validation used desktop and touch Chromium. Firefox/WebKit were represented in the supplied audit but were not rerun here. The ledger integration command could not start because Docker is unavailable; no database/schema/ledger behavior changes in this patch. This is targeted regression verification, not a replay of all 900 original cases or a WCAG certification. AI endpoints were mocked; tests consumed no production rewrites.

## Review

The changed implementation received separate reuse, quality and efficiency reviews plus a targeted correctness review. Follow-ups removed redundant scroll writes, avoid desktop scroll measurements, measure the safe-area inset, and keep dock geometry stable across state changes. The final review identified no remaining substantiated code defect. No external cross-model CLI review was available.

## CI follow-up: branding and dependency patch

The first CI attempt passed build, types, unit/security, scroll and PostgreSQL integration checks, then exposed a stalled mobile logo optimizer request. Its traces showed the desktop wordmark returning 200 while both mobile icon requests remained pending. The logo now uses pre-encoded WebP files at three times its rendered size (6,918-byte wordmark and 1,916-byte icon), served directly without runtime optimization. The original masters and existing crop are preserved. The native-scroll/branding check now deliberately aborts optimizer requests; it failed before this change.

The dependency scan also identified advisories affecting the installed Next.js and Zod versions. Next.js and its ESLint configuration were updated to 16.4.3; Zod to 4.6.6. `npm audit --omit=dev` then reported zero vulnerabilities. References: https://github.com/advisories/GHSA-2464-fhr4-w9xw and https://github.com/advisories/GHSA-mrhx-c7xc-m3w5. The Next-generated AGENTS heading update accompanies the framework version.
