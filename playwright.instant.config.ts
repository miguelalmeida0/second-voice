import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Keep portfolio identity gating enabled while using the existing dev-only
// rewrite fixtures. This profile never enables a production provider.
export default defineConfig({
  ...base,
  testDir: "./tests/e2e/instant",
  testMatch: "instant-studio.spec.ts",
  webServer: base.webServer && !Array.isArray(base.webServer) ? {
    ...base.webServer,
    env: { ...base.webServer.env, GHOSTWRITER_RELEASE_PROFILE: "portfolio-free" },
  } : base.webServer,
  projects: base.projects?.filter(project => ["chromium", "mobile-chrome"].includes(project.name!)),
});
