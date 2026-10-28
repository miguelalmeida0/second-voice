import { test, expect } from "../fixtures/test";
import { mockGhostwriterApi } from "../utils/mockApi";
import { apiResponses } from "../fixtures/testData";

for (const [width, height] of [[1024, 640], [1280, 720], [1512, 738]]) {
  test(`writing surfaces share top and bottom edges at ${width}x${height}`, async ({ app, page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockGhostwriterApi(page, { rewrite: { delayMs: 600, json: {
      rewrite: "The rain stopped. She waited by the bridge.", moodLabel: "starlit", artifactToken: apiResponses.artifactToken,
    } } });
    await app.goto();
    const check = async () => {
      const source = (await page.locator(".gw-composer-field").boundingBox())!;
      const output = (await page.locator(".duet-canvas").boundingBox())!;
      expect(Math.abs(source.y - output.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(source.height - output.height)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await check();
    await app.fillDraft("The rain stopped. Mara waited by the bridge.");
    await check();
    const cta = (await app.rewriteButton().boundingBox())!;
    expect(cta.y + cta.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: info.outputPath("aligned-ready.png") });
    await app.runRewrite();
    await expect(page.locator('[data-phase="requesting"]')).toBeVisible();
    await check();
    await expect(page.locator('[data-phase="complete"]')).toBeVisible();
    await check();
    await app.switchToOutcomes();
    await check();
    await app.fillDraft("A long draft that should grow naturally.\n".repeat(40));
    await check();
    const long = (await page.locator(".gw-composer-field").boundingBox())!.height;
    await app.fillDraft("Short again.");
    await check();
    expect((await page.locator(".gw-composer-field").boundingBox())!.height).toBeLessThan(long);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: info.outputPath("aligned-bottom.png") });
  });
}
