---
name: ghostwriter-scroll-integrity
description: Use before making any Ghostwriter UI, layout, CSS, image, animation, or interaction change. Preserves smooth native document scrolling and prevents horizontal white scrollbar/thumb artifacts, nested scroll containers, scroll-trapping textareas, and heavy hero paint layers.
---

# Ghostwriter Scroll Integrity

## Contract

Ghostwriter should have one native document scroller. Scrolling must stay browser-native, smooth, and uninterrupted across mouse wheel, trackpad, and touch.

The white bottom-left scrollbar/thumb artifact at the page end is forbidden. Treat any visible horizontal scrollbar, track, thumb, or white pill as a release blocker.
The Next.js development indicator is also forbidden on Ghostwriter because it renders as a bottom-left `NEXTJS-PORTAL` that looks like the same white artifact.

## Rules

- Prefer `overflow-x: clip` for horizontal containment. Do not use `overflow-x: hidden` on `html`, `body`, Next root wrappers, `.ghostwriter`, or broad page shells.
- Keep `devIndicators: false` in `next.config.ts`. Do not re-enable or reposition the Next.js development indicator for Ghostwriter UI work.
- Do not use `scrollbar-width: none` to hide the problem; it can remove legitimate vertical scrollbar affordance. If a WebKit scrollbar override is needed, target only `::-webkit-scrollbar:horizontal`.
- Keep `src/app/ghostwriter-overflow-guard.css` suppressing every horizontal WebKit scrollbar part: scrollbar shell, thumb, track, track-piece, button, and corner. The reset must stay horizontal-only and must keep `!important`; weakening it can recreate the white bottom-left pill even when DOM `scrollWidth` equals `clientWidth`.
- Do not create page-level `overflow: hidden`, `overflow: auto`, `overflow: scroll`, `height: 100vh`, or fixed wrappers unless building an intentional modal or drawer.
- Keep the composer textarea auto-growing with `resize-none overflow-hidden`; it must not become a nested scroll region.
- Dense interactive surfaces should preserve vertical panning. Keep `touch-action: pan-y` on buttons/links and `touch-action: manipulation` on range controls.
- Hero artwork must not intercept input. Keep it `pointer-events: none`.
- Render one responsive hero image at a time. Use `<picture>`/`<source>` instead of stacking multiple full-size images with opacity.
- Avoid `will-change`, animated filters, backdrop blurs, or large transform/opacity layers on hero-scale assets unless a performance check proves they do not affect scroll.

## Required Check

Run this after any UI/layout/style/asset change:

```bash
npm run test:scroll
```

If a visual check is available, scroll to the page end and verify there is no horizontal scrollbar/thumb at the bottom edge. If a change intentionally alters scroll behavior, update `tests/ui-layout-guard.test.ts` and document the reason in the final response.
For this specific artifact, a browser screenshot or manual bottom-of-page visual check takes precedence over DOM-only overflow measurements, because Chrome can still paint the horizontal thumb while `scrollWidth` and `clientWidth` report equal values.
