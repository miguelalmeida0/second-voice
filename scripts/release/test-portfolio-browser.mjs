// Production-rendered UI acceptance with explicitly synthetic browser responses.
// Not proof of OAuth, durable admission, or provider execution. No real key is used.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const origin = "http://127.0.0.1:3222";
const synthetic = "isolated-portfolio-ui-not-a-credential-2026";
const server = spawn("node", [resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", "3222"], {
  env: {
    ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    // This process can only talk to a nonexistent local Auth store. Browser
    // fixtures supply UI responses; the real server cannot authenticate a spend.
    AI_ENABLED: "true", GHOSTWRITER_RELEASE_PROFILE: "portfolio-free",
    GHOSTWRITER_PROVIDER: "groq", GROQ_API_KEY: synthetic, GEMINI_API_KEY: synthetic,
    GROQ_MODEL: "openai/gpt-oss-20b", GHOSTWRITER_AI_PRICING_VERSION: "groq-openai-gpt-oss-20b-2026-09-07",
    GROQ_FREE_ORGANIZATION_ID: "org-isolated", GROQ_FREE_PROJECT_ID: "project-isolated",
    GHOSTWRITER_SECURITY_SECRET: synthetic + "-signing", GHOSTWRITER_FINGERPRINT_SECRET: synthetic + "-fingerprint",
    SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_PUBLISHABLE_KEY: synthetic + "-public", SUPABASE_SERVICE_ROLE_KEY: synthetic + "-service",
    GHOSTWRITER_ABUSE_STORE_MODE: "supabase", GHOSTWRITER_E2E_FIXTURE_MODE: "false",
    GHOSTWRITER_GITHUB_LOGIN_ENABLED: "true", GHOSTWRITER_EMAIL_LOGIN_ENABLED: "false",
    GHOSTWRITER_ALLOW_PUBLIC_SHARING: "false", NEXT_PUBLIC_SITE_URL: origin,
  }, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "", browser;
server.stdout.on("data", value => { serverLog = (serverLog + value).slice(-4000); });
server.stderr.on("data", value => { serverLog = (serverLog + value).slice(-4000); });
try {
  for (let n = 0; n < 80; n++) {
    if (server.exitCode !== null) throw new Error("Isolated UI server exited before readiness");
    if (serverLog.includes("Ready in")) break;
    await new Promise(done => setTimeout(done, 250));
  }
  assert.match(serverLog, /Ready in/);
  assert.equal((await fetch(origin + "/")).status, 200);
  assert.equal((await fetch(origin + "/second-voice")).status, 200);
  assert.equal((await fetch(origin + "/api/ghostwriter/auth/callback", { redirect: "manual" })).status, 401);
  browser = await chromium.launch();
  mkdirSync(".tmp/release/portfolio-ui", { recursive: true });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let allowance = { remaining: 10, todayRemaining: 3, available: true };
    let signedIn = false, failure = 0, calls = 0;
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/ghostwriter/auth") {
        return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? { allowance } : { message: "Sign in" } });
      }
      if (url.pathname === "/api/ghostwriter/challenge") {
        return route.fulfill({ json: { challengeToken: "synthetic-browser-challenge", difficulty: 0 } });
      }
      if (url.pathname === "/api/ghostwriter") {
        calls++;
        if (failure === -1) return route.abort("failed");
        if (failure) return route.fulfill({ status: failure, json: { error: "Synthetic unavailability" } });
        allowance = { remaining: 9, todayRemaining: 2, available: true };
        return route.fulfill({ json: { rewrite: "A lantern burned beside the quiet road.", artifactToken: "synthetic-ui-artifact-not-server-verified", operationId: "synthetic-operation" } });
      }
      return route.continue();
    });
    await page.goto(origin + "/second-voice");
    const input = page.getByLabel("Write or paste here");
    const primary = page.locator(".gw-composer-primary-cta");
    await expect(input).toBeVisible();
    await expect(primary).toHaveText("Sign in with GitHub");
    await expect(primary).toBeEnabled();
    await primary.click();
    await expect(page.locator("details").first()).toHaveAttribute("open", "");
    assert.equal(calls, 0);
    async function refresh() {
      await page.evaluate(() => window.dispatchEvent(new Event("ghostwriter-allowance-changed")));
    }
    signedIn = true; await refresh();
    await expect(primary).toHaveText("Rewrite as Tolkien");
    await expect(primary).toBeEnabled();
    const text = "My original words remain here through every failure.";
    await input.fill(text);
    await primary.click();
    await expect(page.locator(".gw-composer-status")).toContainText("9 trial rewrites remaining");
    assert.equal(calls, 1);
    for (const status of [429, 503, -1]) {
      failure = status;
      await primary.click();
      await expect(page.locator(".gw-error-panel")).toContainText("AI demo is temporarily unavailable");
      await expect(primary).toBeEnabled();
      await expect(input).toHaveValue(text);
      const count = calls;
      await page.waitForTimeout(500); // Observe that no inference retry is scheduled.
      assert.equal(calls, count);
      await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
    }
    assert.equal(calls, 4);
    allowance = { remaining: 0, todayRemaining: 0, available: true }; await refresh();
    await expect(primary).toBeDisabled();
    await expect(page.locator(".gw-composer-status")).toContainText("trial has reached its limit");
    allowance = { remaining: 8, todayRemaining: 0, available: true }; await refresh();
    await expect(page.locator(".gw-composer-status")).toContainText("temporarily unavailable");
    await expect(primary).toBeDisabled();
    allowance = { remaining: 8, todayRemaining: 2, available: false }; await refresh();
    await expect(primary).toBeDisabled();
    await expect(input).toHaveValue(text);
    const geometry = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, scroller: document.scrollingElement === document.documentElement, portal: !!document.querySelector("nextjs-portal") };
    });
    assert.ok(geometry.scrollWidth <= geometry.width); assert.ok(geometry.scroller); assert.equal(geometry.portal, false);
    await page.screenshot({ path: `.tmp/release/portfolio-ui/bottom-${viewport.width}.png` });
    await page.screenshot({ path: `.tmp/release/portfolio-ui/full-${viewport.width}.png`, fullPage: true });
    signedIn = false; await refresh();
    await expect(primary).toHaveText("Sign in with GitHub");
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(JSON.stringify({ status: "PASS", scope: "Production-rendered desktop/mobile UI with synthetic auth and rewrite responses only", checks: ["routes", "invalid-oauth-callback-fails-closed", "visitor-signin-action", "trial-allowance", "exhausted", "paused", "quota-and-network-failure-preserve-text", "no-automatic-retry", "one-document-scroller", "no-horizontal-overflow", "no-page-errors"], liveProviderCalls: 0 }));
} catch (error) {
  if (/bootstrap_check_in|MachPortRendezvous|Permission denied|operation not permitted/.test(String(error))) {
    console.error("BROWSER_BLOCKED: native browser bootstrap permission denied"); process.exitCode = 2;
  } else { console.error(error); process.exitCode = 1; }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null) await new Promise(done => server.once("exit", done));
}
