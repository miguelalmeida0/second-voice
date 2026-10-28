import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Exercise the production identity layout with mocked auth and AI responses.
export default defineConfig({
  ...base,
  testDir: "./tests/e2e/stress",
  webServer: base.webServer && !Array.isArray(base.webServer) ? {
    ...base.webServer,
    env: {
      ...base.webServer.env,
      GHOSTWRITER_RELEASE_PROFILE: "portfolio-free",
      GHOSTWRITER_GITHUB_LOGIN_ENABLED: "true",
    },
  } : base.webServer,
  projects: base.projects?.filter(project => ["chromium", "mobile-chrome"].includes(project.name!)),
});
