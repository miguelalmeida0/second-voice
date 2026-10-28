import { test, expect } from "../fixtures/test";
import { returningVisitor } from "../fixtures/users";

test.describe("local user preferences", () => {
  test("persists rewrite mode and outcome selection across reloads", async ({ app, page }) => {
    await app.goto();
    await app.switchToOutcomes();
    await app.chooseOutcome("Be persuasive");

    await page.reload();

    await expect(app.rewriteModeSelect()).toHaveValue("outcome");
    await expect(page.getByRole("combobox", { name: "Writing outcome" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Writing outcome" }).locator("option:checked")).toHaveText("Be persuasive");
    await expect(page.getByRole("button", { name: "Rewrite my draft" })).toBeVisible();
  });

  test("ignores invalid stored preferences and returns to safe defaults", async ({ page }) => {
    await page.addInitScript((keys) => {
      window.localStorage.setItem(keys.rewriteMode, "sideways");
      window.localStorage.setItem(keys.outcome, "telepathy");
    }, returningVisitor.localStorage);

    await page.goto("/second-voice");

    await expect(page.getByRole("combobox", { name: "Rewrite mode" })).toHaveValue("author");
    await expect(page.getByRole("combobox", { name: "Author", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Rewrite my draft$/ })).toBeVisible();
  });
});
