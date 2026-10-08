import { mkdir } from "node:fs/promises";
import { test, expect } from "../fixtures/test";
import { mockGhostwriterApi } from "../utils/mockApi";
import AxeBuilder from "@axe-core/playwright";
import { apiResponses } from "../fixtures/testData";

test.use({bypassCSP:true});

const sizes = [[320,568],[390,844],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080]];
test("primary action is discoverable before any interaction", async ({ app, page }, info) => {
  test.setTimeout(120_000);
  await mockGhostwriterApi(page);
  const stage = process.env.DUET_CAPTURE_BEFORE ? "before" : "after";
  const dir = `artifacts/duet-action/${stage}/${info.project.name}`;
  await mkdir(dir, {recursive:true});
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await app.goto();
    const button = page.locator(".gw-inspiration-rewrite");
    await page.screenshot({path:`${dir}/${width}x${height}.png`});
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expect(button).toHaveCount(1);
    const box = await button.boundingBox();
    expect.soft(box!.y, `${width}: action starts in viewport`).toBeGreaterThanOrEqual(0);
    expect.soft(box!.y + box!.height, `${width}: whole action in initial viewport`).toBeLessThanOrEqual(height);
    expect.soft(box!.height).toBeGreaterThanOrEqual(56);
    expect.soft(await button.innerText()).toBe("Rewrite my draft");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("one action keeps its place through real pointer activation, pending and completed states", async ({app,page}, info) => {
  test.setTimeout(180_000);
  await page.emulateMedia({reducedMotion:"reduce"});
  const api = await mockGhostwriterApi(page, {rewrite:{delayMs:800,json:{rewrite:"A clear sentence, ready to send.",moodLabel:"starlit",artifactToken:apiResponses.artifactToken}}});
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await app.goto();
    await app.fillDraft("A sentence that needs another voice.");
    await page.evaluate(() => window.scrollTo(0,0));
    const button = page.locator(".gw-inspiration-rewrite");
    await expect(button).toHaveAccessibleName("Rewrite my draft");
    const initial = (await button.boundingBox())!;
    expect(initial.y + initial.height, `${width}: ready action visible`).toBeLessThanOrEqual(height);
    const calls = api.rewriteRequests.length;
    // Locator click/tap is deliberately not forced; the first-viewport assertion precedes it.
    if (info.project.use.hasTouch) await button.tap(); else await button.click();
    await expect(button).toHaveAccessibleName("Rewriting…");
    await expect(button).toBeDisabled();
    const pending = (await button.boundingBox())!;
    expect(Math.abs(pending.y-initial.y), `${width}: pending position`).toBeLessThanOrEqual(3);
    await page.mouse.click(pending.x+pending.width/2,pending.y+pending.height/2,{clickCount:3,delay:40});
    await expect.poll(() => api.rewriteRequests.length).toBe(calls+1);
    await expect(page.locator('[data-phase="complete"]')).toBeVisible();
    await expect(button).toHaveAccessibleName("Rewrite again");
    await expect(button).toHaveCount(1);
    const result = (await button.boundingBox())!;
    if (width < 768) expect(Math.abs(result.y-initial.y), `${width}: dock remains in place`).toBeLessThanOrEqual(3);
    else {
      // Results (including optional feedback/sharing) grow in the native page.
      // The primary stays anchored inside its control-bar column or action row.
      const controls = (await page.locator(".duet-followup").boundingBox())!;
      expect(result.y).toBeGreaterThan(controls.y);
      expect(result.y+result.height).toBeLessThanOrEqual(controls.y+controls.height);
    }
    expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(api.rewriteRequests.length).toBe(calls+1);
    await page.screenshot({path:`artifacts/duet-action/after/${info.project.name}/${width}x${height}-result.png`});
  }
  expect((await new AxeBuilder({page}).include(".gw-studio").analyze()).violations).toEqual([]);
});

test("action respects focus, orientation, short screens, enlarged text and all changed breakpoints", async ({app,page,browserName}, info) => {
  test.setTimeout(120_000);
  const api = await mockGhostwriterApi(page);
  await page.setViewportSize({width:390,height:844});
  await app.goto();
  await app.fillDraft("My words and selection survive each screen size.");
  await app.chooseAuthor("Stephen King");
  await app.moodDial().fill("50");
  await app.draftInput().evaluate((node:HTMLTextAreaElement) => {node.focus();node.setSelectionRange(3,8);});
  for (const width of [320,360,375,390,430,600,767,768,769,820,844,1024,1099,1100,1101,1199,1200,1201,1280,1366,1440,1920,2560]) {
    await page.setViewportSize({width,height:width===844?390:844});
    await expect(app.draftInput()).toHaveValue("My words and selection survive each screen size.");
    expect(await app.draftInput().evaluate((node:HTMLTextAreaElement) => [node.selectionStart,node.selectionEnd])).toEqual([3,8]);
    await expect(page.getByRole("button",{name:"Choose Stephen King"})).toHaveAttribute("aria-pressed","true");
    await expect(app.moodDial()).toHaveValue("50");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator(".gw-inspiration-rewrite").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(api.rewriteRequests).toHaveLength(0);
  await page.setViewportSize({width:390,height:844});
  await app.fillDraft("A long line of writing.\n".repeat(70));
  await expect(page.locator(".duet-action-primary")).toHaveAttribute("data-docked","false");
  await app.fillDraft("My words and selection survive each screen size.");
  await expect(page.locator(".duet-action-primary")).toHaveAttribute("data-docked","true");
  await app.moodDial().focus();
  await expect.poll(async () => {
    const focus = await app.moodDial().boundingBox();
    const dock = await page.locator(".duet-action-primary").boundingBox();
    return focus!.y+focus!.height <= dock!.y;
  }).toBe(true);
  await page.setViewportSize({width:390,height:568});
  await expect.poll(async () => {
    const focus = await app.moodDial().boundingBox();
    const action = await page.locator(".duet-action-primary").boundingBox();
    return focus!.y+focus!.height <= action!.y;
  }).toBe(true);
  await page.setViewportSize({width:390,height:844});
  // Touch emulation has no hardware keyboard; WebKit uses Safari's all-controls traversal.
  if (info.project.use.hasTouch) await app.rewriteButton().focus();
  else await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
  await expect(app.rewriteButton()).toBeFocused();
  const contrast = await app.rewriteButton().evaluate(button => {
    const luminance = (color:string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    };
    const ratio = (a:string,b:string) => {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const style=getComputedStyle(button), panel=getComputedStyle(button.parentElement!);
    return {text:ratio(style.color,style.backgroundColor),focus:ratio(style.outlineColor,panel.backgroundColor),outline:style.outlineWidth};
  });
  expect(contrast.text).toBeGreaterThanOrEqual(4.5);
  expect(contrast.focus).toBeGreaterThanOrEqual(3);
  expect(parseFloat(contrast.outline)).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => window.scrollTo(0,document.documentElement.scrollHeight));
  const footer = await page.locator("footer").boundingBox();
  const dock = await page.locator(".duet-action-primary").boundingBox();
  expect(footer!.y+footer!.height).toBeLessThanOrEqual(dock!.y);
  await page.screenshot({path:`artifacts/duet-action/after/${info.project.name}/bottom-clearance.png`});
  for (const height of [479,480,481,390]) {
    await page.setViewportSize({width:390,height});
    await expect(page.locator(".duet-action-primary")).toHaveAttribute("data-docked",String(height>=480));
  }
  await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:"html {font-size:200%}"});
  await expect(page.locator(".duet-action-primary")).toHaveAttribute("data-docked","false");
  await page.emulateMedia({reducedMotion:"reduce"});
  await app.runRewrite();
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".gw-inspiration-rewrite").evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight<=el.clientHeight)).toBe(true);
  await page.screenshot({path:`artifacts/duet-action/after/${info.project.name}/enlarged-in-flow.png`,fullPage:true});
});

test("long results remain in native flow and the primary stays inside its controls", async ({app,page}, info) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await mockGhostwriterApi(page,{rewrite:{json:{rewrite:"A longer returned paragraph remains readable without an internal scroller. ".repeat(25),artifactToken:apiResponses.artifactToken}}});
  await page.setViewportSize({width:1280,height:720});
  await app.goto();
  await app.fillDraft("A draft to rewrite.");
  await app.runRewrite();
  await expect(page.locator('[data-phase="complete"]')).toBeVisible();
  const controls=(await page.locator(".duet-followup").boundingBox())!;
  const action=(await app.rewriteButton().boundingBox())!;
  expect(action.y).toBeGreaterThan(controls.y);
  expect(action.y+action.height).toBeLessThan(controls.y+controls.height);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Copy rewrite",exact:true}).focus();
  await expect.poll(async () => {
    const copy=(await page.getByRole("button",{name:"Copy rewrite",exact:true}).boundingBox())!;
    const dock=(await page.locator(".duet-action-primary").boundingBox())!;
    return copy.y+copy.height <= dock.y;
  }).toBe(true);
  await page.screenshot({path:`artifacts/duet-action/after/${info.project.name}/long-result-copy-clearance.png`});
});
