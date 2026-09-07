import { test, expect } from "../fixtures/test";
import { caseStudyTreatments } from "../fixtures/testData";
import { expectPressed } from "../utils/assertions";

test.describe("filters, tabs, and segmented controls", () => {
  test("rewrite mode segmented control switches between authors and outcomes without losing composer text", async ({ app }) => {
    await app.goto();
    await app.fillDraft("Keep this sentence while I change controls.");

    await app.switchToOutcomes();
    await expectPressed(app.outcomeModeButton(), true);
    await expect(app.page.getByRole("heading", { name: "Choose an outcome" })).toBeVisible();
    await expect(app.draftInput()).toHaveValue("Keep this sentence while I change controls.");

    await app.switchToAuthors();
    await expectPressed(app.authorModeButton(), true);
    await expect(app.page.getByRole("heading", { name: "Choose a writer" })).toBeVisible();
    await expect(app.draftInput()).toHaveValue("Keep this sentence while I change controls.");
  });

  test("outcome filter buttons update selected state and helper copy", async ({ app, page }) => {
    await app.goto();
    await app.switchToOutcomes();
    await app.chooseOutcome("Get a reply");

    await expectPressed(page.getByRole("button", { name: /Get a reply/ }), true);
    await expectPressed(page.getByRole("button", { name: /Improve clarity/ }), false);
    await expect(page.getByRole("button", { name: "Rewrite to get a reply" })).toBeVisible();
    await expect(page.getByText("Warm, direct, easy to answer.", { exact: true })).toBeVisible();
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
