import { expect, type Page } from "@playwright/test";

export async function waitForAppReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Second Voice", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Write or paste here")).toBeVisible();
  // second-voice/loading.tsx's Suspense fallback also carries the bare
  // "ghostwriter" class, so it can still be attached (mid-streaming-swap)
  // alongside the real app root. Only the hydrated studio root ever sets
  // data-app-ready, so scope to it directly instead of the shared class.
  await expect(page.locator(".ghostwriter[data-app-ready]")).toHaveAttribute("data-app-ready", "true");
  await page.waitForFunction(
    () => {
      const root = document.querySelector(".ghostwriter[data-app-ready]");
      return (
        root instanceof HTMLElement &&
        getComputedStyle(root).getPropertyValue("--gw-button-radius").trim() === "12px"
      );
    },
    undefined,
    { timeout: 30_000 },
  );
}
