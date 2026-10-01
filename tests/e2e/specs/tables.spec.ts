import { test, expect } from "../fixtures/test";
import { apiResponses, drafts, labPayload } from "../fixtures/testData";
import { mockGhostwriterApi } from "../utils/mockApi";

test.describe("comparative data surfaces", () => {
  test("Rewrite Lab renders winner, candidate comparison cards, score metrics, and trace details", async ({ app, page }) => {
    const api = await mockGhostwriterApi(page);

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();
    await app.expectRewriteVisible(apiResponses.rewrite);
    await app.openRewriteLab();

    await expect(page.getByRole("region", { name: "Rewrite Lab winner" })).toContainText(
      labPayload.selectionReason,
    );
    await expect(page.getByRole("region", { name: "Candidate comparison" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Candidate comparison" }).getByRole("article")).toHaveCount(3);
    await expect(page.getByLabel("Keep the meaning rubric scores")).toContainText("Meaning");
    await expect(page.getByLabel("Keep the meaning rubric scores")).toContainText("Risk");

    await page.getByText("Trace").click();
    await expect(page.getByText("Provider")).toBeVisible();
    await expect(page.getByText("Playwright", { exact: true })).toBeVisible();
    expect(api.labRequests[0]?.body).toMatchObject({
      author: "tolkien",
      baselineRewrite: apiResponses.rewrite,
      mood: 52,
      source: drafts.default,
    });
  });

  test("using the Rewrite Lab winner replaces the displayed rewrite and shows provenance", async ({ app, page }) => {
    await mockGhostwriterApi(page);

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();
    await app.openRewriteLab();
    await page.getByRole("button", { name: "Use this version" }).click();

    await expect(page.locator(".gw-playback-panel-strong")).toContainText(
      labPayload.candidates[0].rewrite,
    );
    await expect(page.getByLabel(/Rewrite Lab pick: Keep the meaning, 94 overall/)).toBeVisible();
  });
});
