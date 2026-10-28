# Rewrite review implementation plan

> Use Superpowers subagent-driven development to execute this approved design. Work only on `test`.

**Goal:** Integrate the approved Duet / Inline / Focus review feature into the existing Second Voice rewrite flow.
**Architecture:** Pure bounded word diff + immutable review reducer; a keyed, self-contained review workspace; small entry/exit additions in GhostwriterPage and RewritePlayback.
**Tech stack:** Existing Next.js 16, React 19, TypeScript, CSS modules, Node test runner, Playwright. No added dependencies.
**Spec:** `docs/superpowers/specs/2026-10-28-rewrite-review-design.md`

## Global Constraints

- Work only on `test`; never change main or create another branch. No force operations. Commits use author and committer `Miguel Almeida <94702822+miguelalmeida0@users.noreply.github.com>` with no agent coauthors.
- Follow AGENTS.md and skills/ghostwriter-scroll-integrity/SKILL.md. Preserve one native document scroller, composer auto-growth, devIndicators:false, and the horizontal scrollbar guard.
- Match the approved prototype at `/workspace/scratch/fd3a53f928cb/Second-Voice-Review.html`: cream #eeeee0, forest #2a3c32, peach #ee9965, existing UI/prose fonts, shared brand and split canvas. No demo copy, fake evidence, prototype controls, or new dependencies.
- Use latestRun.source and latestRun.rewrite, never the current composer text, for review. Decisions persist when switching views or closing/reopening the same result; a new run or identity reset discards them.
- Review is local and ephemeral. Never send a mixed revision with the original artifact token. Original copy, sharing, feedback, playback, Lab and generation keep their existing contracts.
- Pending edits use the suggested text in the preview. All kept reconstructs the source exactly; all accepted reconstructs the result exactly. Empty and Unicode text are valid, and diff work must be bounded.

## Review Focus

1. Wrong whitespace or Unicode reconstruction after mixed decisions.
2. Stale decisions, copied status or comparisons across run/identity changes.
3. Sharing an edited revision with a signature for the original output.
4. Focus loss, inaccessible inline edits, and overflow at narrow widths.
5. Unbounded diff work or unrelated refactoring of existing generation logic.

### Task 1: Bounded diff and immutable review model

**Files:** Create `src/components/ghostwriter/rewrite-review.ts`, `tests/rewrite-review.test.ts`. Add the test file to `test:unit` in `package.json` (no dependency change).

**Interface:** Export `ReviewPart` as `{kind:'equal';text:string}` or `{kind:'change';id:number;original:string;suggestion:string}`; `ReviewDecision = 'pending' | 'accept' | 'keep'`; `ReviewState` with `decisions: ReviewDecision[]` and undo history. Export `buildReviewParts(source:string,result:string):ReviewPart[]`, `createReviewState(parts:ReviewPart[]):ReviewState`, `reviewReducer(state, action):ReviewState` supporting `{type:'decide';id:number;decision:'accept'|'keep'}`, `{type:'undo'}`, `{type:'reset'}`, and `buildReviewText(parts,state):string`. Contiguous edits group as one change; IDs are stable sequential indices. Store only history needed to undo decisions and reset. Repeated same decisions and invalid IDs are no-ops. Reset must be undoable so a misclick does not destroy work.

- [x] Read repository rules and Superpowers test-driven-development/writing-good-tests.md. Write failing behavioral tests with literal expectations for mixed substitution/insertion/deletion, exact spaces/newlines, Unicode/emoji, empty/identical input, repeated words, undo/reset/no-op behavior, large input fallback.
- [x] Run the focused Node test and record the expected RED failure.
- [x] Implement the smallest pure module. Use Unicode-safe word/whitespace segmentation (never split surrogate pairs or emoji graphemes), preserve exact input slices, and a documented maximum LCS cell budget with one whole-replacement fallback. Do not change the legacy playback diff. Do not put browser or React code in this module.
- [x] Run focused tests, `npm run test:unit`, and `npx tsc --noEmit`; inspect the diff and commit only owned files.

### Task 2: Integrate the three review views

**Files:** Create `src/components/ghostwriter/RewriteReview.tsx`, `src/components/ghostwriter/RewriteReview.module.css`, `tests/e2e/specs/rewrite-review.spec.ts`. Modify `GhostwriterPage.tsx` and `RewritePlayback.tsx` narrowly. A shared clipboard helper `clipboard.ts` may be extracted from RewritePlayback to reuse its exact focus-preserving fallback; preserve its errors and button names. Do not modify security, auth, API, generation, Lab, route or guard code.

**Interface:** `RewriteReview({source,result,hidden,onClose})` with internal reducer using Task 1. Mount only once a user opens review, and retain it hidden on close for the current run. Key by latestRun.runId (and ensure empty/identity reset unmounts). Parent stores the reviewed run ID; visibility also requires !loading && !error && current run match. Original workspace is hidden while reviewing, not unmounted. Add optional `onReview?:()=>void` to RewritePlayback; render a **Review changes** button only when completed and source/result exist. Existing consumers without it behave unchanged. Close returns focus to the entry button. Do not leave hidden panels focusable to assistive technology. A minimal explicit `display:none` for hidden workspace is acceptable because existing grid CSS can override native hidden.

- [x] Read approved HTML and current CSS, Next local client-component docs, repository scroll skill and Superpowers writing-good-tests.md.
- [x] Write focused real-component E2E tests first, using existing network fixtures. Observe RED for the missing entry UI. Test selecting each view, mixed accept/keep output, Undo and Reset, closing/reopening, source snapshot after composer edits, next-run reset, copy denied/fallback, and original share payload after reviewed changes. Include zero-change and whole deletion/insertion cases where supported by real input/output contracts. Use deterministic hand-derived source/result fixtures. Test at desktop and narrow/mobile viewport; assert no horizontal document overflow.
- [x] Implement the approved visual hierarchy, dedicated split review workspace and entry/exit integration. Keep the shared header and existing fonts/colors. Duet renders linked changes on both sides; Inline renders tracked edits with multiline-safe selectable spans, keyboard activation, and visible status; Focus renders selected original/suggestion plus full-draft disclosure. Include selection/navigation, Accept/Keep original, progress, Undo, Reset, Copy preview/revision, and no-changes state. Use native buttons outside multiline prose; any inline role=button needs Enter/Space handling, focus style, accessible name and selected state. Use reduced motion and no fixed or independently scrolling panels.
- [x] Make copy success keyed to the exact revision copied; changes made during an async copy must never claim the new text is copied. Preserve original source and existing signed output; no share button inside review. Explain that edits stay here and public links use the original rewrite.
- [x] Run focused E2E on chromium + mobile-chrome + webkit where available, related duet parity/accessibility tests, lint/typecheck/unit/scroll. Check rendered desktop/mobile and bottom edge using screenshots. Run production build if environment allows. Document actual coverage and any environment limitations; do not claim checks not run.
- [x] Self-review against the approved HTML and spec, commit owned files and report exact test evidence.

## Final verification

Controller runs the release checks appropriate to the actual diff and requests a final independent whole-change review. Resolve important findings. Preserve all unrelated existing test-branch work; never merge or deploy main as part of this feature.
