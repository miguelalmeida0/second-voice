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
    await page.goto("/second-voice/case-study", { waitUntil: "commit" });
    // The dev server compiles this route on first request, and Turbopack's
    // Fast Refresh can still touch the document a moment after real content
    // is visible; wait for network activity (the HMR client's post-compile
    // fetch) to settle so axe never starts mid-navigation (WebKit surfaces
    // that race as "Execution context was destroyed").
    await expect(page.locator(".gw-case-study h1")).toBeVisible();
    await page.waitForLoadState("networkidle");

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

    // The drawer now contains account/privacy/credits links before the case-study CTA.
    // Test the actual focus-trap contract instead of hard-coding a stale tab order.
    for (let index = 0; index < 7; index += 1) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
        `tab ${index + 1} should keep focus inside the dialog`,
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("primary controls expose accessible names, states, and no horizontal overflow", async ({ app, page }) => {
    await app.goto();

    await expect(page.getByRole("button", { name: "Authors" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel(/mythic mood dial/i)).toHaveAttribute("aria-valuetext", /starlit/i);
    await expect(page.getByRole("button", { name: "Copy rewrite" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectNoHorizontalOverflow(page);
  });
});
