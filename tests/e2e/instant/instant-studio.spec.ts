import { test, expect } from "@playwright/test";
import { apiResponses } from "../fixtures/testData";
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
  const rewritten = "The train was gone. I walked home.";
  const api = await mockGhostwriterApi(page, {
    rewrite: {
      delayMs: 1800,
      json: {
        artifactToken: apiResponses.artifactToken,
        error: null,
        moodLabel: "starlit",
        rewrite: rewritten,
        shortId: null,
      },
    },
  });
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({ json: { mode: "anonymous", allowance } }));
  await page.goto("/");
  await page.locator(editorSelector).fill("I missed the train, so I walked home.");
  await page.locator(".gw-inspiration-rewrite").click();
  await expect(page.locator('.duet-result [role="status"]')).toBeVisible();
  await expect(page.locator(".duet-writing-signal")).toHaveCSS("animation-name", "none");
  await expect(page.locator(editorSelector)).toHaveValue("I missed the train, so I walked home.");
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  await expect(page.locator('[data-phase="complete"] .gw-playback-panel-strong')).toContainText(rewritten);
  await expect(page.getByRole("button", { name: /Open Rewrite Lab/ })).toHaveCount(0);
  expect(api.rewriteRequests).toHaveLength(1);
});

test("studio preserves native scrolling and readable fields across widths", async ({ page }, info) => {
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({ json: { mode: "anonymous", allowance } }));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
    await page.goto("/");
    await expect(page.locator(editorSelector)).toBeVisible();
    const logo = page.locator(".duet-logo img");
    await expect(logo).toHaveCount(1);
    await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await logo.evaluate((image: HTMLImageElement) => decodeURIComponent(image.currentSrc))).toContain(width >= 768 ? "second-voice-wordmark.png" : "second-voice-icon.png");
    const brand = (await page.locator(".duet-logo").boundingBox())!;
    expect(brand.width).toBeLessThanOrEqual(180);
    expect(brand.height).toBeLessThanOrEqual(36);
    await page.screenshot({ path: info.outputPath(`brand-${width}.png`) });
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


for (const remaining of [4, 5]) {
 test(`production allowance ${remaining} enables writing and preserves the chosen author`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const api = await mockGhostwriterApi(page);
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({ json: {
   mode: "anonymous", allowance: { remaining, todayRemaining: remaining, available: true, globalLimited: false },
  } }));
  await page.goto("/");
  await page.getByRole("textbox", { name: "Write or paste here" }).fill("My draft must remain editable and ready to rewrite.");
  await page.getByRole("button", { name: "Choose Ernest Hemingway", exact: true }).click();
  await expect(page.locator(".gw-inspiration-rewrite")).toBeEnabled();
  await expect(page.locator("#duet-action-allowance")).toContainText(`${remaining} free rewrites left`);
  await page.locator(".gw-inspiration-rewrite").click();
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  expect(api.rewriteRequests).toHaveLength(1);
  expect(api.rewriteRequests[0].body).toMatchObject({ author: "hemingway", text: "My draft must remain editable and ready to rewrite." });
  await expect(page.getByRole("button", { name: "Review changes", exact: true })).toBeVisible();
 });
}

test("availability can recover without discarding the draft or enabling unchecked generation", async ({ page }) => {
 const api = await mockGhostwriterApi(page);
 let available = false;
 await page.route("**/api/ghostwriter/auth", route => route.fulfill({ status: available ? 200 : 503, json: available
  ? { mode: "authenticated", allowance: { remaining: 5, todayRemaining: 5, available: true } }
  : { message: "Authentication is temporarily unavailable." },
 }));
 await page.goto("/");
 const draft = page.getByRole("textbox", { name: "Write or paste here" });
 await draft.fill("Keep this text while the availability check recovers.");
 await expect(page.getByRole("button", { name: "Check availability", exact: true })).toBeVisible();
 await expect(page.locator(".gw-inspiration-rewrite")).toBeDisabled();
 expect(api.rewriteRequests).toHaveLength(0);
 available = true;
 await page.getByRole("button", { name: "Check availability", exact: true }).click();
 await expect(page.locator(".gw-inspiration-rewrite")).toBeEnabled();
 await expect(draft).toHaveValue("Keep this text while the availability check recovers.");
 expect(api.rewriteRequests).toHaveLength(0);
});


test("the last two rewrites complete and then the allowance closes generation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const api = await mockGhostwriterApi(page);
  await page.route("**/api/ghostwriter/auth", route => {
    const remaining = Math.max(0, 2 - api.rewriteRequests.length);
    return route.fulfill({ json: { mode: "anonymous", allowance: {
      remaining, todayRemaining: remaining, available: true,
    } } });
  });
  await page.goto("/");
  const draft = page.getByRole("textbox", { name: "Write or paste here" });
  await draft.fill("Today I woke up earlier and made coffee before work.");
  await page.getByRole("button", { name: "Choose Leo Tolstoy", exact: true }).click();
  const rewrite = page.locator(".gw-inspiration-rewrite");
  await expect(page.locator("#duet-action-allowance")).toContainText("2 free rewrites left");
  await rewrite.click();
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  await expect(page.locator("#duet-action-allowance")).toContainText("1 free rewrite left");
  await rewrite.click();
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  await expect(rewrite).toBeDisabled();
  await expect(page.locator("#duet-action-allowance")).toContainText("used for now");
  expect(api.rewriteRequests).toHaveLength(2);
  expect(api.rewriteRequests.every(request => request.body.author === "tolstoy")).toBe(true);
  await expect(draft).toHaveValue("Today I woke up earlier and made coffee before work.");
});
