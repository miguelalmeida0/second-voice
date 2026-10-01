import { test, expect } from "../fixtures/test";
import { apiResponses, drafts } from "../fixtures/testData";
import { mockGhostwriterApi } from "../utils/mockApi";

test.describe("drawers, confirmations, and modal-like panels", () => {
  test("How it works drawer opens, focuses, closes with Escape, and restores trigger focus", async ({ app, page }) => {
    await app.goto();
    await app.howItWorksButton().focus();
    await app.openHowItWorks();

    await expect(
      page.getByRole("button", { name: "Close How it works", exact: true }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "How to use Second Voice" })).toBeHidden();
    await expect(app.howItWorksButton()).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("drawer case-study CTA closes the drawer and navigates", async ({ app, page }) => {
    await app.goto();
    await app.openHowItWorks();
    await page.getByRole("dialog", { name: "How to use Second Voice" }).getByRole("link", { name: "Read the case study" }).click();

    await expect(page).toHaveURL(/\/second-voice\/case-study$/);
    await expect(page.getByRole("link", { name: "Back to Second Voice AI" })).toBeVisible();
  });

  test("public link confirmation supports cancel, create, copied status, and open-link navigation target", async ({ app, page }) => {
    const api = await mockGhostwriterApi(page);

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();
    await app.expectRewriteVisible(apiResponses.rewrite);

    await page.getByRole("button", { name: "Create public link" }).click();
    await expect(page.getByText(/This will create a public permalink/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(/This will create a public permalink/)).toHaveCount(0);

    await app.createPublicLink();
    await expect(page.getByText("Public link copied.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open link" })).toHaveAttribute("href", `/g/${apiResponses.shareId}`);
    expect(api.shareRequests[0]?.body).toMatchObject({
      author: "tolkien",
      artifactToken: apiResponses.artifactToken,
      rewrite: apiResponses.rewrite,
      text: drafts.default,
    });
  });
});
