import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../fixtures/test";
import { apiResponses } from "../fixtures/testData";
import { mockGhostwriterApi } from "../utils/mockApi";

const source = "The rain stopped.\n\nMara waited.";
const result = "The rain softened.\n\nMara listened.";
const response = (rewrite: string) => ({
  json: {
    artifactToken: apiResponses.artifactToken,
    error: null,
    moodLabel: "starlit",
    rewrite,
    shortId: null,
  },
});

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { copiedText?: string }).copiedText = text;
        },
      },
    });
  });
});

test("three views share mixed decisions, undo, reset, and the immutable run source", async ({
  app,
  page,
}, testInfo) => {
  // Catches lost reducer state on layout/visibility changes and comparison against the live composer.
  await mockGhostwriterApi(page, { rewrite: response(result) });
  await app.goto();
  await app.fillDraft(source);
  await app.runRewrite();
  const entry = page.getByRole("button", {
    name: "Review changes",
    exact: true,
  });
  await entry.click();
  const review = page.getByRole("region", { name: "Review your rewrite" });
  await expect(app.draftInput()).toBeHidden();
  await expect(review.getByRole("status")).toContainText("0 of 2 reviewed");
  await review
    .getByRole("button", { name: "Keep original", exact: true })
    .click();
  await review.getByRole("button", { name: "Inline", exact: true }).click();
  await expect(
    review.getByRole("button", { name: "Inline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const inline = review
    .getByRole("button", {
      name: "Change 2: waited → listened; pending",
      exact: true,
    })
    .first();
  await inline.focus();
  await inline.press(" ");
  await expect(inline).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("review-inline.png"),
    fullPage: true,
  });
  await review.getByRole("button", { name: "Focus", exact: true }).click();
  await review.getByText("Read the full original", { exact: true }).click();
  await expect(review.getByTestId("full-original")).toHaveText(source);
  await page.screenshot({
    path: testInfo.outputPath("review-focus.png"),
    fullPage: true,
  });
  await review
    .getByRole("button", { name: "Accept change", exact: true })
    .click();
  await expect(review.getByRole("status")).toContainText("2 of 2 reviewed");
  await review
    .getByRole("button", { name: "Copy revision", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as Window & { copiedText?: string }).copiedText,
    ),
  ).toBe("The rain stopped.\n\nMara listened.");
  await review.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("1 of 2 reviewed");
  await review.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("0 of 2 reviewed");
  await review.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("1 of 2 reviewed");
  await review
    .getByRole("button", { name: "Back to rewrite", exact: true })
    .click();
  await expect(entry).toBeFocused();
  await expect(app.draftInput()).toHaveValue(source);
  await app.fillDraft("A new draft lives in the composer.");
  await entry.click();
  await expect(review.getByRole("status")).toContainText("1 of 2 reviewed");
  await expect(review.getByTestId("full-original")).toHaveText(source);
  await review.getByRole("button", { name: "Duet", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  if ((page.viewportSize()?.width ?? 1440) < 768) {
    const pane = await review
      .getByRole("region", { name: "Another voice.", exact: true })
      .boundingBox();
    expect(pane?.x).toBe(0);
    expect((pane?.x ?? 0) + (pane?.width ?? 0)).toBe(
      page.viewportSize()?.width,
    );
  }
  await page.screenshot({
    path: testInfo.outputPath("review-duet.png"),
    fullPage: true,
  });
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await page.screenshot({
    path: testInfo.outputPath("review-bottom-edge.png"),
  });
  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="Review your rewrite"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await review
    .getByRole("button", { name: "Back to rewrite", exact: true })
    .click();
  await app.runRewrite();
  await entry.click();
  await expect(review.getByRole("status")).toContainText("0 of");
  await expect(
    review.getByRole("button", { name: "Duet", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("reviewed copies stay local while public sharing uses the signed original rewrite", async ({
  app,
  page,
}) => {
  // Catches accidentally replacing latestRun.rewrite with the locally assembled revision.
  const api = await mockGhostwriterApi(page, { rewrite: response(result) });
  await app.goto();
  await app.fillDraft(source);
  await app.runRewrite();
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep original", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy preview", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as Window & { copiedText?: string }).copiedText,
    ),
  ).toBe("The rain stopped.\n\nMara listened.");
  await page
    .getByRole("button", { name: "Back to rewrite", exact: true })
    .click();
  await app.createPublicLink();
  await expect(page.getByText("Public link copied.")).toBeVisible();
  expect(api.shareRequests[0].body).toMatchObject({
    rewrite: result,
    artifactToken: apiResponses.artifactToken,
  });
});

for (const view of ["Duet", "Inline", "Focus"] as const) {
  test(`denied clipboard offers exact manual recovery in ${view}`, async ({
    app,
    page,
  }, testInfo) => {
    // Catches recovery containing inline originals, deletion placeholders, or normalized whitespace.
    const original =
      "Olá 世界 👩🏽‍🚀 — rain  stopped.\n\nMara waited.\nDelete this.";
    const suggestion = "Olá 世界 👩🏽‍🚀 — rain  softened.\n\nMara listened.\n";
    const expectedRevision = "Olá 世界 👩🏽‍🚀 — rain  stopped.\n\nMara listened.\n";
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw Error("Denied");
          },
        },
      });
      document.execCommand = () => false;
    });
    await mockGhostwriterApi(page, { rewrite: response(suggestion) });
    await app.goto();
    await app.fillDraft(original);
    await app.runRewrite();
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Keep original", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Accept change", exact: true })
      .click();
    await page.getByRole("button", { name: view, exact: true }).click();
    const review = page.getByRole("region", { name: "Review your rewrite" });
    const copy = review.getByRole("button", {
      name: "Copy preview",
      exact: true,
    });
    await copy.focus();
    await copy.press("Enter");
    await expect(review.getByRole("alert")).toContainText("Copy failed.");
    await expect(copy).toBeFocused();
    const recovery = review.getByRole("textbox", {
      name: "Revision for manual copying",
      exact: true,
    });
    await expect(recovery).toBeVisible();
    await expect(recovery).toHaveAttribute("aria-readonly", "true");
    expect(await recovery.inputValue()).toBe(expectedRevision);
    const select = review.getByRole("button", {
      name: "Select revision text",
      exact: true,
    });
    await select.focus();
    await select.press("Enter");
    await expect(recovery).toBeFocused();
    expect(
      await recovery.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    ).toBe(expectedRevision);
    await page.setViewportSize({ width: 320, height: 720 });
    expect(await recovery.inputValue()).toBe(expectedRevision);
    await expect
      .poll(() =>
        recovery.evaluate(
          (element) => element.scrollHeight <= element.clientHeight + 1,
        ),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("manual-recovery-320.png"),
      fullPage: true,
    });
    await review
      .getByRole("button", { name: "Back to rewrite", exact: true })
      .click();
    await page.setViewportSize({ width: 600, height: 720 });
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    expect(await recovery.inputValue()).toBe(expectedRevision);
    await expect
      .poll(() =>
        recovery.evaluate(
          (element) => element.scrollHeight <= element.clientHeight + 1,
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Review your rewrite"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.evaluate(() => {
      document.execCommand = () => true;
    });
    await copy.focus();
    await copy.press("Enter");
    await expect(
      review.getByRole("button", { name: "Preview copied", exact: true }),
    ).toBeVisible();
    await expect(recovery).toHaveCount(0);
  });
}

