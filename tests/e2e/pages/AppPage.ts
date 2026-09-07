import { expect, type Locator, type Page } from "@playwright/test";
import { waitForAppReady } from "../utils/waitForAppReady";

export class AppPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(path = "/second-voice") {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    await waitForAppReady(this.page);
  }

  draftInput() {
    return this.page.getByLabel("Write or paste here");
  }

  authorModeButton() {
    return this.page.getByRole("button", { name: "Authors" });
  }

  outcomeModeButton() {
    return this.page.getByRole("button", { name: "Outcomes" });
  }

  rewriteButton() {
    return this.page.getByRole("button", { name: /^Rewrite (as|to)/ });
  }

  heroSurpriseButton() {
    return this.page.getByRole("button", { name: "Surprise me" }).first();
  }

  composerSurpriseButton() {
    return this.page.getByRole("button", { name: "Surprise me" }).last();
  }

  howItWorksButton() {
    return this.page.getByRole("button", { name: "How it works" });
  }

  caseStudyLink() {
    return this.page.getByRole("link", { name: "Read the case study" }).first();
  }

  moodDial() {
    return this.page.getByLabel(/mood dial/i);
  }

  async fillDraft(text: string) {
    await this.draftInput().fill(text);
  }

  async chooseAuthor(authorName: string) {
    await this.page.getByRole("button", { name: `Choose ${authorName}` }).click();
  }

  async chooseOutcome(label: string) {
    await this.page.getByRole("button", { name: new RegExp(label, "i") }).click();
  }

  async switchToOutcomes() {
    await this.outcomeModeButton().click();
  }

  async switchToAuthors() {
    await this.authorModeButton().click();
  }

  async setMood(value: string) {
    await this.moodDial().fill(value);
  }

  async runRewrite() {
    await this.rewriteButton().click();
  }

  async expectRewriteVisible(text: string | RegExp) {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  async expectRewriteIdle() {
    await expect(this.page.getByText(/run a rewrite and the edit will happen here/i)).toBeVisible();
  }

  async copyRewrite() {
    await this.page.getByRole("button", { name: "Copy rewrite" }).click();
    await expect(this.page.getByRole("button", { name: "Rewrite copied" })).toBeVisible();
  }

  async openHowItWorks() {
    await this.howItWorksButton().click();
    await expect(this.page.getByRole("dialog", { name: "How to use Second Voice" })).toBeVisible();
  }

  async closeHowItWorks() {
    await this.page.getByRole("button", { name: "Close How it works", exact: true }).click();
    await expect(this.page.getByRole("dialog", { name: "How to use Second Voice" })).toBeHidden();
  }

  async openRewriteLab() {
    await this.page.getByRole("button", { name: "Open Rewrite Lab" }).click();
    await expect(this.page.getByText("The app tries three human directions, then picks one.")).toBeVisible();
  }

  async createPublicLink() {
    await this.page.getByRole("button", { name: "Create public link" }).click();
    await expect(this.page.getByText(/This will create a public permalink/)).toBeVisible();
    await this.page.getByRole("button", { name: "Create link" }).click();
  }

  feedbackRating(label: "Landed" | "Missed"): Locator {
    return this.page.getByRole("button", { name: label });
  }
}
