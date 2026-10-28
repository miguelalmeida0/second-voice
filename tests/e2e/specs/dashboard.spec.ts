import { test, expect } from "../fixtures/test";

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
    await expect(page.getByRole("region", { name: "Rewrite preview" })).toContainText("Your rewrite will appear here.");
  });

  test("selecting an author updates selected state, mood label, and rewrite CTA", async ({ app, page }) => {
    await app.goto();
    await app.chooseAuthor("Stephen King");

    await expect(page.getByRole("combobox", { name: "Author", exact: true })).toHaveValue("stephenking");
    await expect(page.getByRole("combobox", { name: "Author", exact: true })).not.toHaveValue("tolkien");
    await expect(page.getByLabel(/dread mood dial/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Rewrite my draft" })).toBeVisible();
  });

  test("outcome mode swaps the control surface and rewrites the CTA around the chosen outcome", async ({ dashboard, page }) => {
    await dashboard.goto();
    await dashboard.expectOutcomeConsole();
    await dashboard.app.chooseOutcome("Be concise");

    await expect(page.getByRole("combobox", { name: "Writing outcome" }).locator("option:checked")).toHaveText("Be concise");
    await expect(page.getByRole("button", { name: "Rewrite my draft" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Author", exact: true })).toHaveCount(0);
  });
});
