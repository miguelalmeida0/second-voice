import { test as base, expect } from "@playwright/test";
import { AppPage } from "../pages/AppPage";
import { AuthPage } from "../pages/AuthPage";
import { DashboardPage } from "../pages/DashboardPage";

type GhostwriterFixtures = {
  app: AppPage;
  auth: AuthPage;
  dashboard: DashboardPage;
};

export const test = base.extend<GhostwriterFixtures>({
  app: async ({ page }, run) => {
    await run(new AppPage(page));
  },
  auth: async ({ page }, run) => {
    await run(new AuthPage(page));
  },
  dashboard: async ({ page }, run) => {
    await run(new DashboardPage(page));
  },
});

export { expect };
