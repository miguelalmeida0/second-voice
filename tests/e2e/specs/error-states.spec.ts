import { test, expect } from "../fixtures/test";
import { apiResponses, drafts, labPayload } from "../fixtures/testData";
import { errorResponse, mockGhostwriterApi } from "../utils/mockApi";

test.describe("error, retry, and empty states", () => {
  for (const endpoint of ["challenge", "rewrite"] as const) {
    test(`${endpoint} cooldown honors a server wait longer than five minutes`, async ({ app, page }) => {
      const api = await mockGhostwriterApi(page, {
        [endpoint]: {
          status: 429,
          headers: { "Retry-After": "900" },
          json: { error: "Please wait a moment before trying another rewrite.", reasonCode: "ABUSE_COOLDOWN" },
        },
      });
      await app.goto();
      await app.fillDraft(drafts.default);
      await app.runRewrite();
      await expect(page.locator(".gw-inspiration-status")).toContainText(/Next rewrite in (900|89\d)s/);
      await expect(app.rewriteButton()).toBeDisabled();
      await expect(app.draftInput()).toHaveValue(drafts.default);
      expect(api.rewriteRequests).toHaveLength(endpoint === "challenge" ? 0 : 1);
    });
  }

  test("rewrite API error shows request id and retry recovers the last attempt", async ({ app, page }) => {
    let rewriteAttempts = 0;

    await mockGhostwriterApi(page, {
      rewrite: () => {
        rewriteAttempts += 1;

        if (rewriteAttempts === 1) {
          return errorResponse("The model is resting. Try again.", 503, "req-rewrite-fail");
        }

        return {
          json: {
            artifactToken: apiResponses.artifactToken,
            error: null,
            moodLabel: "starlit",
            rewrite: apiResponses.rewrite,
          },
          status: 200,
        };
      },
    });

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();

    await expect(
      page.getByRole("alert").filter({ hasText: "The model is resting. Try again." }),
    ).toContainText("The model is resting. Try again.");
    await expect(page.getByText("Request ID req-rewrite-fail")).toBeHidden();
    await page.getByText("Technical details").click();
    await expect(page.getByText("Request ID req-rewrite-fail")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await app.expectRewriteVisible(apiResponses.rewrite);
    expect(rewriteAttempts).toBe(2);
  });

  test("feedback save failure is shown inline without losing rating controls", async ({ app, page }) => {
    await mockGhostwriterApi(page, {
      feedback: errorResponse("Feedback could not be saved.", 500),
    });

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();
    await app.feedbackRating("Landed").click();
    await page.getByRole("button", { name: "Useful" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "Feedback could not be saved." }),
    ).toContainText("Feedback could not be saved.");
    await expect(app.feedbackRating("Landed")).toBeEnabled();
  });

  test("public share failure supports retry from the error state", async ({ app, page }) => {
    let shareAttempts = 0;

    await mockGhostwriterApi(page, {
      share: () => {
        shareAttempts += 1;

        if (shareAttempts === 1) {
          return errorResponse("The public link could not be created.", 500);
        }

        return {
          json: {
            error: null,
            shortId: apiResponses.shareId,
          },
          status: 200,
        };
      },
    });

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();
    await app.createPublicLink();

    await expect(
      page.getByRole("alert").filter({ hasText: "The public link could not be created." }),
    ).toContainText("The public link could not be created.");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText(/Public link (copied\.|ready\.)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Open link" })).toHaveAttribute("href", `/g/${apiResponses.shareId}`);
    expect(shareAttempts).toBe(2);
  });

  test("Rewrite Lab failure shows a retry path and keeps the original rewrite available", async ({ app, page }) => {
    let labAttempts = 0;

    await mockGhostwriterApi(page, {
      lab: () => {
        labAttempts += 1;

        if (labAttempts === 1) {
          return {
            json: {
              error: "Rewrite Lab could not finish this run.",
              lab: null,
            },
            status: 502,
          };
        }

        return {
          json: {
            error: null,
            lab: labPayload,
          },
          status: 200,
        };
      },
    });

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();
    await app.openRewriteLab();

    await expect(page.getByRole("status")).toContainText("Rewrite Lab could not finish this run.");
    await expect(page.getByText(apiResponses.rewrite)).toBeVisible();

    await page.getByRole("button", { name: "Try Rewrite Lab again" }).click();
    await expect(page.getByRole("region", { name: "Rewrite Lab winner" })).toContainText(
      labPayload.selectionReason,
    );
    expect(labAttempts).toBe(2);
  });

  test("invalid public permalink renders a useful empty state with recovery links", async ({ page }) => {
    await page.goto("/g/invalid-id");

    await expect(page.getByRole("heading", { name: "Lost in the draft." })).toBeVisible();
    await expect(page.getByText("That rewrite does not exist")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Second Voice AI" })).toHaveAttribute(
      "href",
      "/second-voice",
    );
    await expect(page.getByRole("link", { name: "Read the case study" })).toHaveAttribute(
      "href",
      "/second-voice/case-study",
    );
  });
});
