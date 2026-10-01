import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.GHOSTWRITER_FILM_BASE_URL ?? "http://127.0.0.1:4003";
const outputDir = resolve(
  process.env.GHOSTWRITER_FILM_OUTPUT_DIR ?? ".tmp/portfolio-film-capture",
);
const rawVideo = resolve(outputDir, "ghostwriter-demo-raw.webm");
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

await mkdir(outputDir, { recursive: true });
await rm(rawVideo, { force: true });

const browser = await chromium.launch({
  ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
  headless: true,
});
const context = await browser.newContext({
  colorScheme: "dark",
  deviceScaleFactor: 1,
  locale: "en-US",
  recordVideo: {
    dir: outputDir,
    size: {
      height: 900,
      width: 1440,
    },
  },
  reducedMotion: "no-preference",
  viewport: {
    height: 900,
    width: 1440,
  },
});
const page = await context.newPage();
const consoleErrors = [];
const providerRequests = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("request", (request) => {
  if (request.url().includes("/api/ghostwriter")) {
    providerRequests.push(request.url());
  }
});

await page.goto(`${baseUrl}/demo/portfolio-film?capture=1&once=1`, {
  waitUntil: "load",
});
const film = page.getByTestId("ghostwriter-portfolio-film");
await film.waitFor({ state: "visible" });
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="ghostwriter-portfolio-film"]')
      ?.getAttribute("data-film-ready") === "true",
);

await page.waitForTimeout(900);
await page.evaluate(() => {
  window.dispatchEvent(new Event("ghostwriter-film-start"));
});
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="ghostwriter-portfolio-film"]')
      ?.getAttribute("data-film-complete") === "true",
  undefined,
  { timeout: 20_000 },
);
await page.waitForTimeout(420);

if (providerRequests.length > 0) {
  throw new Error(
    `Film capture unexpectedly contacted the provider path: ${providerRequests.join(", ")}`,
  );
}

if (consoleErrors.length > 0) {
  throw new Error(`Film capture logged browser errors:\n${consoleErrors.join("\n")}`);
}

const video = page.video();
if (!video) {
  throw new Error("Playwright did not create a film recording.");
}

await page.close();
await video.saveAs(rawVideo);
await context.close();
await browser.close();

console.log(rawVideo);
