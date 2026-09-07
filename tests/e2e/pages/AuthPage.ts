import { expect, type Page } from "@playwright/test";
import { anonymousVisitor } from "../fixtures/users";

export class AuthPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("/second-voice");
    await expect(this.page.getByLabel("Write or paste here")).toBeVisible();
  }

  async expectShieldSessionCookies() {
    const cookies = await this.page.context().cookies();
    const csrf = cookies.find((cookie) => cookie.name === anonymousVisitor.expectedCookies.csrf);
    const session = cookies.find((cookie) => cookie.name === anonymousVisitor.expectedCookies.session);

    expect(csrf, "CSRF cookie should be readable by the client guard").toBeTruthy();
    expect(csrf?.httpOnly).toBe(false);
    expect(csrf?.sameSite).toBe("Strict");
    expect(session, "session cookie should exist").toBeTruthy();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Strict");
  }
}
