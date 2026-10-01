import { expect, type Locator, type Page } from "@playwright/test";

export async function expectPressed(locator: Locator, pressed: boolean) {
  await expect(locator).toHaveAttribute("aria-pressed", String(pressed));
}

export async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const body = document.body;

    return {
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth,
    };
  });

  expect(metrics.documentScrollWidth, "document should not overflow horizontally").toBeLessThanOrEqual(
    metrics.documentClientWidth + 1,
  );
  expect(metrics.bodyScrollWidth, "body should not overflow horizontally").toBeLessThanOrEqual(
    metrics.bodyClientWidth + 1,
  );
}

export async function expectLinkPath(locator: Locator, path: string) {
  await expect(locator).toHaveAttribute("href", path);
}
