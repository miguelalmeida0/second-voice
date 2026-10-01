import { test, expect } from "../fixtures/test";
import { expectPressed } from "../utils/assertions";

test.describe("rewrite console dashboard", () => {
  test("renders the full author console with primary controls", async ({ dashboard, page }) => {
    await dashboard.goto();
    await dashboard.expectAuthorConsole();

    // Below 1100px the "Quick starts" heading is replaced by an equivalent
    // disclosure toggle button (see gw-inspiration-toggle); either is a valid
    // entry point into the same feature.
    await expect(
      page.getByRole("heading", { name: "Quick starts" }).or(dashboard.app.quickStartsToggle()),
    ).toBeVisible();
    await dashboard.app.openQuickStarts();
    await expect(page.getByRole("button", { name: "A rainy day thought" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy rewrite" })).toHaveCount(0);
    await expect(page.getByText("Your rewrite will appear here.")).toBeVisible();
  });

  test("selecting an author updates selected state, mood label, and rewrite CTA", async ({ app, page }) => {
    await app.goto();
    await app.chooseAuthor("Stephen King");

    await expectPressed(page.getByRole("button", { name: "Choose Stephen King" }), true);
    await expectPressed(page.getByRole("button", { name: "Choose J.R.R. Tolkien" }), false);
    await expect(page.getByLabel(/dread mood dial/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Rewrite as King" })).toBeVisible();
  });

  test("outcome mode swaps the control surface and rewrites the CTA around the chosen outcome", async ({ dashboard, page }) => {
    await dashboard.goto();
    await dashboard.expectOutcomeConsole();
    await dashboard.app.chooseOutcome("Be concise");

    await expectPressed(page.getByRole("button", { name: /Be concise/ }), true);
    await expect(page.getByRole("button", { name: "Rewrite to be concise" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose J.R.R. Tolkien" })).toHaveCount(0);
  });
});
