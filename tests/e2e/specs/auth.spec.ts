import { test, expect } from "../fixtures/test";
import { drafts } from "../fixtures/testData";
import { mockGhostwriterApi } from "../utils/mockApi";

test.describe("public session and request shield", () => {
  test("creates the expected shield cookies for an unauthenticated visitor", async ({ auth }) => {
    await auth.goto();
    await auth.expectShieldSessionCookies();
  });

  test("sends the CSRF token on challenge and rewrite requests", async ({ app, page }) => {
    const api = await mockGhostwriterApi(page);

    await app.goto();
    await app.fillDraft(drafts.default);
    await app.runRewrite();

    await expect.poll(() => api.rewriteRequests.length).toBe(1);

    const cookies = await page.context().cookies();
    const csrfCookie = cookies.find((cookie) => cookie.name === "gw_csrf");

    expect(csrfCookie?.value).toBeTruthy();
    expect(api.challengeRequests[0]?.headers["x-ghostwriter-csrf"]).toBe(csrfCookie?.value);
    expect(api.rewriteRequests[0]?.headers["x-ghostwriter-csrf"]).toBe(csrfCookie?.value);
  });

  test("non-production fixture mode keeps the mocked UI testable with paid AI disabled", async ({ auth, page }) => {
    await auth.goto();

    await expect(page.getByLabel("Write or paste here")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Rewrite as Tolkien$/ })).toBeEnabled();
  });
});
