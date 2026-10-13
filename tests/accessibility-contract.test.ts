import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const style = readFileSync("src/app/duet.css", "utf8");
const config = readFileSync("next.config.ts", "utf8");

function ratio(text: string, background: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((n) => Number.parseInt(hex.slice(n, n + 2), 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [high, low] = [luminance(text), luminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

test("Duet functional borders meet WCAG 2.2 AA non-text contrast", () => {
  const border = style.match(/--duet-control-line:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(border, "semantic control border token");
  for (const background of ["#dfe5d0", "#eeeee0"]) {
    assert.ok(ratio(border[1], background) >= 3, `border on ${background}`);
  }
  assert.match(style, /gw-author-portrait-button,.*gw-outcome-choice.*border: 1px solid var\(--duet-control-line\)/);
  assert.match(style, /gw-range::-webkit-slider-runnable-track \{ height: 3px; background: var\(--duet-control-line\)/);
  assert.match(style, /gw-range::-moz-range-track \{ height: 3px; background: var\(--duet-control-line\)/);
});

test("textarea retains a strong visible enclosing focus indicator", () => {
  assert.match(style, /gw-composer-field:focus-within \{ outline: 2px solid var\(--duet-forest\); outline-offset: 6px/);
});

test("legacy hostname redirects its public landing page, not auth APIs or cron", () => {
  assert.match(config, /source: "\/",[\s\S]*?type: "host", value: "secondvoice-ai.vercel.app"[\s\S]*?destination: "https:\/\/secondvoice\.miguelalmeida\.xyz\/"[\s\S]*?permanent: true/);
  assert.doesNotMatch(config, /source: "\/:path\*"[\s\S]*?secondvoice-ai\.vercel\.app/);
});
