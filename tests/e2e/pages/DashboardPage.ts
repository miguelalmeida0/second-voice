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
    const author = this.page.getByRole("combobox", { name: "Author", exact: true });
    await author.click();
    await expect(this.page.getByRole("option", { name: "J.R.R. Tolkien", exact: true })).toBeVisible();
    await expect(this.page.getByRole("option", { name: "Stephen King", exact: true })).toBeVisible();
    await author.press("Escape");
    await expect(this.page.getByLabel(/mood dial/i)).toBeVisible();
  }

  async expectOutcomeConsole() {
    await this.app.switchToOutcomes();
    await expect(this.app.rewriteModeSelect()).toHaveAttribute("data-value", "outcome");
    await expect(this.page.getByRole("combobox", { name: "Writing outcome" })).toBeVisible();
    const outcome = this.page.getByRole("combobox", { name: "Writing outcome" });
    await outcome.click();
    await expect(this.page.getByRole("option", { name: "Improve clarity", exact: true })).toBeVisible();
    await expect(this.page.getByRole("option", { name: "Be concise", exact: true })).toBeVisible();
    await outcome.press("Escape");
  }
}
