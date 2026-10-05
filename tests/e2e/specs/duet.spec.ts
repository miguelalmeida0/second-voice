import { test, expect } from "../fixtures/test";
import { mockGhostwriterApi } from "../utils/mockApi";
import { apiResponses } from "../fixtures/testData";

test("Preview first keeps the primary action inside the forest workspace", async ({ app, page }) => {
  await app.goto();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await app.fillDraft("A sentence to rewrite.");
  const controls = await page.locator(".duet-followup").boundingBox();
  const action = await app.rewriteButton().boundingBox();
  expect(action!.y).toBeGreaterThan(controls!.y);
  expect(action!.y + action!.height).toBeLessThan(controls!.y + controls!.height);
  expect(action!.x).toBeGreaterThanOrEqual(controls!.x);
  expect(action!.x).toBeGreaterThan(page.viewportSize()!.width / 2);
  expect(action!.width).toBeGreaterThanOrEqual(260);
});

test("Duet starts empty and preserves the draft through responsive layouts", async ({ app, page }) => {
  await app.goto();
  await expect(app.draftInput()).toHaveValue("");
  await expect(app.rewriteButton()).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Your words." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Another voice." })).toBeVisible();
  await app.fillDraft("A draft that stays with me.\nAcross every screen.");
  for (const width of [320, 360, 375, 390, 430, 600, 768, 820, 844, 1024, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await expect(app.draftInput()).toHaveValue("A draft that stays with me.\nAcross every screen.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("clipboard rejection is actionable and never announced as success", async ({ app, page }) => {
  await mockGhostwriterApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
    document.execCommand = () => false;
  });
  await app.goto();
  await app.fillDraft("I missed the train, so I walked home.");
  await app.runRewrite();
  await app.expectRewriteVisible(apiResponses.rewrite);
  await page.getByRole("button", { name: "Copy rewrite" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Copy failed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rewrite copied" })).toHaveCount(0);
});
