import { expect, test } from "@playwright/test";

test("portfolio film replays the real Tolkien workflow without provider traffic", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/ghostwriter")) {
      apiRequests.push(request.url());
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/demo/portfolio-film?once=1");

  const film = page.getByTestId("ghostwriter-portfolio-film");
  const compactLayout = (page.viewportSize()?.width ?? 901) <= 900;
  const finalRewrite = page.getByText(
    "Each winter the iron lamps that lined the harbor guttered out, one after another, until only darkness lay upon the water's edge. Yet in that cold, starlit hush Elias kept the last lantern burning, though no ship had returned to dock in twenty years.",
  );
  await expect(film).toHaveAttribute("data-film-ready", "true");
  await expect(page.getByRole("heading", { name: "The last harbor light" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Choose J.R.R. Tolkien/ })).toBeVisible();

  if (compactLayout) {
    await expect(page.locator('section[aria-label="Inspectable revision"]')).toBeHidden();
    await expect(finalRewrite).toBeAttached({ timeout: 15_000 });
  } else {
    await expect(finalRewrite).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Rewrite copied" })).toBeVisible({
      timeout: 15_000,
    });
  }

  await expect(film).toHaveAttribute("data-film-complete", "true", {
    timeout: 25_000,
  });

  expect(apiRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
