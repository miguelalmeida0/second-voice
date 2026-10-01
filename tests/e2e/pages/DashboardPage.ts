import { expect, type Page } from "@playwright/test";
import { AppPage } from "./AppPage";
import { expectPressed } from "../utils/assertions";

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
    await expect(this.page.getByRole("group", { name: "Choose an author" })).toBeVisible();
    await expect(this.page.getByRole("group", { name: "Rewrite mode" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Choose J.R.R. Tolkien" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Choose Stephen King" })).toBeVisible();
    await expect(this.page.getByLabel(/mood dial/i)).toBeVisible();
  }

  async expectOutcomeConsole() {
    await this.app.switchToOutcomes();
    await expectPressed(this.app.outcomeModeButton(), true);
    await expect(this.page.getByRole("group", { name: "Outcome options" })).toBeVisible();
    await expect(this.page.getByRole("group", { name: "Outcome options" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: /Improve clarity/ })).toBeVisible();
    await expect(this.page.getByRole("button", { name: /Be concise/ })).toBeVisible();
  }
}
