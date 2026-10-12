import { expect, type Page } from "@playwright/test";

export async function waitForAppReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Second Voice", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Write or paste here")).toBeVisible();
  // The editor is server-rendered before preferences hydrate. Interaction
  // tests wait for preferences without treating this as a visibility gate.
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
