<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:ghostwriter-scroll-integrity -->
# Ghostwriter scroll integrity is a release blocker

For every UI, layout, asset, animation, or CSS change, preserve one native document scroller. Before editing scroll-adjacent code, apply `skills/ghostwriter-scroll-integrity/SKILL.md`.

- The white bottom-left scrollbar/thumb artifact shown at the page end is forbidden. Any visible horizontal scrollbar track, thumb, or white pill on Ghostwriter is a release blocker, even if vertical scrolling still works.
- Keep `devIndicators: false` in `next.config.ts`. The Next.js development indicator renders as a bottom-left `NEXTJS-PORTAL` and visually resembles the forbidden white scrollbar/thumb artifact.
- Do not add `overflow-x: hidden` to `html`, `body`, Next root wrappers, page shells, or broad section wrappers. Use `overflow-x: clip` for horizontal containment so the browser does not create nested vertical scroll containers.
- Do not use `scrollbar-width: none` as a shortcut; it can hide legitimate vertical scrolling. Suppress only horizontal scrollbar pseudo-elements where needed.
- The WebKit horizontal scrollbar guard in `src/app/ghostwriter-overflow-guard.css` must suppress the scrollbar shell plus horizontal thumb, track, track-piece, button, and corner pseudo-elements. Do not weaken these selectors or remove `!important` from the horizontal-only pseudo-element reset.
- Do not add `overflow: hidden`, `overflow: auto`, `overflow: scroll`, fixed viewport wrappers, or independent scroll regions to page sections unless the component is an intentional modal/panel with its own reviewed scroll behavior.
- Keep the Ghostwriter composer auto-growing with `resize-none overflow-hidden`; do not reintroduce a resizable or internally scrollable textarea.
- Hero artwork must be `pointer-events: none`, must not use animated full-viewport compositor layers, and must render as one responsive image/picture at a time.
- Run `npm run test:scroll` after any change that touches UI, layout, CSS, assets, images, animation, or interaction code. If a visual check is possible, scroll to the page end and verify there is no horizontal scrollbar/thumb at the bottom edge. If the change intentionally alters scroll behavior, update the scroll tests and explain the tradeoff.
<!-- END:ghostwriter-scroll-integrity -->
