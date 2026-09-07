import { test, expect } from "../fixtures/test";
import { expectPressed } from "../utils/assertions";

test.describe("rewrite console dashboard", () => {
  test("renders the full author console with primary controls", async ({ dashboard, page }) => {
    await dashboard.goto();
    await dashboard.expectAuthorConsole();

    await expect(page.getByText("Quick starts")).toBeVisible();
    await expect(page.getByRole("button", { name: "A rainy day thought" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy rewrite" })).toBeDisabled();
    await expect(page.getByText(/Run a rewrite and the edit will happen here/i)).toBeVisible();
  });

  test("selecting an author updates selected state, headline, mood label, and rewrite CTA", async ({ app, page }) => {
    await app.goto();
    await app.chooseAuthor("Stephen King");

    await expectPressed(page.getByRole("button", { name: "Choose Stephen King" }), true);
    await expectPressed(page.getByRole("button", { name: "Choose J.R.R. Tolkien" }), false);
    await expect(page.getByRole("heading", { name: /Rewrite anything with King as author/i })).toBeVisible();
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
