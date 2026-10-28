# Second Voice: review individual changes

The approved HTML prototype makes rewriting an editorial decision: accept the changes that help, keep the words that already work. This is a portfolio feature, not a commercial expansion.

## Experience

After playback finishes, **Review changes** opens a dedicated review workspace under the existing brand header. Preserve the existing cream/forest split, typography, peach accents, and “Your words.” / “Another voice.” headings. The original composer and generation controls remain mounted but hidden during review. **Back to rewrite** returns to them without losing the draft or review decisions.

Three views share a single session: **Duet** compares the source and revision; **Inline** shows tracked edits; **Focus** presents one change with surrounding context. Accept and Keep original apply to individual edits. Previous/next navigation, progress, Undo, and Reset support deliberate review. The original run source is immutable; editing the composer later cannot change the comparison. A new successful run or a changed identity clears the old session.

Unresolved changes preview the suggested wording. Label copying as **Copy preview** while any edit is pending and **Copy revision** once all edits are decided. Never claim completion early. Copy failure is visible and focus-safe. An identical result is a valid no-changes state; insertion, deletion, whitespace, Unicode, and long strings must preserve exact text.

## Integration and boundaries

Keep review local and ephemeral. No API calls, persistence, quota consumption, model inference, new auth behavior, or new sharing route. The existing signed rewrite remains the source for public sharing and feedback; the review surface copies only the locally assembled revision and explains that distinction briefly. Existing playback, Lab, retry, generation, and original-copy behavior stay intact.

A pure bounded diff/reducer module owns edit grouping, decisions, history, and reconstruction. A keyed client component owns layout/navigation and consumes the model. GhostwriterPage owns the entry/exit and run lifetime. Avoid broad refactors to the existing large controller and playback component.

## Quality bar

Keyboard access, visible focus, announced progress, touch targets, reduced motion, narrow-screen wrapping, and one native document scroller. No independent scrolling panels or fixed viewport shells. Compare against the approved local HTML, without copying its demo controls or fixtures into production.

Unit tests protect exact reconstruction, mixed decisions, undo/reset, and bounded fallback. Real component E2E tests with mocked network boundaries protect session lifecycle, view switching, copy behavior, signed-share separation, draft preservation, and mobile overflow. Run lint, typecheck, relevant E2E, security and scroll checks; do not claim live model or production deployment validation.
