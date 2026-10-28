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
      const heading = (await page.locator(".duet-input-heading").boundingBox())!;
      expect(source.y - (heading.y + heading.height)).toBeLessThanOrEqual(100);
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


const cafeDraft = "Here's a short four-line text:\n\nThe café on the corner opens at seven, but the owner is usually there by six.\nShe wipes the tables, checks the milk, and turns on the old radio by the window.\nMost mornings the first customer is a bus driver who orders the same thing.\nBy the time the city wakes up, the place already feels lived in.\n\nWant it on a specific topic or for a particular use, like a bio, a caption, or a message?";

for (const [width, height] of [[1512, 738], [1280, 720], [1024, 640]]) {
  test(`rewrite action follows growing drafts at ${width}x${height}`, async ({ app, page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockGhostwriterApi(page);
    await app.goto();
    const check = async () => {
      // Start at the top like the user's screenshot, without Playwright's click scrolling.
      await page.evaluate(() => window.scrollTo(0, 0));
      const cta = (await app.rewriteButton().boundingBox())!;
      const input = (await page.locator(".gw-composer-field").boundingBox())!;
      const output = (await page.locator(".duet-canvas").boundingBox())!;
      const heading = (await page.locator(".duet-output-heading").boundingBox())!;
      const controls = (await page.locator(".duet-controls").boundingBox())!;
      expect(cta.y - (input.y + input.height)).toBeGreaterThanOrEqual(8);
      expect(cta.y - (input.y + input.height)).toBeLessThanOrEqual(16);
      expect(Math.abs(cta.x + cta.width - (input.x + input.width))).toBeLessThanOrEqual(1);
      expect(controls.y).toBeGreaterThanOrEqual(heading.y + heading.height);
      expect(controls.x).toBeGreaterThanOrEqual(width / 2);
      expect(cta.width).toBeLessThanOrEqual(180);
      expect(output.y).toBeLessThanOrEqual(300);
      expect(cta.y).toBeGreaterThanOrEqual(0);
      expect(Math.abs(input.y - output.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(input.height - output.height)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await app.fillDraft(cafeDraft);
    await check();
    expect(await app.draftInput().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBe(16);
    expect(await page.locator(".duet-input-heading .duet-title").evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(26);
    await page.screenshot({ path: info.outputPath("compact-cafe.png"), fullPage: true });
    await app.fillDraft("A draft that keeps growing.\n".repeat(60));
    await check();
    await app.switchToOutcomes();
    await check();
    await app.fillDraft(cafeDraft);
    await app.runRewrite();
    await expect(page.locator('[data-phase="complete"]')).toBeVisible();
    await check();
  });
}

for (const width of [1024, 1440]) {
  test(`rewrite action accommodates enlarged text at ${width}px`, async ({ app, page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockGhostwriterApi(page);
    await app.goto();
    await app.fillDraft("A short draft with readable controls.");
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const button = app.rewriteButton();
    await expect(button).toBeVisible();
    expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const cta = (await button.boundingBox())!;
    const input = (await page.locator(".gw-composer-field").boundingBox())!;
    expect(cta.y).toBeGreaterThanOrEqual(input.y + input.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
