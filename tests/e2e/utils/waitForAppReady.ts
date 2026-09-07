import { expect, type Page } from "@playwright/test";

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByRole("heading", { name: /rewrite anything/i })).toBeVisible();
  await expect(page.getByLabel("Write or paste here")).toBeVisible();
  await expect(page.locator(".ghostwriter")).toHaveAttribute("data-app-ready", "true");
  await page.waitForFunction(
    () => {
      const root = document.querySelector(".ghostwriter");
      return (
        root instanceof HTMLElement &&
        getComputedStyle(root).getPropertyValue("--gw-button-radius").trim() === "12px"
      );
    },
    undefined,
    { timeout: 30_000 },
  );
}
