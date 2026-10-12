import { test, expect } from "@playwright/test";
import { mockGhostwriterApi } from "../utils/mockApi";

const allowance = { remaining: 3, todayRemaining: 3, available: true };
const editorSelector = "#second-voice-input";

test("server HTML contains one real studio before JavaScript or auth", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const response = await page.goto(`${baseURL}/`);
    expect(response?.status()).toBe(200);
    expect(response?.request().redirectedFrom()).toBeNull();
    await expect(page.locator(editorSelector)).toBeVisible();
    await expect(page.locator(editorSelector)).toHaveCount(1);
    await expect(page.locator(".duet-controls")).toBeVisible();
    await expect(page.locator(".gw-inspiration-rewrite")).toBeDisabled();
    await expect(page.getByText("Loading Second Voice AI")).toHaveCount(0);
  } finally { await context.close(); }
});

test("slow auth leaves editor usable and generation closed through refresh", async ({ page }, info) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const api = await mockGhostwriterApi(page);
  await page.route("**/api/ghostwriter/auth", async route => {
    await waiting;
    await route.fulfill({ json: { mode: "anonymous", allowance } });
  });
  await page.goto("/second-voice");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(editorSelector)).toBeVisible();
  await expect(page.locator('[data-session-status="checking"]')).toBeVisible();
  await page.locator(editorSelector).fill("I missed the train, so I walked home.");
  await expect(page.locator(".gw-inspiration-rewrite")).toBeDisabled();
  await page.locator(editorSelector).press("Tab");
  await expect(page.getByRole("button", { name: "Clear text" })).toBeFocused();
  expect(api.rewriteRequests).toHaveLength(0);
  await expect(page.locator(".sv-loading-page")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("slow-auth-studio.png"), fullPage: true });
  release();
  await expect(page.locator(".gw-inspiration-rewrite")).toBeEnabled();
  await page.reload();
  await expect(page.locator(editorSelector)).toBeVisible();
  await expect(page.locator(".sv-loading-page")).toHaveCount(0);
  expect(api.rewriteRequests).toHaveLength(0);
});

test("failed and expired identity stays closed; reload recovers without a splash", async ({ page }) => {
  const api = await mockGhostwriterApi(page);
  let status = 503;
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({ status, json: status === 200 ? { mode: "authenticated", allowance } : { message: "Unavailable" } }));
  await page.goto("/");
  await page.locator(editorSelector).fill("Keep this draft while identity is unavailable.");
  await expect(page.locator('[data-session-status="unavailable"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".gw-inspiration-rewrite")).toBeDisabled();
  await expect(page.locator(editorSelector)).toHaveValue("Keep this draft while identity is unavailable.");
  status = 401;
  await page.reload();
  await expect(page.locator('[data-session-status="unavailable"]')).toBeVisible();
  await expect(page.locator(".gw-inspiration-rewrite")).toBeDisabled();
  status = 200;
  await page.reload();
  await page.locator(editorSelector).fill("Identity recovered.");
  await expect(page.locator(".gw-inspiration-rewrite")).toBeEnabled();
  expect(api.rewriteRequests).toHaveLength(0);
});

test("rewrite feedback stays in output and reduced motion stops its signal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const api = await mockGhostwriterApi(page, { rewrite: { delayMs: 1800, json: { rewrite: "The train was gone. I walked home.", moodLabel: "starlit" } } });
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({ json: { mode: "anonymous", allowance } }));
  await page.goto("/");
  await page.locator(editorSelector).fill("I missed the train, so I walked home.");
  await page.locator(".gw-inspiration-rewrite").click();
  await expect(page.locator('.duet-result [role="status"]')).toBeVisible();
  await expect(page.locator(".duet-writing-signal")).toHaveCSS("animation-name", "none");
  await expect(page.locator(editorSelector)).toHaveValue("I missed the train, so I walked home.");
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  expect(api.rewriteRequests).toHaveLength(1);
});

test("studio preserves native scrolling and readable fields across widths", async ({ page }, info) => {
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({ json: { mode: "anonymous", allowance } }));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
    await page.goto("/");
    await expect(page.locator(editorSelector)).toBeVisible();
    const geometry = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      fontSize: parseFloat(getComputedStyle(document.querySelector("textarea")!).fontSize),
      scroller: document.scrollingElement === document.documentElement,
    }));
    expect(geometry.overflow).toBe(false);
    expect(geometry.fontSize).toBeGreaterThanOrEqual(16);
    expect(geometry.scroller).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: info.outputPath(`bottom-${width}.png`) });
    await expect(page.locator(".gw-inspiration-rewrite")).toBeInViewport();
  }
});
