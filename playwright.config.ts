import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3210);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

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
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `./node_modules/.bin/next dev --webpack --disable-source-maps -H 127.0.0.1 -p ${port}`,
    env: {
      AI_ENABLED: "false",
      GHOSTWRITER_ABUSE_STORE_MODE: "memory",
      GHOSTWRITER_ALLOW_PUBLIC_SHARING: "true",
      GHOSTWRITER_E2E_FIXTURE_MODE: "true",
      GHOSTWRITER_POW_DIFFICULTY: "0",
      GHOSTWRITER_PROVIDER: "groq",
      GHOSTWRITER_SECURITY_SECRET: "playwright-e2e-security-secret-with-more-than-32-characters",
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
      SUPABASE_PUBLISHABLE_KEY: "playwright-e2e-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "playwright-e2e-service-role-key",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
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