test("an asynchronous copy cannot label a changed revision as copied", async ({
  app,
  page,
}) => {
  // Catches copy completion setting a global boolean after decisions have changed.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          new Promise<void>((resolve) => {
            (window as Window & { finishCopy?: () => void }).finishCopy =
              resolve;
          }),
      },
    });
  });
  await mockGhostwriterApi(page, { rewrite: response(result) });
  await app.goto();
  await app.fillDraft(source);
  await app.runRewrite();
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy preview", exact: true }).click();
  await page
    .getByRole("button", { name: "Keep original", exact: true })
    .click();
  await page.evaluate(() =>
    (window as Window & { finishCopy?: () => void }).finishCopy?.(),
  );
  await expect(
    page.getByRole("button", { name: "Copy preview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Preview copied", exact: true }),
  ).toHaveCount(0);
});

for (const [name, original, rewrite, changeCount] of [
  ["identical", "Olá 世界.\n\nStill here.", "Olá 世界.\n\nStill here.", 0],
  ["insertion", "The rain stopped.", "The rain stopped. Mara waited.", 1],
  ["deletion", "The rain stopped. Mara waited.", "The rain stopped.", 1],
  ["multiline replacement", "Old\n\nwords", "New\n\nvoice", 2],
  ["long unbroken replacement", "a".repeat(2000), "b".repeat(2000), 1],
] as const) {
  test(`${name} preserves exact text in the review preview`, async ({
    app,
    page,
  }, testInfo) => {
    // Catches empty change-side rendering and whitespace-normalized reconstruction.
    await mockGhostwriterApi(page, { rewrite: response(rewrite) });
    await app.goto();
    await app.fillDraft(original);
    await app.runRewrite();
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    if (name === "identical")
      await expect(
        page.getByText(
          "Both versions are identical. There is nothing to review.",
        ),
      ).toBeVisible();
    await page
      .getByRole("button", {
        name: name === "identical" ? "Copy revision" : "Copy preview",
        exact: true,
      })
      .click();
    expect(
      await page.evaluate(
        () => (window as Window & { copiedText?: string }).copiedText,
      ),
    ).toBe(rewrite);
    if (name !== "identical") {
      for (let index = 0; index < changeCount; index++) {
        await page
          .getByRole("button", { name: "Keep original", exact: true })
          .click();
      }
      await page
        .getByRole("button", { name: "Copy revision", exact: true })
        .click();
      expect(
        await page.evaluate(
          () => (window as Window & { copiedText?: string }).copiedText,
        ),
      ).toBe(original);
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      for (let index = 0; index < changeCount; index++) {
        await page
          .getByRole("button", { name: "Accept change", exact: true })
          .click();
      }
      await page
        .getByRole("button", { name: "Copy revision", exact: true })
        .click();
      expect(
        await page.evaluate(
          () => (window as Window & { copiedText?: string }).copiedText,
        ),
      ).toBe(rewrite);
    }
    await page.getByRole("button", { name: "Inline", exact: true }).click();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.screenshot({
      path: testInfo.outputPath("review-bottom.png"),
      fullPage: true,
    });
  });
}

