import { test, expect } from "../fixtures/test";
import { apiResponses } from "../fixtures/testData";
import { mockGhostwriterApi } from "../utils/mockApi";

test.describe("Duet feature parity edge cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("every voice and outcome sends its selected payload only on explicit activation", async ({ app, page }) => {
    const api = await mockGhostwriterApi(page);
    await app.goto();
    const draft = "  Olá 世界 — keep my meaning.\nA second line.  ";
    await app.fillDraft(draft);
    const authors = [["J.R.R. Tolkien", "tolkien"], ["Stephen King", "stephenking"], ["Leo Tolstoy", "tolstoy"], ["Ernest Hemingway", "hemingway"]];
    let requests = 0;
    for (const [name, author] of authors) {
      await app.chooseAuthor(name);
      for (const mood of [0, 100]) {
        await app.setMood(String(mood));
        expect(api.rewriteRequests).toHaveLength(requests);
        await app.runRewrite();
        await expect(app.rewriteButton()).toBeEnabled();
        expect(api.rewriteRequests).toHaveLength(++requests);
        expect(api.rewriteRequests.at(-1)?.body).toMatchObject({ author, mood, mode: "author", text: draft.trim(), share: false });
        await expect(app.draftInput()).toHaveValue(draft);
      }
    }
    await app.switchToOutcomes();
    for (const [label, outcome] of [["Improve clarity", "clarity"], ["Get a reply", "reply"], ["Sound confident", "confident"], ["Be concise", "concise"], ["Be persuasive", "persuasive"]]) {
      await app.chooseOutcome(label);
      expect(api.rewriteRequests).toHaveLength(requests);
      await app.runRewrite();
      await expect(app.rewriteButton()).toBeEnabled();
      expect(api.rewriteRequests).toHaveLength(++requests);
      expect(api.rewriteRequests.at(-1)?.body).toMatchObject({ mode: "outcome", outcome, text: draft.trim(), share: false });
    }
    expect(new Set(api.rewriteRequests.map(request => request.headers["idempotency-key"])).size).toBe(13);
  });

  test("failed copy stays truthful, restores focus, and does not leak into the next result", async ({ app, page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
      document.execCommand = () => false;
    });
    await mockGhostwriterApi(page);
    await app.goto();
    await app.fillDraft("A quiet afternoon.");
    await app.runRewrite();
    const copy = page.getByRole("button", { name: "Copy rewrite" });
    await copy.focus();
    // Keyboard activation preserves the focused trigger on Safari too; Safari
    // intentionally does not focus buttons on a pointer click.
    await copy.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Copy failed." })).toContainText("Copy failed.");
    await expect(page.getByRole("button", { name: "Rewrite copied" })).toHaveCount(0);
    await expect(copy).toBeFocused();
    await app.runRewrite();
    await expect(app.rewriteButton()).toBeEnabled();
    await expect(page.getByText("Copy failed. Select the rewrite and copy it manually.")).toHaveCount(0);
  });

  test("clipboard denial preserves a created public link without repeating its request", async ({ app, page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
      document.execCommand = () => false;
    });
    const api = await mockGhostwriterApi(page);
    await app.goto();
    await app.fillDraft("A quiet afternoon.");
    await app.runRewrite();
    await app.createPublicLink();
    await expect(page.getByText("Public link ready.")).toBeVisible();
    await expect(page.getByText("Public link copied.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open link" })).toHaveAttribute("href", `/g/${apiResponses.shareId}`);
    expect(api.shareRequests).toHaveLength(1);
  });

  test("Rewrite collapses the open Quick starts disclosure without losing the sample", async ({ app, page }) => {
    const api = await mockGhostwriterApi(page);
    await app.goto();
    await app.openQuickStarts();
    await page.getByRole("button", { name: "A moonlit thought" }).click();
    const sample = await app.draftInput().inputValue();
    await expect(app.quickStartsToggle()).toHaveAttribute("aria-expanded", "true");
    await app.runRewrite();
    await expect(app.quickStartsToggle()).toHaveAttribute("aria-expanded", "false");
    await expect(app.draftInput()).toHaveValue(sample);
    expect(api.rewriteRequests).toHaveLength(1);
  });
});
