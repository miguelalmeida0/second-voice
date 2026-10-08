# Preview first — 2026-10-05

Implemented the supplied reference in the existing Second Voice Duet checkout.

- Cream draft column with rounded growing editor, three visible quick starts, the original six under a disclosure, and legal links.
- Forest voice column with choices, explicitly labeled prepared sample, three strengths, and the rewrite action. Outcomes remains available.
- Free preview and Surprise me never change the draft or call generation. The original rewrite pipeline, allowance controls, playback, copy, recovery, and optional result features remain connected.
- Completed rewrites remain mounted during preview exploration and can be restored with “Back to your rewrite.”
- Native document scrolling, 2,000-character limit, single mobile action dock, short-screen and oversized-editor fallbacks retained.

## Verification

- Node suite: 209/209 passed.
- Required `npm run test:scroll`: 22/22 passed.
- TypeScript and targeted ESLint: passed.
- Chrome browser checks at 320, 390, 767, 768, 1024, 1280, 1440, 1920 and 2560px: no horizontal overflow, one primary action, retained draft, growing editor, unclipped action.
- Keyboard strength selection changes the preview. Surprise changes voice without spending the live allowance (still 3).
- 1,755-character multiline draft grows with the document; mobile dock returns to flow while that editor is focused. At 390px viewport height it stays in flow.
- Outcomes and help work on mobile; Escape restores help-trigger focus.
- Synthetic browser responses on a temporary local adapter verified requesting, completion, retained results, error preservation, and return to free preview. All mutations were intercepted locally; these are UI checks, not live provider-generation evidence.
- Existing browser test contracts were updated for the new action copy, free Surprise behavior, and forest-column placement. The full Playwright multi-browser suite was not run in this session.

## Visual evidence

- `artifacts/duet/preview-first/desktop.jpg`
- `artifacts/duet/preview-first/mobile-draft.jpg`
- `artifacts/duet/preview-first/mobile-preview.jpg`
- `artifacts/duet/preview-first/responsive-checks.json`

The user's normal browser viewport was restored. No deployment, commit, or push.
