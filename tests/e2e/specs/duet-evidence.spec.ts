import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { test, expect } from "../fixtures/test";
import { mockGhostwriterApi } from "../utils/mockApi";
import { apiResponses } from "../fixtures/testData";

test.use({ bypassCSP: true });
test("Duet evidence: real controls, request lifecycle, responsive geometry and help", async ({ app, page }, info) => {
  test.setTimeout(150_000);
  const dir = `artifacts/duet/${info.project.name}`;
  await mkdir(dir, { recursive: true });
  const capture = async (name: string) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  };
  const api = await mockGhostwriterApi(page, { rewrite: { delayMs: 1400, json: { artifactToken: apiResponses.artifactToken, rewrite: "The last train slipped away. Beyond the station lights, the road home waited.", moodLabel: "starlit" } } });
  await app.goto();
  await capture("01-default");
  for (const author of ["J.R.R. Tolkien", "Stephen King", "Leo Tolstoy", "Ernest Hemingway"]) {
    await app.chooseAuthor(author);
    await expect(page.getByRole("button", { name: `Choose ${author}` })).toHaveAttribute("aria-pressed", "true");
  }
  await app.chooseAuthor("J.R.R. Tolkien");
  for (const control of await page.locator(".duet-controls button, .duet-actions button, .gw-range").all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await app.openQuickStarts();
  for (const label of ["A rainy day thought", "A note to future me", "A tiny comfort spell", "A moonlit thought", "A cat observation", "A soft end-of-day note"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(app.draftInput()).not.toHaveValue("");
  }
  await app.quickStartsToggle().click();
  await app.fillDraft("I missed the train,\nso I walked home.");
  await capture("02-ready");
  await app.switchToOutcomes();
  for (const outcome of ["Improve clarity", "Get a reply", "Sound confident", "Be concise", "Be persuasive"]) {
    await app.chooseOutcome(outcome);
    await expect(page.getByRole("button", { name: new RegExp(`^${outcome}`) })).toHaveAttribute("aria-pressed", "true");
  }
  await capture("03-outcome");
  await app.switchToAuthors();
  await app.moodDial().focus();
  await page.keyboard.press("ArrowRight");
  await expect(app.moodDial()).toHaveValue("53");
  await app.runRewrite();
  await expect(page.locator('[data-phase="requesting"]')).toBeVisible();
  const originalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: originalViewport.width === 390 ? 820 : 390, height: originalViewport.height });
  await expect(app.draftInput()).toHaveValue("I missed the train,\nso I walked home.");
  await page.setViewportSize(originalViewport);
  await capture("04-processing");
  // Direct rapid activation also exercises the synchronous in-flight guard.
  await page.locator(".gw-inspiration-rewrite").evaluate((node: HTMLButtonElement) => { node.click(); node.click(); });
  await expect.poll(() => api.rewriteRequests.length).toBe(1);
  await expect(page.getByRole("button", { name: "Skip animation" })).toBeVisible();
  await capture("05-live");
  await page.getByRole("button", { name: "Skip animation" }).click();
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  await expect(page.locator(".gw-playback-panel-strong > p")).toHaveText("The last train slipped away. Beyond the station lights, the road home waited.");
  await expect(page.locator(".gw-playback-panel-strong").locator("..")).toHaveCSS("opacity", "1");
  await capture("06-result");
  const resultAxe = await new AxeBuilder({ page }).include(".gw-studio").analyze();
  expect(resultAxe.violations).toEqual([]);
  await app.copyRewrite();
  await page.getByRole("button", { name: "Try another rewrite" }).click();
  await expect.poll(() => api.rewriteRequests.length).toBe(2);
  await expect(page.locator('[data-phase="complete"]')).toBeVisible({ timeout: 15000 });
  await app.chooseAuthor("Ernest Hemingway");
  await expect(page.getByRole("region", { name: "Free sample preview" })).toHaveCount(0);
  expect(api.rewriteRequests).toHaveLength(2);
  await expect(page.locator('[data-phase="complete"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".gw-playback-panel-strong > p")).toHaveText("The last train slipped away. Beyond the station lights, the road home waited.");
  await expect(page.locator(".gw-playback-panel-strong").locator("..")).toHaveCSS("opacity", "1");
  await capture("07-change-voice");
  await app.openHowItWorks();
  await expect(page.getByRole("dialog")).toHaveCSS("opacity", "1");
  await capture("08-help");
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(app.howItWorksButton()).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: `${dir}/09-bottom.png` });
  await page.goto("/second-voice/account");
  await capture("10-account");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  await expect(page.getByRole("button", { name: "Delete my account" })).toBeDisabled();
  await page.goto("/second-voice/privacy");
  await capture("11-privacy");
  expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
});

test("Duet width sweep, near-limit text, enlarged text and reduced motion", async ({ app, page }, info) => {
  test.setTimeout(120_000);
  await mockGhostwriterApi(page);
  await app.goto();
  await app.fillDraft(("Long draft. A line of writing.\n").repeat(70).slice(0, 2000));
  const widths = [...new Set([320,360,375,390,430,600,767,768,769,820,844,999,1000,1001,1024,1099,1100,1101,1280,1440,1920,2560, ...Array.from({length:141},(_,i)=>320+i*16)])];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const geometry = await page.evaluate(() => {
      const editor = document.querySelector("textarea")!;
      return { overflow: document.documentElement.scrollWidth > innerWidth, innerScroll: editor.scrollHeight > editor.clientHeight + 2, length: editor.value.length };
    });
    expect(geometry, `width ${width}`).toEqual({ overflow: false, innerScroll: false, length: 2000 });
  }
  await page.setViewportSize({ width: 390, height: 700 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await app.fillDraft("A sentence to rewrite.");
  await app.runRewrite();
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip animation" })).toHaveCount(0);
  await mkdir(`artifacts/duet/${info.project.name}`, { recursive: true });
  await page.screenshot({ path: `artifacts/duet/${info.project.name}/12-enlarged.png`, fullPage: true });
});
