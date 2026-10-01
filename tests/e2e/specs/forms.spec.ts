import { test, expect } from "../fixtures/test";
import { apiResponses, drafts } from "../fixtures/testData";
import { mockGhostwriterApi } from "../utils/mockApi";

test.describe("composer forms and rewrite submissions", () => {
  test("textarea validation disables empty submissions and enforces the 2000 character limit", async ({ app, page }) => {
    await app.goto();

    await app.fillDraft("");
    await expect(app.rewriteButton()).toBeDisabled();

    await app.fillDraft("a".repeat(2100));
    await expect(page.getByText("2000 / 2000")).toBeVisible();
    await expect(app.draftInput()).toHaveValue("a".repeat(2000));
    await expect(app.rewriteButton()).toBeEnabled();
  });

  test("quick-start sample buttons populate the composer", async ({ app }) => {
    await app.goto();
    await app.fillDraft("");
    await app.openQuickStarts();
    await app.page.getByRole("button", { name: "A moonlit thought" }).click();

    await expect(app.draftInput()).toHaveValue(/Maybe the moon only looks that gentle/);
  });

  test("submits the selected author rewrite payload and renders result actions", async ({ app, page }) => {
    const api = await mockGhostwriterApi(page);

    await app.goto();
    await app.chooseAuthor("Stephen King");
    await app.setMood("73");
    await app.fillDraft(drafts.default);
    await app.runRewrite();

    await app.expectRewriteVisible(apiResponses.rewrite);
    await app.copyRewrite();
    await expect(page.getByText("Did this edit land?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create public link" })).toBeVisible();

    expect(api.rewriteRequests[0]?.body).toMatchObject({
      author: "stephenking",
      mode: "author",
      mood: 73,
      share: false,
      text: drafts.default,
    });
  });

  test("shows loading state while a rewrite request is in flight", async ({ app, page }) => {
    await mockGhostwriterApi(page, {
      rewrite: {
        delayMs: 1_200,
        json: {
          artifactToken: apiResponses.artifactToken,
          error: null,
          moodLabel: "starlit",
          rewrite: apiResponses.rewrite,
        },
        status: 200,
      },
    });

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();

    await expect(page.getByRole("status")).toContainText(/Rewriting with Tolkien/i);
    await expect(page.getByRole("button", { name: /Rewriting/ }).first()).toBeDisabled();
    await app.expectRewriteVisible(apiResponses.rewrite);
  });

  test("surprise me submits a deterministic demo payload when the composer is empty", async ({ app, page }) => {
    const api = await mockGhostwriterApi(page);

    await app.goto();
    await app.fillDraft("");
    await app.composerSurpriseButton().click();

    await app.expectRewriteVisible(apiResponses.rewrite);
    expect(typeof api.rewriteRequests[0]?.body.text).toBe("string");
    expect((api.rewriteRequests[0]?.body.text as string).length).toBeGreaterThan(20);
    expect(api.rewriteRequests[0]?.body.mode).toBe("author");
  });
});
