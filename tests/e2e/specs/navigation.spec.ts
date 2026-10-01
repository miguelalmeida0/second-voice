import { test, expect } from "../fixtures/test";
import { waitForAppReady } from "../utils/waitForAppReady";

test.describe("navigation and route coverage", () => {
  test("redirects root and legacy Ghostwriter routes to canonical Second Voice routes", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/second-voice$/);
    await waitForAppReady(page);

    await page.goto("/ghostwriter");
    await expect(page).toHaveURL(/\/second-voice$/);
    await waitForAppReady(page);

    await page.goto("/ghostwriter/case-study");
    await expect(page).toHaveURL(/\/second-voice\/case-study$/);
    await expect(page.getByRole("link", { name: "Back to Second Voice AI" })).toBeVisible();
  });

  test("navigates between app, case study, and invalid public permalink recovery paths", async ({ app, page }) => {
    await app.goto();
    await app.openHowItWorks();
    await app.caseStudyLink().click();

    await expect(page).toHaveURL(/\/second-voice\/case-study$/);
    await expect(page.getByRole("link", { name: "Back to Second Voice AI" })).toBeVisible();

    await page.getByRole("link", { name: "Back to Second Voice AI" }).click();
    await expect(page).toHaveURL(/\/second-voice$/);
    await waitForAppReady(page);

    await page.goto("/g/invalid-id");
    await expect(page.getByRole("heading", { name: "Lost in the draft." })).toBeVisible();
    await page.getByRole("link", { name: "Back to Second Voice AI" }).click();
    await expect(page).toHaveURL(/\/second-voice$/);
    await waitForAppReady(page);
  });

  test("exposes all primary app links with stable accessible names", async ({ app, page }) => {
    await app.goto();

    await expect(page.getByRole("button", { name: "How it works" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Surprise me" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Rewrite as Tolkien$/ })).toBeVisible();

    await app.openHowItWorks();
    await expect(app.caseStudyLink()).toHaveAttribute("href", "/second-voice/case-study");
  });
});
