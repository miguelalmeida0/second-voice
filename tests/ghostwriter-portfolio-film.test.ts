import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const route = readFileSync("src/app/demo/portfolio-film/page.tsx", "utf8");
const demo = readFileSync(
  "src/components/ghostwriter/PortfolioFilmDemo.tsx",
  "utf8",
);
const styles = readFileSync(
  "src/components/ghostwriter/PortfolioFilmDemo.module.css",
  "utf8",
);
const fixture = readFileSync(
  "src/lib/ghostwriter-portfolio-film-fixture.ts",
  "utf8",
);

test("portfolio film route stays development-only unless explicitly enabled", () => {
  assert.match(route, /NODE_ENV === "production"/);
  assert.match(route, /GHOSTWRITER_ENABLE_PORTFOLIO_FILM/);
  assert.match(route, /notFound\(\)/);
  assert.match(route, /index: false/);
});

test("portfolio film replays a real Tolkien response through product components", () => {
  assert.match(demo, /AuthorOrbital/);
  assert.match(demo, /RewritePlayback/);
  assert.match(demo, /PORTFOLIO_FILM_FIXTURE\.response\.rewrite/);
  assert.match(demo, /copyButton\.click\(\)/);
  assert.doesNotMatch(demo, /fetch\(["']\/api\/ghostwriter/);
});

test("portfolio film fixture is synthetic, replay-only, and excludes signed tokens", () => {
  assert.match(fixture, /successful local provider-backed rewrite/);
  assert.match(fixture, /providerPath: "\/api\/ghostwriter"/);
  assert.match(fixture, /author: "tolkien"/);
  assert.match(fixture, /mood: 52/);
  assert.doesNotMatch(fixture, /artifactToken\s*:/);
  assert.doesNotMatch(fixture, /api[_-]?key|bearer|cookie/i);
});

test("portfolio film preserves Ghostwriter scroll integrity", () => {
  const pageBlock = styles.match(/\.page \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(styles, /overflow-x: clip/);
  assert.match(styles, /overflow: clip/);
  assert.match(styles, /resize: none/);
  assert.match(styles, /\.writingSurface textarea \{[\s\S]*overflow: hidden/);
  assert.doesNotMatch(pageBlock, /overflow(?:-x)?: hidden/);
  assert.doesNotMatch(styles, /height: 100vh/);
  assert.doesNotMatch(styles, /scrollbar-width: none/);
});
