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
  await review.getByRole("button", { name: "Back to rewrite" }).click();
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
