import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../fixtures/test";
import { mockGhostwriterApi } from "../utils/mockApi";
import { apiResponses } from "../fixtures/testData";

test("studio menus preserve selection, keyboard focus and the rewrite payload", async ({ app, page }, info) => {
  const api = await mockGhostwriterApi(page);
  await app.goto();
  await app.fillDraft("Keep my words while I choose another voice.");
  const author = page.getByRole("combobox", { name: "Author", exact: true });
  await author.focus();
  await author.press("ArrowDown");
  await expect(author).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("option", { name: "J.R.R. Tolkien" })).toHaveAttribute("aria-selected", "true");
  await author.press("End");
  await author.press("Escape");
  await expect(author).toBeFocused();
  await expect(author).toHaveText("J.R.R. Tolkien");
  await author.press("e");
  await author.press("Enter");
  await expect(author).toHaveText("Ernest Hemingway");
  await author.press("ArrowDown");
  await author.press("Home");
  await author.press("Tab");
  await expect(author).toHaveAttribute("aria-expanded", "false");
  await expect(app.moodDial()).toBeFocused();
  await expect(author).toHaveText("Ernest Hemingway");
  await author.click();
  await app.draftInput().click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(app.draftInput()).toHaveValue("Keep my words while I choose another voice.");
  await app.runRewrite();
  await app.expectRewriteVisible(apiResponses.rewrite);
  expect(api.rewriteRequests[0].body).toMatchObject({ author: "hemingway", mode: "author" });
  await app.switchToOutcomes();
  await app.chooseOutcome("Be concise");
  await expect(page.getByRole("combobox", { name: "Writing outcome" })).toHaveText("Be concise");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Writing outcome" })).toHaveText("Be concise");
  await page.getByRole("combobox", { name: "Writing outcome" }).click();
  expect((await new AxeBuilder({ page }).include(".studio-select-menu").analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("outcome-menu.png") });
});

test("menus have inset chevrons and stay inside desktop and mobile viewports", async ({ app, page }, info) => {
  await mockGhostwriterApi(page);
  await app.goto();
  for (const width of [320, 390, 768, 1512]) {
    await page.setViewportSize({ width, height: 738 });
    const author = page.getByRole("combobox", { name: "Author", exact: true });
    await author.click();
    for (const field of [author, page.getByRole("combobox", { name: "Rewrite mode" })]) {
      expect(await field.locator("span").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await expect(page.getByRole("listbox")).toBeVisible();
    const menu = (await page.getByRole("listbox").boundingBox())!;
    const button = (await author.boundingBox())!;
    const chevron = (await author.locator("svg").boundingBox())!;
    expect(button.x + button.width - chevron.x - chevron.width).toBeGreaterThanOrEqual(12);
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
    expect(menu.y).toBeGreaterThanOrEqual(0);
    expect(menu.y + menu.height).toBeLessThanOrEqual(738);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`author-menu-${width}.png`) });
    await author.press("Escape");
  }
});
