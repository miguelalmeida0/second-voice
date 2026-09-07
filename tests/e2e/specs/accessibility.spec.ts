import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../fixtures/test";
import { expectNoHorizontalOverflow } from "../utils/assertions";

test.describe("accessibility and keyboard integrity", () => {
  test.use({ bypassCSP: true });

  test("main app has no automatically detectable accessibility violations", async ({ app, page }) => {
    await app.goto();

    const results = await new AxeBuilder({ page }).include(".ghostwriter").analyze();

    expect(results.violations).toEqual([]);
  });

  test("case study has no automatically detectable accessibility violations", async ({ page }) => {
    await page.goto("/second-voice/case-study");

    const results = await new AxeBuilder({ page }).include(".gw-case-study").analyze();

    expect(results.violations).toEqual([]);
  });

  test("drawer focus stays inside the dialog and Escape closes it", async ({ app, page }) => {
    await app.goto();
    await app.openHowItWorks();

    const dialog = page.getByRole("dialog", { name: "How to use Second Voice" });
    await expect(
      page.getByRole("button", { name: "Close How it works", exact: true }),
    ).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("link", { name: "Read the case study" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close How it works", exact: true }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("primary controls expose accessible names, states, and no horizontal overflow", async ({ app, page }) => {
    await app.goto();

    await expect(page.getByRole("button", { name: "Authors" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel(/mythic mood dial/i)).toHaveAttribute("aria-valuetext", /starlit/i);
    await expect(page.getByRole("button", { name: "Copy rewrite" })).toBeDisabled();
    await expectNoHorizontalOverflow(page);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectNoHorizontalOverflow(page);
  });
});
