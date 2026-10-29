import { test, expect, type Page } from "@playwright/test";
import { mockGhostwriterApi } from "../utils/mockApi";
import AxeBuilder from "@axe-core/playwright";

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

test("denied browser storage never prevents editor readiness or changing direction", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const key of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, key, { get() { throw new DOMException("Storage disabled by test", "SecurityError"); } });
    }
  });
  await page.goto("/");
  await expect(page.locator('[data-app-ready="true"]')).toBeVisible();
  await page.locator("#second-voice-input").fill("Keep writing when storage is unavailable.");
  await page.getByRole("combobox", { name: "Rewrite mode" }).click();
  await page.getByRole("option", { name: "Outcomes", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Writing outcome" })).toBeVisible();
  await expect(page.locator("#second-voice-input")).toHaveValue("Keep writing when storage is unavailable.");
  expect(errors).toEqual([]);
});

test("help trigger references a dialog only while that dialog exists", async ({ page }) => {
  await openStudio(page, 390);
  const trigger = page.getByRole("button", { name: "How it works", exact: true });
  await expect(trigger).not.toHaveAttribute("aria-controls", "gw-how-drawer");
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-controls", "gw-how-drawer");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("keyboard focus is visible on the editor itself", async ({ page }) => {
  await openStudio(page, 390);
  await page.locator("#second-voice-input").focus();
  const outline = await page.locator("#second-voice-input").evaluate(el => getComputedStyle(el).outlineWidth);
  expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
});

test("mobile dock reserves its place and never covers quick starts or settings", async ({ page }) => {
  for (const width of [320, 390]) {
    await openStudio(page, width);
    const section = page.locator(".duet-draft-action .duet-actions");
    expect((await section.boundingBox())!.height).toBeGreaterThan(0);
    for (const selector of [".duet-quick-drafts button", ".gw-inspiration-toggle", ".studio-select-trigger", ".duet-draft-footer a"]) {
      for (const control of await page.locator(selector).all()) {
        await control.scrollIntoViewIfNeeded();
        const blocked = await control.evaluate(el => {
          const r = el.getBoundingClientRect();
          return [.2, .5, .8].some(y => {
            const py = r.top + r.height * y;
            if (py < 0 || py >= innerHeight) return false;
            const hit = document.elementFromPoint(r.left + r.width / 2, py);
            return !hit || !el.contains(hit);
          });
        });
        expect.soft(blocked, `${width}px ${await control.innerText()}`).toBe(false);
      }
    }
  }
});

test("legal surfaces wrap enlarged text and extended navigation without collisions", async ({ page }) => {
  for (const route of ["/legal", "/privacy"]) {
    for (const stress of ["large type", "long content"] as const) {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await stressText(page, stress);
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route}: ${stress}`).toBe(true);
      const clipping = await page.locator("h1, .sv-legal-brand").evaluateAll(elements => elements.map(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        const outer = el.getBoundingClientRect();
        return [...range.getClientRects()].some(r => r.left < outer.left - 2 || r.right > outer.right + 2);
      }));
      expect.soft(clipping, `${route}: ${stress}`).not.toContain(true);
      const overlap = await page.locator(".sv-legal-nav").evaluate(nav => {
        const [a, b] = [...nav.children].map(el => el.getBoundingClientRect());
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      });
      expect.soft(overlap, `${route}: ${stress}`).toBe(false);
    }
  }
});

test("public legal pages receive a document CSP and can navigate after hydration", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const path of ["/legal", "/privacy"]) {
    const response = await page.goto(path);
    const csp = response?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("script-src");
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    // Check the server document. Development HMR can subsequently insert
    // scripts trusted through strict-dynamic, without copying the nonce.
    const html = await response!.text();
    const scriptNonces = await page.evaluate(html => [...new DOMParser().parseFromString(html, "text/html")
      .querySelectorAll<HTMLScriptElement>("script:not([type='application/ld+json'])")].map(script => script.nonce), html);
    expect(scriptNonces.length).toBeGreaterThan(0);
    expect(scriptNonces.every(value => value === nonce)).toBe(true);
    await page.locator(".sv-legal-brand").click();
    await expect(page.locator('[data-app-ready="true"]')).toBeVisible();
    await page.getByRole("button", { name: "How it works", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("contrast is measurable on both desktop panels and legal links", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  for (const path of ["/", "/legal", "/privacy"]) {
    await page.goto(path);
    if (path === "/") await expect(page.locator('[data-app-ready="true"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
    expect(result.violations, path).toEqual([]);
    expect(result.incomplete.filter(check => check.nodes.some(node => node.any.some(check =>
      ["pseudoContent", "nonBmp"].includes(String(check.data?.messageKey))))), path).toEqual([]);
  }
});

test("initial layout stays within the audit shift budget across viewports", async ({ page }, info) => {
  await page.addInitScript(() => {
    const metrics = window as Window & { auditCLS?: number };
    metrics.auditCLS = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]) {
        if (!entry.hadRecentInput) metrics.auditCLS = (metrics.auditCLS ?? 0) + entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.route("**/api/ghostwriter/auth", async route => {
    await new Promise(resolve => setTimeout(resolve, 350));
    await route.fulfill({ json: { mode: "anonymous", allowance: { remaining: 3, todayRemaining: 3, available: true } } });
  });
  const samples = [];
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator('[data-session-status="anonymous"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const cls = await page.evaluate(() => (window as Window & { auditCLS?: number }).auditCLS ?? 0);
    samples.push({ width, height, cls });
    expect.soft(cls, `${width}x${height}`).toBeLessThanOrEqual(.1);
  }
  await info.attach("layout-shift-samples", { body: JSON.stringify(samples), contentType: "application/json" });
});

test("legal and account keyboard stops stay visible under enlarged and extended text", async ({ page }) => {
  for (const path of ["/privacy", "/legal", "/account"]) {
    for (const stress of ["large type", "long content"] as const) {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await stressText(page, stress);
      for (let step = 0; step < 12; step++) {
        await page.keyboard.press("Tab");
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          if (!(el instanceof HTMLElement) || el === document.body) return null;
          const rects = [...el.getClientRects()];
          // Inline links can have several fragments. Focus is visible when at
          // least one real line fragment is fully in the viewport.
          return { text: el.textContent, visible: rects.some(r => r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight) };
        });
        if (focused) expect.soft(focused.visible, `${path}: ${stress}: ${focused.text}`).toBe(true);
      }
    }
  }
});

test("mobile docking is stable at control edges and reserves the safe-area inset", async ({ page }) => {
  await openStudio(page, 390);
  await page.addStyleTag({ content: ".duet-action-primary { --duet-safe-bottom: 34px; }" });
  for (const control of await page.locator(".duet-quick-drafts button, .studio-select-trigger").all()) {
    await control.evaluate(el => window.scrollBy(0, el.getBoundingClientRect().bottom - 783));
    await page.waitForTimeout(100);
    const changes = await page.locator(".duet-action-primary").evaluate(el => new Promise<number>(resolve => {
      let changes = 0;
      const observer = new MutationObserver(records => { changes += records.filter(r => r.attributeName === "data-docked").length; });
      observer.observe(el, { attributes: true });
      setTimeout(() => { observer.disconnect(); resolve(changes); }, 200);
    }));
    expect(changes).toBeLessThanOrEqual(1);
  }
  const clearance = await page.locator("main").evaluate(el => parseFloat(el.style.getPropertyValue("--duet-action-clearance")));
  expect(clearance).toBeGreaterThanOrEqual(48 + 9 + 34 + 24);
});

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
