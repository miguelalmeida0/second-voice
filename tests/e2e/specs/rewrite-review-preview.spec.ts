import { expect, test } from "@playwright/test";

test("sample review works without application credentials or API requests", async ({ page }, testInfo) => {
  const requests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/ghostwriter")) requests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/rewrite-review");
  await expect(page.getByRole("button", { name: "Sample review · No AI calls" })).toBeVisible();
  const review = page.getByRole("region", { name: "Review your rewrite" });
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "Keep original", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("1 of");
  for (const name of ["Inline", "Focus", "Duet"]) {
    await review.getByRole("button", { name, exact: true }).click();
    await expect(review.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await review.getByRole("button", { name: "Back to sample" }).click();
  await expect(review).toBeHidden();
  const resume = page.getByRole("button", { name: "Review sample" });
  await expect(resume).toBeFocused();
  await resume.click();
  await expect(review.getByRole("status")).toContainText("1 of");
  await expect(page).toHaveURL(/\/demo\/rewrite-review$/);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("sample-review.png"), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: testInfo.outputPath("sample-review-bottom.png") });
});

test("panels align and accept all can be undone across every review layout", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/rewrite-review");
  const review = page.getByRole("region", { name: "Review your rewrite" });
  const bulk = review.getByRole("button", { name: "Accept all changes", exact: true });
  await expect(bulk).toBeVisible();
  for (const width of [768, 1280, 1920, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["Duet", "Inline", "Focus"]) {
      await review.getByRole("button", { name, exact: true }).click();
      if (width >= 768) {
        const original = (await page.getByTestId("review-source-paper").boundingBox())!;
        const revision = (await page.getByTestId("review-result-paper").boundingBox())!;
        expect(Math.abs(original.y - revision.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(original.height - revision.height)).toBeLessThanOrEqual(1);
      }
      await review.getByRole("button", { name: "Keep original", exact: true }).click();
      await expect(review.getByRole("status")).toContainText("1 of 3 reviewed");
      await bulk.click();
      await expect(review.getByRole("status")).toContainText("3 of 3 reviewed");
      await expect(bulk).toBeDisabled();
      await expect(review.getByRole("button", { name: "Copy revision", exact: true })).toBeVisible();
      await review.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(review.getByRole("status")).toContainText("1 of 3 reviewed");
      await expect(review.getByRole("button", { name: "Keep original", exact: true })).toHaveAttribute("aria-pressed", "true");
      await review.getByRole("button", { name: "Reset", exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await review.getByRole("button", { name: "Duet", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("aligned-review.png"), fullPage: true });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: testInfo.outputPath("aligned-review-bottom.png") });
});

test("review entry avoids highlighting Back and keeps a route to the live editor", async ({ page }) => {
  await page.goto("/demo/rewrite-review");
  const review = page.getByRole("region", { name: "Review your rewrite" });
  await expect(review).toBeFocused();
  const back = review.getByRole("button", { name: "Back to sample", exact: true });
  await expect(back).not.toBeFocused();
  await expect(page.getByRole("link", { name: "Open live editor", exact: true })).toHaveAttribute("href", "https://secondvoice.miguelalmeida.xyz/");
  await page.keyboard.press("Tab");
  await expect(back).toBeFocused();
  expect(await back.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
});
