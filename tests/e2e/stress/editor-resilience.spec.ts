import { test, expect, type Page } from "@playwright/test";
import { mockGhostwriterApi } from "../utils/mockApi";

type Stress = "long content" | "large type";

async function stressText(page: Page, stress: Stress) {
  await page.evaluate(mode => {
    const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.textContent?.trim() && !node.parentElement?.closest("script, style, svg, textarea")) nodes.push(node);
    }
    if (mode === "long content") {
      for (const node of nodes) node.textContent = `${node.textContent} — ${node.textContent} (extended translation)`;
    } else {
      const sizes = [...new Set(nodes.map(node => node.parentElement!))]
        .map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
      for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
    }
  }, stress);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockGhostwriterApi(page);
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({
    json: { mode: "anonymous", allowance: { remaining: 3, todayRemaining: 3, available: true } },
  }));
});

async function openStudio(page: Page, width: number) {
  await page.setViewportSize({ width, height: 738 });
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator('[data-session-status="anonymous"]')).toBeVisible();
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const stress of ["long content", "large type"] as const) {
  test(`${stress}: custom dropdown text stays readable without clipping`, async ({ page }, info) => {
    // Catches fixed line heights and single-line clipping in the shared trigger.
    for (const width of [1512, 768, 390, 320]) {
      await openStudio(page, width);
      await stressText(page, stress);
      const metrics = await page.locator(".studio-select-trigger > span").evaluateAll(elements => elements.map(el => ({
        text: el.textContent,
        horizontal: el.scrollWidth - el.clientWidth,
        vertical: el.scrollHeight - el.clientHeight,
      })));
      for (const metric of metrics) {
        expect.soft(metric.horizontal, `${width}px: ${metric.text}`).toBeLessThanOrEqual(1);
        expect.soft(metric.vertical, `${width}px: ${metric.text}`).toBeLessThanOrEqual(1);
      }
      await page.getByRole("combobox", { name: "Author", exact: true }).click();
      const menu = (await page.getByRole("listbox").boundingBox())!;
      expect(menu.x).toBeGreaterThanOrEqual(8);
      expect(menu.x + menu.width).toBeLessThanOrEqual(width - 7);
      expect(menu.y).toBeGreaterThanOrEqual(8);
      expect(menu.y + menu.height).toBeLessThanOrEqual(731);
      await page.keyboard.press("Escape");
      await page.screenshot({ path: info.outputPath(`${stress}-${width}.png`), fullPage: true });
    }
  });

  test(`${stress}: header actions do not overlap or leave their half of the page`, async ({ page }) => {
    // Catches absolutely positioned identity controls with a fixed reserved gap.
    for (const width of [1512, 768, 390, 320]) {
      await openStudio(page, width);
      await stressText(page, stress);
      const boxes = await page.locator('.duet-header nav a, .duet-header nav button, main > .duet-identity')
        .evaluateAll(elements => elements.map(el => {
          const r = el.getBoundingClientRect();
          return { text: el.textContent, x: r.x, right: r.right, y: r.y, bottom: r.bottom };
        }));
      expect(boxes).toHaveLength(3);
      for (const [index, box] of boxes.entries()) {
        expect.soft(box.x, `${width}px: ${box.text}`).toBeGreaterThanOrEqual(width >= 768 ? width / 2 : 0);
        expect.soft(box.right, `${width}px: ${box.text}`).toBeLessThanOrEqual(width);
        for (const other of boxes.slice(index + 1)) {
          const overlap = box.x < other.right && box.right > other.x && box.y < other.bottom && box.bottom > other.y;
          expect.soft(overlap, `${width}px: ${box.text} / ${other.text}`).toBe(false);
        }
      }
    }
  });

  test(`${stress}: Rewrite label and arrow stay inside their button`, async ({ page }) => {
    // Catches a fixed-width action paired with a nowrap label.
    for (const width of [1512, 768, 390, 320]) {
      await openStudio(page, width);
      await stressText(page, stress);
      const metrics = await page.locator(".gw-inspiration-rewrite").evaluate(button => {
        const outer = button.getBoundingClientRect();
        return [...button.children].map(child => {
          const inner = child.getBoundingClientRect();
          return { left: inner.left - outer.left, right: outer.right - inner.right, bottom: outer.bottom - inner.bottom };
        });
      });
      for (const metric of metrics) {
        expect.soft(metric.left, `${width}px`).toBeGreaterThanOrEqual(0);
        expect.soft(metric.right, `${width}px`).toBeGreaterThanOrEqual(0);
        expect.soft(metric.bottom, `${width}px`).toBeGreaterThanOrEqual(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test("one accessible sign-in control starts authentication and reports failure", async ({ page }) => {
  // Catches the offscreen duplicate control without breaking the event bridge.
  await openStudio(page, 1512);
  const signIn = page.getByRole("button", { name: "Sign in with GitHub", exact: true });
  await expect(signIn).toHaveCount(1);
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({
    status: 503, json: { message: "Sign-in is temporarily unavailable. Try again." },
  }));
  await signIn.click();
  await expect(page.getByRole("status").filter({ hasText: "Sign-in is temporarily unavailable" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Second Voice AI", exact: true })).toBeAttached();
  await expect(page.getByLabel("Write or paste here")).toBeVisible();
});

test("signed-in navigation keeps its sign-out icon and touch target visible", async ({ page }) => {
  // Moving identity into navigation must not inherit decorative-arrow hiding.
  await page.route("**/api/ghostwriter/auth", route => route.fulfill({
    json: { mode: "authenticated", allowance: { remaining: 3, todayRemaining: 3, available: true } },
  }));
  await page.goto("/", { waitUntil: "commit" });
  const signOut = page.getByRole("button", { name: "Sign out", exact: true });
  for (const width of [1512, 390, 320]) {
    await page.setViewportSize({ width, height: 738 });
    await expect(signOut.locator("svg")).toBeVisible();
    const bounds = (await signOut.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
});
