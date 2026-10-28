import { test, expect } from "../fixtures/test";
import { caseStudyTreatments } from "../fixtures/testData";
import { expectPressed } from "../utils/assertions";

test.describe("filters, tabs, and segmented controls", () => {
  test("rewrite mode selector switches between authors and outcomes without losing composer text", async ({ app }) => {
    await app.goto();
    await app.fillDraft("Keep this sentence while I change controls.");

    await app.switchToOutcomes();
    await expect(app.rewriteModeSelect()).toHaveValue("outcome");
    await expect(app.page.getByRole("combobox", { name: "Writing outcome" })).toBeVisible();
    await expect(app.draftInput()).toHaveValue("Keep this sentence while I change controls.");

    await app.switchToAuthors();
    await expect(app.rewriteModeSelect()).toHaveValue("author");
    await expect(app.page.getByRole("combobox", { name: "Author", exact: true })).toBeVisible();
    await expect(app.draftInput()).toHaveValue("Keep this sentence while I change controls.");
  });

  test("outcome selector preserves the chosen direction", async ({ app, page }) => {
    await app.goto();
    await app.switchToOutcomes();
    await app.chooseOutcome("Get a reply");

    await expect(page.getByRole("combobox", { name: "Writing outcome" }).locator("option:checked")).toHaveText("Get a reply");
    await expect(page.getByRole("button", { name: "Rewrite my draft" })).toBeVisible();
  });

  test("case-study treatment tabs update live example text and pressed state", async ({ page }) => {
    await page.goto("/second-voice/case-study");

    await page.getByRole("button", { name: "stranger" }).click();
    await expectPressed(page.getByRole("button", { name: "stranger" }), true);
    await expect(page.getByText(caseStudyTreatments.stranger)).toBeVisible();

    await page.getByRole("button", { name: "plainer" }).click();
    await expectPressed(page.getByRole("button", { name: "plainer" }), true);
    await expect(page.getByText(caseStudyTreatments.plainer)).toBeVisible();
  });
});
