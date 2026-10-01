import { test, expect } from "../fixtures/test";
import { returningVisitor } from "../fixtures/users";
import { expectPressed } from "../utils/assertions";

test.describe("local user preferences", () => {
  test("persists rewrite mode and outcome selection across reloads", async ({ app, page }) => {
    await app.goto();
    await app.switchToOutcomes();
    await app.chooseOutcome("Be persuasive");

    await page.reload();

    await expectPressed(app.outcomeModeButton(), true);
    await expect(page.getByRole("group", { name: "Outcome options" })).toBeVisible();
    await expectPressed(page.getByRole("button", { name: /Be persuasive/ }), true);
    await expect(page.getByRole("button", { name: "Rewrite to be persuasive" })).toBeVisible();
  });

  test("ignores invalid stored preferences and returns to safe defaults", async ({ page }) => {
    await page.addInitScript((keys) => {
      window.localStorage.setItem(keys.rewriteMode, "sideways");
      window.localStorage.setItem(keys.outcome, "telepathy");
    }, returningVisitor.localStorage);

    await page.goto("/second-voice");

    await expectPressed(page.getByRole("button", { name: "Authors" }), true);
    await expect(page.getByRole("group", { name: "Choose an author" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Rewrite as Tolkien$/ })).toBeVisible();
  });
});