test("returning from review remeasures the same composer after a hidden resize", async ({
  app,
  page,
}) => {
  // Catches textarea sizing against display:none during rotation, and unmounting the workspace.
  await mockGhostwriterApi(page, { rewrite: response(result) });
  await app.goto();
  await app.fillDraft(source);
  await app.runRewrite();
  const draft = Array.from(
    { length: 30 },
    (_, index) => `Line ${index + 1}: a long draft to preserve through review.`,
  ).join("\n");
  await app.fillDraft(draft);
  await app
    .draftInput()
    .evaluate((element) => element.setAttribute("data-same-composer", "true"));
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 720 });
  await page
    .getByRole("button", { name: "Back to rewrite", exact: true })
    .click();
  await expect(app.draftInput()).toHaveValue(draft);
  await expect(app.draftInput()).toHaveAttribute("data-same-composer", "true");
  await expect
    .poll(() =>
      app
        .draftInput()
        .evaluate(
          (element) => element.scrollHeight <= element.clientHeight + 1,
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

for (const [name, before, after, expectedContext] of [
  [
    "joined emoji before and combining character after",
    "omit👩🏽‍🚀aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ",
    " bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbéomit",
    "…👩🏽‍🚀aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa waited bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbé…",
  ],
  [
    "combining character before and joined emoji after",
    "omitéaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ",
    " bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb👩🏽‍🚀omit",
    "…éaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa waited bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb👩🏽‍🚀…",
  ],
  [
    "exactly 110 graphemes without ellipses",
    "🙂aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ",
    " bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbé",
    "🙂aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa waited bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbé",
  ],
] as const) {
  test(`Focus context preserves ${name}`, async ({ app, page }, testInfo) => {
    // Catches UTF-16/code-point slicing that splits graphemes or adds false ellipses.
    // Each side retains 110 graphemes: one boundary cluster, 108 letters, one space.
    const original = `${before}waited${after}`;
    const suggestion = `${before}listened${after}`;
    await mockGhostwriterApi(page, { rewrite: response(suggestion) });
    await app.goto();
    await app.fillDraft(original);
    await app.runRewrite();
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    const review = page.getByRole("region", { name: "Review your rewrite" });
    await review.getByRole("button", { name: "Focus", exact: true }).click();
    const originalPane = review.getByRole("region", {
      name: "Your words.",
      exact: true,
    });
    await expect(
      originalPane.locator("p:visible").filter({ hasText: /a{20}/ }),
    ).toHaveText(expectedContext);
    await review.getByText("Read the full original", { exact: true }).click();
    await expect(review.getByTestId("full-original")).toHaveText(original);
    await review
      .getByRole("button", { name: "Copy preview", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => (window as Window & { copiedText?: string }).copiedText,
      ),
    ).toBe(suggestion);
    await review
      .getByRole("button", { name: "Keep original", exact: true })
      .click();
    await review
      .getByRole("button", { name: "Copy revision", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => (window as Window & { copiedText?: string }).copiedText,
      ),
    ).toBe(original);
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.screenshot({
      path: testInfo.outputPath("focus-context-bottom.png"),
    });
  });
}

test("real editor preserves author, strength and draft through review, then reviews a fresh outcome rewrite", async ({ app, page }) => {
  const api = await mockGhostwriterApi(page, { rewrite: response(result) });
  await app.goto();
  await app.fillDraft(source);
  await app.chooseAuthor("Ernest Hemingway");
  await app.setMood("100");
  await app.runRewrite();
  const entry = page.getByRole("button", { name: "Review changes", exact: true });
  await entry.click();
  const review = page.getByRole("region", { name: "Review your rewrite" });
  await review.getByRole("button", { name: "Keep original", exact: true }).click();
  await review.getByRole("button", { name: "Accept all changes", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("2 of 2 reviewed");
  await review.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("1 of 2 reviewed");
  await review.getByRole("button", { name: "Back to rewrite", exact: true }).click();
  await expect(app.draftInput()).toBeEditable();
  await expect(app.draftInput()).toHaveValue(source);
  await expect(page.getByRole("combobox", { name: "Author", exact: true })).toHaveAttribute("data-value", "hemingway");
  await expect(app.moodDial()).toHaveValue("100");
  expect(api.rewriteRequests[0].body).toMatchObject({ author: "hemingway", mood: 100, text: source, mode: "author" });
  const nextDraft = "Please shorten this message without changing its meaning.";
  await app.fillDraft(nextDraft);
  await app.switchToOutcomes();
  await app.chooseOutcome("Be concise");
  await app.runRewrite();
  await entry.click();
  await expect(review.getByTestId("review-original")).toHaveText(nextDraft);
  await expect(review.getByRole("status")).toContainText("0 of");
  await review.getByRole("button", { name: "Accept all changes", exact: true }).click();
  await review.getByRole("button", { name: "Copy revision", exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText)).toBe(result);
  expect(api.rewriteRequests).toHaveLength(2);
  expect(api.rewriteRequests[1].body).toMatchObject({ text: nextDraft, mode: "outcome", outcome: "concise" });
  await review.getByRole("button", { name: "Back to rewrite", exact: true }).click();
  await expect(app.draftInput()).toHaveValue(nextDraft);
  await expect(app.rewriteModeSelect()).toHaveAttribute("data-value", "outcome");
});

test("integrated review aligns papers and keeps actions in a laptop viewport", async ({ app, page }, testInfo) => {
  await mockGhostwriterApi(page, { rewrite: response(result) });
  for (const [width, height] of [[1280, 640], [1512, 738]]) {
    await page.setViewportSize({ width, height });
    await app.goto();
    await app.fillDraft(source);
    await app.runRewrite();
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    const review = page.getByRole("region", { name: "Review your rewrite" });
    for (const name of ["Duet", "Inline", "Focus"]) {
      await review.getByRole("button", { name, exact: true }).click();
      await expect(review.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      for (const label of ["Accept change", "Accept all changes", "Copy preview"]) {
        const box = (await review.getByRole("button", { name: label, exact: true }).boundingBox())!;
        expect(box.y + box.height + await page.evaluate(() => scrollY), `${name}: ${label}`).toBeLessThanOrEqual(height);
      }
      const left = (await review.getByTestId("review-source-paper").boundingBox())!;
      const right = (await review.getByTestId("review-result-paper").boundingBox())!;
      expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(1);
    }
    await review.getByRole("button", { name: "Duet", exact: true }).click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath(`integrated-review-${width}.png`) });
  }
});

test("completed decisions cannot be applied twice and copying becomes the next action", async ({ app, page }, info) => {
  await mockGhostwriterApi(page, { rewrite: response(result) });
  await app.goto();
  await app.fillDraft(source);
  await app.runRewrite();
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  const review = page.getByRole("region", { name: "Review your rewrite" });
  await review.getByRole("button", { name: "Accept all changes", exact: true }).click();
  for (const layout of ["Duet", "Inline", "Focus"]) {
    await review.getByRole("button", { name: layout, exact: true }).click();
    const applied = review.getByRole("button", { name: /^(Accept change|Accepted)$/ });
    await expect(applied).toBeDisabled();
    await expect(applied).toHaveAccessibleName("Accepted");
    await expect(review.getByRole("button", { name: "All accepted", exact: true })).toBeDisabled();
    await expect(review.getByRole("status")).toContainText("Review complete");
    const copy = review.getByRole("button", { name: "Copy revision", exact: true });
    await expect(copy).toBeEnabled();
    await expect(copy).toHaveCSS("background-color", "rgb(238, 153, 101)");
  }
  await page.screenshot({ path: info.outputPath("review-complete.png"), fullPage: true });
  await review.getByRole("button", { name: "Copy revision", exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText)).toBe(result);
  await review.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("0 of 2 reviewed");
  await expect(review.getByRole("button", { name: "Accept change", exact: true })).toBeEnabled();
  await review.getByRole("button", { name: "Keep original", exact: true }).click();
  await review.getByRole("button", { name: "Accept change", exact: true }).click();
  await review.getByRole("combobox", { name: "Jump to change" }).click();
  await page.getByRole("listbox", { name: "Jump to change" }).getByRole("option").first().click();
  await expect(review.getByRole("button", { name: "Original kept", exact: true })).toBeDisabled();
  await expect(review.getByRole("button", { name: "Accept change", exact: true })).toBeEnabled();
  await review.getByRole("button", { name: "Copy revision", exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText)).toBe("The rain stopped.\n\nMara listened.");
  await review.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(review.getByRole("status")).toContainText("0 of 2 reviewed");
  await expect(review.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await review.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(review.getByRole("button", { name: "Original kept", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Back to rewrite", exact: true }).click();
  await expect(app.draftInput()).toHaveValue(source);
  await expect(app.draftInput()).toBeEditable();
});

test("background and writing columns stay centered in composer and review", async ({ app, page }, info) => {
  await mockGhostwriterApi(page, { rewrite: response(result) });
  await app.goto();
  const centered = async (leftSelector: string, rightSelector: string) => {
    const split = await page.locator("main.gw-studio").evaluate(el => ({
      x: el.getBoundingClientRect().x,
      left: parseFloat(getComputedStyle(el, "::before").left),
    }));
    const width = page.viewportSize()!.width;
    expect(Math.abs(split.x + split.left - width / 2)).toBeLessThanOrEqual(1);
    const left = (await page.locator(leftSelector).boundingBox())!;
    const right = (await page.locator(rightSelector).boundingBox())!;
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(1);
    expect(Math.abs((left.x + left.width + right.x) / 2 - width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
  };
  for (const width of [768, 1024, 1512, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await centered(".gw-composer-field", ".duet-canvas");
  }
  await app.fillDraft(source);
  await app.runRewrite();
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  for (const width of [768, 1024, 1512, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["Duet", "Inline", "Focus"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await centered('[data-testid="review-source-paper"]', '[data-testid="review-result-paper"]');
    }
  }
  await page.setViewportSize({ width: 1512, height: 738 });
  await page.screenshot({ path: info.outputPath("centered-review.png") });
});


test("inline review keeps a dense rewrite readable with its decisions in view", async ({ app, page }, info) => {
  const draft = "Today I woke up a bit earlier than usual.\nI made coffee and checked my messages before work.\nThe weather is cooler now, so I grabbed a jacket on the way out.\nLater I'm planning to cook dinner and watch a movie.";
  const rewrite = "I woke up early, made coffee, and checked messages before work.\nThe cooler weather prompted me to grab a jacket.\nLater, I’ll cook dinner and watch a movie.";
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockGhostwriterApi(page, { rewrite: response(rewrite) });
  await app.goto();
  await app.fillDraft(draft);
  await app.runRewrite();
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  const review = page.getByRole("region", { name: "Review your rewrite" });
  await review.getByRole("button", { name: "Inline", exact: true }).click();
  await expect(review.getByTestId("review-revision")).toHaveText(rewrite);
  const jump = review.getByRole("combobox", { name: "Jump to change" });
  await expect(jump).toBeVisible();
  await jump.click();
  const count = await page.getByRole("listbox", { name: "Jump to change" }).getByRole("option").count();
  await jump.press("Escape");
  expect(count).toBeGreaterThan(10);
  const paper = (await review.getByTestId("review-result-paper").boundingBox())!;
  const sourcePaper = (await review.getByTestId("review-source-paper").boundingBox())!;
  expect(Math.abs(paper.y - sourcePaper.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(paper.height - sourcePaper.height)).toBeLessThanOrEqual(1);
  expect(paper.height).toBeLessThan(300);
  for (const name of ["Accept change", "Keep original", "Copy preview"]) {
    const box = (await review.getByRole("button", { name, exact: true }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(720);
  }
  await page.screenshot({ path: info.outputPath("inline-dense-desktop.png"), fullPage: true });
  await jump.click();
  await jump.press("End");
  await jump.press("Enter");
  await review.getByRole("button", { name: "Keep original", exact: true }).click();
  await expect(review.getByRole("status")).toContainText(`1 of ${count} reviewed`);
  await review.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(jump).toHaveAttribute("data-value", String(count - 1));
  await review.getByRole("button", { name: "Accept all changes", exact: true }).click();
  await expect(review.getByRole("button", { name: "All accepted", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Copy revision", exact: true }).click();
  expect(await page.evaluate(() => (window as Window & { copiedText?: string }).copiedText)).toBe(rewrite);
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(jump).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath("inline-dense-mobile.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).include('[aria-label="Review your rewrite"]').analyze()).violations).toEqual([]);
});

test("dense review groups stay separated and the custom change menu stays inside the viewport", async ({ app, page }, info) => {
  const draft = "Here's a short four-line text:\n\nThe café on the corner opens at seven, but the owner is usually there by six.\nShe wipes the tables, checks the milk, and turns on the old radio by the window.\nMost mornings, the first customer is a bus driver who orders the same thing.\nBy the time the city wakes up, the place already feels lived in.\n\nWant it on a specific topic or for a particular use, like a bio, a caption, or a message?";
  const rewrite = "At the corner, the café opens at seven, yet its keeper arrives by six. She cleans each table, tests the milk, and sets the antique radio by the window to sing. Each dawn the first patron is the bus driver, ordering the same familiar fare. By the time the city stirs, the shop already breathes the weight of many mornings.";
  await mockGhostwriterApi(page, { rewrite: response(rewrite) });
  await app.goto(); await app.fillDraft(draft); await app.runRewrite();
  await page.getByRole("button", { name: "Review changes", exact: true }).click();
  const review = page.getByRole("region", { name: "Review your rewrite" });
  for (const width of [1512, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const layout of ["Duet", "Inline", "Focus"]) {
      await review.getByRole("button", { name: layout, exact: true }).click();
      const accept = review.getByRole("button", { name: "Accept change", exact: true });
      await accept.scrollIntoViewIfNeeded();
      const a = (await accept.boundingBox())!;
      const keep = (await review.getByRole("button", { name: "Keep original", exact: true }).boundingBox())!;
      const next = (await review.getByRole("button", { name: "Next change", exact: true }).boundingBox())!;
      const copy = (await review.getByRole("button", { name: "Copy preview", exact: true }).boundingBox())!;
      expect(a.x - keep.x - keep.width).toBeGreaterThanOrEqual(11);
      expect(a.y - next.y - next.height).toBeGreaterThanOrEqual(11);
      expect(copy.y - a.y - a.height).toBeGreaterThanOrEqual(11);
      expect(a.x + a.width).toBeLessThanOrEqual(width - 8);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width >= 768) {
        const left = (await review.getByTestId("review-source-paper").boundingBox())!;
        const right = (await review.getByTestId("review-result-paper").boundingBox())!;
        expect(Math.abs(left.y - right.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(1);
      }
      if ([1512, 390].includes(width)) await page.screenshot({ path: info.outputPath(`review-spaced-${layout}-${width}.png`), fullPage: true });
    }
    const jump = review.getByRole("combobox", { name: "Jump to change" });
    const current = await jump.getAttribute("data-value");
    await jump.click();
    const menu = page.getByRole("listbox", { name: "Jump to change" });
    await expect(menu).toBeVisible();
    expect(await page.locator("select, datalist").count()).toBe(0);
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(8); expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 7);
    expect(box.y + box.height).toBeLessThanOrEqual(793);
    await jump.press("End");
    await expect(menu.getByRole("option").last()).toBeInViewport();
    if ([1512, 390].includes(width)) await page.screenshot({ path: info.outputPath(`review-custom-menu-${width}.png`) });
    await jump.press("Escape");
    await expect(jump).toHaveAttribute("data-value", current!);
  }
  await page.setViewportSize({ width: 1512, height: 800 });
  await review.getByRole("combobox", { name: "Jump to change" }).click();
  expect((await new AxeBuilder({ page }).include('[aria-label="Review your rewrite"]').include('[role="listbox"]').analyze()).violations).toEqual([]);
});
