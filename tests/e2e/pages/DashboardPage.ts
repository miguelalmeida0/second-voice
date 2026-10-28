import { expect, type Page } from "@playwright/test";
import { AppPage } from "./AppPage";

export class DashboardPage {
  readonly app: AppPage;
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.app = new AppPage(page);
  }

  async goto() {
    await this.app.goto();
  }

  async expectAuthorConsole() {
    await expect(this.page.getByRole("combobox", { name: "Author", exact: true })).toBeVisible();
    await expect(this.page.getByRole("combobox", { name: "Rewrite mode" })).toBeVisible();
    await expect(this.page.getByRole("combobox", { name: "Author", exact: true }).locator("option[value=tolkien]")).toHaveCount(1);
    await expect(this.page.getByRole("combobox", { name: "Author", exact: true }).locator("option[value=stephenking]")).toHaveCount(1);
    await expect(this.page.getByLabel(/mood dial/i)).toBeVisible();
  }

  async expectOutcomeConsole() {
    await this.app.switchToOutcomes();
    await expect(this.app.rewriteModeSelect()).toHaveValue("outcome");
    await expect(this.page.getByRole("combobox", { name: "Writing outcome" })).toBeVisible();
    await expect(this.page.getByRole("combobox", { name: "Writing outcome" }).locator("option").filter({ hasText: "Improve clarity" })).toHaveCount(1);
    await expect(this.page.getByRole("combobox", { name: "Writing outcome" }).locator("option").filter({ hasText: "Be concise" })).toHaveCount(1);
  }
}
