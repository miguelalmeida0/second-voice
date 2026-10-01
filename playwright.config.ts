import { defineConfig, devices } from "@playwright/test";

function resolveLocalPort() {
  const configured = process.env.PLAYWRIGHT_PORT?.trim();
  if (configured) {
    const parsed = Number(configured);
    if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65535) {
      throw new Error(`Invalid PLAYWRIGHT_PORT: ${configured}`);
    }
    return parsed;
  }

  // The config is evaluated in more than one Playwright process. A random
  // port chosen during config evaluation can therefore diverge between the
  // webServer process and the worker's baseURL, producing ERR_CONNECTION_REFUSED.
  // Use a stable test-only port by default; callers can still override it with
  // PLAYWRIGHT_PORT when another local service owns 3211. The isolated Next
  // distDir below prevents this server from contending with normal `next dev`.
  return 3211;
}

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || null;
const port = externalBaseURL ? null : resolveLocalPort();
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const playwrightDistDir = port ? `.tmp/next-playwright-${port}` : null;

export default defineConfig({
  testDir: "./tests/e2e/specs",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
  },
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    actionTimeout: 10_000,
    baseURL,
    locale: "en-US",
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        // Next 16 uses Turbopack by default. Do not force the much slower legacy
        // webpack dev path for the browser acceptance suite.
        command: `node scripts/release/prepare-playwright-next.mjs && ./node_modules/.bin/next dev -H 127.0.0.1 -p ${port}`,
        env: {
          AI_ENABLED: "false",
          GHOSTWRITER_RELEASE_PROFILE: "isolated-e2e",
          GHOSTWRITER_ABUSE_STORE_MODE: "memory",
          GHOSTWRITER_ALLOW_PUBLIC_SHARING: "true",
          GHOSTWRITER_E2E_FIXTURE_MODE: "true",
          // Next 16 serializes dev servers through <distDir>/dev/lock. A user
          // may legitimately have `npm run dev` open in this checkout, so each
          // Playwright run gets its own distDir as well as its own TCP port.
          GHOSTWRITER_NEXT_DIST_DIR: playwrightDistDir!,
          GHOSTWRITER_POW_DIFFICULTY: "0",
          GHOSTWRITER_PROVIDER: "groq",
          GHOSTWRITER_SECURITY_SECRET:
            "playwright-e2e-security-secret-with-more-than-32-characters",
          NEXT_PUBLIC_SITE_URL: baseURL,
          NEXT_TELEMETRY_DISABLED: "1",
          SUPABASE_PUBLISHABLE_KEY: "playwright-e2e-publishable-key",
          SUPABASE_SERVICE_ROLE_KEY: "playwright-e2e-service-role-key",
          SUPABASE_URL: "http://127.0.0.1:54321",
        },
        // Local acceptance must never attach to a server left behind by a prior
        // interrupted Playwright run. That was the source of the 30s goto hang.
        reuseExistingServer: false,
        timeout: 180_000,
        url: `${baseURL}/second-voice`,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumExecutablePath
          ? { executablePath: chromiumExecutablePath }
          : undefined,
        viewport: { height: 1100, width: 1440 },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { height: 1100, width: 1440 },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { height: 1100, width: 1440 },
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        launchOptions: chromiumExecutablePath
          ? { executablePath: chromiumExecutablePath }
          : undefined,
      },
    },
  ],
});
