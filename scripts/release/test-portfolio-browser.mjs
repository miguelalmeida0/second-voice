// Production-rendered UI acceptance with explicitly synthetic browser responses.
// Not proof of OAuth, durable admission, or provider execution. No real key is used.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
  // "/" 308s to "/second-voice", and a brand-new portfolio-free visitor there
  // gets a further one-time 307 bootstrap redirect to itself once the
  // anonymous-visitor cookie is issued (src/proxy.ts). A real browser resends
  // cookies automatically across both hops; a bare fetch() with no cookie jar
  // never does, so it loops until the redirect budget is exhausted. Follow
  // redirects manually, carrying cookies, same as any real client.
  async function fetchFollowingBootstrap(path) {
    const jar = new Map();
    let url = origin + path;
    for (let hop = 0; hop < 5; hop++) {
      const response = await fetch(url, { redirect: "manual", headers: { cookie: [...jar].map(([k, v]) => k + "=" + v).join("; ") } });
      for (const value of response.headers.getSetCookie()) {
        const pair = value.split(";")[0], i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
      if (response.status < 300 || response.status >= 400) return response;
      await response.arrayBuffer();
      url = new URL(response.headers.get("location"), url).toString();
    }
    throw new Error("Too many redirects for " + path);
  }
  assert.equal((await fetchFollowingBootstrap("/")).status, 200);
  assert.equal((await fetchFollowingBootstrap("/second-voice")).status, 200);
  assert.equal((await fetch(origin + "/api/ghostwriter/auth/callback", { redirect: "manual" })).status, 401);
  browser = await chromium.launch({headless:process.env.GHOSTWRITER_HEADED_QA!=="true"});
  mkdirSync(".tmp/release/portfolio-ui", { recursive: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }, { width: 1512, height: 982 }]) {
    const context=await browser.newContext({viewport,reducedMotion:"reduce",permissions:["clipboard-read","clipboard-write"]});
    const page=await context.newPage();
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    let signedIn=false,unavailable=false,failure=0,calls=0,authDelay=700;
    const requestedModes=[];
    let allowance={remaining:3,todayRemaining:3,available:true};
    await context.route("**/*",async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      if(url.pathname==="/api/ghostwriter/auth"){
        const action=route.request().postDataJSON()?.action;
        if(action==="logout"){signedIn=false;allowance={remaining:3,todayRemaining:3,available:true};return route.fulfill({json:{message:"Signed out."}});}
        await new Promise(done=>setTimeout(done,authDelay));
        return route.fulfill({status:unavailable?503:200,json:unavailable?{message:"Synthetic session response"}:{mode:signedIn?"authenticated":"anonymous",allowance}});
      }
      if(url.pathname==="/api/ghostwriter/challenge")return route.fulfill({json:{challengeToken:"synthetic-browser-challenge",difficulty:0}});
      if(url.pathname==="/api/ghostwriter"){
        calls++;
        requestedModes.push(route.request().postDataJSON()?.mode);
        if(failure===-1)return route.abort("failed");
        if(failure)return route.fulfill({status:failure,headers:failure===429?{"Retry-After":"60"}:{},json:{error:failure===429?"Please wait 60 seconds between rewrites, then try again. Your text has been kept. No rewrite was started.":"Synthetic unavailability"}});
        allowance={remaining:Math.max(0,3-calls),todayRemaining:Math.max(0,3-calls),available:true};
        return route.fulfill({json:{rewrite:"A lantern burned beside the quiet road.",artifactToken:"synthetic-ui-artifact-not-server-verified",operationId:"synthetic-operation"}});
      }
      return route.continue();
    });
    // BetaSignIn's headless mode always renders a hidden sr-only trigger with
    // the same accessible name as SecondVoiceExperience's visible corner
    // button, regardless of session status. It uses a 1x1px clip technique
    // that Playwright's :visible still counts as visible, so exclude it by
    // its sr-only class instead, scoping to the real corner button only.
    const signIn=page.getByRole("button",{name:"Sign in with GitHub",exact:true}).and(page.locator(":not(.sr-only)"));
    const primary=page.getByRole("button",{name:/^Rewrite (as|to) /});
    const input=page.getByLabel("Write or paste here");
    const message=page.locator(".ghostwriter").getByRole("status").filter({hasText:/rewrite|last 24 hours|temporarily unavailable|used for today/});
    async function refreshSession(){await page.evaluate(()=>window.dispatchEvent(new Event("ghostwriter-allowance-changed")));}
    await page.goto(origin+"/second-voice");
    await expect(signIn).toBeVisible();await expect(primary).toBeEnabled();assert.equal(calls,0);
    await expect(message).toContainText("3 free rewrites left today");
    await page.screenshot({path:".tmp/release/portfolio-ui/anonymous-recruiter-"+viewport.width+".png",fullPage:true});
    signedIn=true;allowance={remaining:3,todayRemaining:3,available:true};
    authDelay=2500;
    await page.reload();
    // SUPABASE_URL here is deliberately unreachable, so SSR's own session
    // resolution (resolvePortfolioSession) always fails closed to
    // "unavailable" on a fresh navigation; the client then self-heals via its
    // mount effect (BetaSignIn.tsx re-checks whenever status is "unavailable")
    // against the mocked /api/ghostwriter/auth route. It never renders
    // "checking" here, and portfolio mode never hides the studio behind a
    // full-page loader either way (see SecondVoiceExperience.tsx).
    await expect(page.locator('[data-session-status="unavailable"]')).toBeVisible();
    await page.screenshot({path:".tmp/release/portfolio-ui/session-refined-"+viewport.width+".png"});
    await expect(signIn).toHaveCount(0);
    await expect(primary).toBeEnabled();
    authDelay=700;
    const second=await context.newPage();
    await second.goto(origin+"/second-voice");
    // Same SSR fail-closed reasoning as above: a fresh navigation with an
    // unreachable Supabase URL resolves "unavailable" server-side first.
    await expect(second.locator('[data-session-status="unavailable"]')).toBeVisible();
    await expect(second.getByRole("button",{name:/^Rewrite (as|to) /})).toBeEnabled();
    await second.close();
    await page.bringToFront();
    await expect(page.getByRole("button",{name:"Surprise me",exact:true})).toBeEnabled();
    await expect(page.getByRole("button",{name:"Surprise me",exact:true})).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
    await expect(page.locator(".gw-studio-mascot")).toBeVisible();
    await page.screenshot({path:".tmp/release/portfolio-ui/responsive-initial-"+viewport.width+".png",fullPage:true});
    await expect(page.locator(".gw-studio-mascot")).toHaveCSS("pointer-events","none");
    await expect(page.getByRole("button",{name:"Sign out",exact:true})).toHaveCSS("position","absolute");
    if(viewport.width<700){
      const artwork=await page.locator(".gw-studio-mascot").boundingBox();
      const logout=await page.getByRole("button",{name:"Sign out",exact:true}).boundingBox();
      assert.ok(artwork.x+artwork.width<=logout.x || artwork.y>=logout.y+logout.height,"Logout must not overlap mobile mascot artwork");
      assert.ok(artwork.width>=130 && artwork.height>=130,"Mobile mascot must retain meaningful presence");
    }
    assert.equal(await page.locator(".gw-author-portrait").count(),4);
    for(const portrait of await page.locator(".gw-author-portrait").all()){
      await expect(portrait).toBeVisible();
      assert.ok(await portrait.evaluate(img=>img.complete && img.naturalWidth>0));
    }
    for(const name of ["Tolkien","Stephen King","Tolstoy","Hemingway"]){
      await page.locator(".gw-author-portrait-button").filter({hasText:name}).click();
      await expect(primary).toContainText(name==="Stephen King"?"King":name);
    }
    await page.locator(".gw-author-portrait-button").filter({hasText:"Tolkien"}).click();
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:".tmp/release/portfolio-ui/redesign-authors-"+viewport.width+".png",fullPage:true});
    await page.locator(".gw-inspiration").screenshot({path:".tmp/release/portfolio-ui/quickstarts-"+viewport.width+".png"});
    if(viewport.width<700){
      assert.ok(await page.locator('.gw-studio-output [data-phase="idle"] > .gw-playback-panel').evaluate(el=>el.getBoundingClientRect().height<=120),"Mobile empty result should not add a full editor of dead space");
    }
    if(viewport.width<=1100){
      const toggle=page.getByRole("button",{name:/Quick starts Find a first line/});
      await expect(toggle).toHaveAttribute("aria-expanded","false");
      await expect(page.getByRole("button",{name:"A rainy day thought",exact:true})).not.toBeVisible();
      await page.evaluate(()=>window.scrollTo(0,0));
      const draft=await input.boundingBox(), cta=await primary.boundingBox(), result=await page.locator(".gw-studio-output").boundingBox();
      assert.ok(cta.y>=draft.y+draft.height && cta.y<draft.y+draft.height+50,"Small-screen rewrite action immediately follows draft");
      assert.ok(result.y>cta.y,"Small-screen result follows the action, not an empty desktop column");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded","true");
      await expect(page.getByRole("button",{name:"A rainy day thought",exact:true})).toBeVisible();
    }else{
      await expect(page.getByRole("heading", {name:"Quick starts", exact:true})).toBeVisible();
    }
    await expect(page.locator(".gw-inspiration-prompt")).toHaveCount(6);
    await expect(page.getByText("Better writing,", {exact:false})).toHaveCount(0);
    await expect(page.getByRole("link", {name:"Portrait credits", exact:true})).toHaveCount(0);
    await page.evaluate(()=>window.scrollTo(0,0));
    if(viewport.width>=1440){
      const inputBox=await input.boundingBox(), outputBox=await page.locator(".gw-studio-output").boundingBox();
      assert.ok((await page.locator(".gw-studio-input").boundingBox()).y<500,"Editor panel must begin in the first 500 desktop pixels");
      assert.ok(outputBox.x>inputBox.x && outputBox.y<550,"Desktop result must sit beside the editor");
      const ctaBox=await primary.boundingBox();
      assert.ok(ctaBox.y+ctaBox.height<=viewport.height,"Primary CTA must fit in the first desktop viewport");
      assert.ok(ctaBox.width<=340 && ctaBox.height>=44 && ctaBox.height<=52,"Desktop CTA must be bounded without sacrificing its touch target");
      const promptBox=await page.locator(".gw-inspiration-prompt").first().boundingBox();
      assert.ok(promptBox.y>ctaBox.y+ctaBox.height,"Optional prompts must follow the primary action");
      assert.ok(promptBox.height>=44 && promptBox.height<80,"Quick starts must be compact and touch accessible");
    }
    assert.ok(await page.locator(".gw-inspiration-actions").evaluate(el=>el.firstElementChild.classList.contains("gw-inspiration-rewrite")),"Reading and keyboard order must match primary-first visual order");
    await page.getByRole("button",{name:"Outcomes",exact:true}).click();
    for(const name of ["Improve clarity","Get a reply","Sound confident","Be concise","Be persuasive"]){
      await page.locator(".gw-outcome-choice").filter({hasText:name}).click();
      await expect(primary).toContainText(name.toLowerCase());
    }
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expect(page.locator(".gw-rewrite-mood")).toContainText(/Outcome.*Be persuasive/i);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:".tmp/release/portfolio-ui/redesign-outcomes-"+viewport.width+".png",fullPage:true});
    await page.getByRole("button",{name:"Authors",exact:true}).click();
    const text="My original words remain here through every failure.";
    await input.fill("A sentence for testing the growing writing surface. ".repeat(30));
    assert.ok(await input.evaluate(el=>el.scrollHeight<=el.clientHeight+2),"Long draft must grow without internal scrolling");
    await page.setViewportSize({width:viewport.width<700?820:390,height:viewport.height});
    await expect.poll(()=>input.evaluate(el=>el.scrollHeight<=el.clientHeight+2)).toBe(true);
    await page.setViewportSize(viewport);
    await expect.poll(()=>input.evaluate(el=>el.scrollHeight<=el.clientHeight+2)).toBe(true);
    await input.fill(text);
    await page.getByRole("button",{name:"Outcomes",exact:true}).click();
    await page.getByRole("button",{name:/Sound confident/}).click();
    await expect(primary).toContainText("sound confident");await expect(input).toHaveValue(text);
    await page.getByRole("button",{name:"Authors",exact:true}).click();
    const slider=page.getByRole("slider");await slider.focus();await slider.press("ArrowRight");await expect(slider).toHaveValue("53");
    await expect(input).toHaveValue(text);
    await page.getByRole("button",{name:"A rainy day thought",exact:true}).click();
    assert.notEqual(await input.inputValue(),text);await input.fill(text);
    await page.getByRole("button",{name:"How it works",exact:true}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("In Outcomes");
    assert.ok(await page.locator('button[aria-label="Sign out"]').evaluate(el=>el.inert), "Logout must be inert behind help");
    await page.screenshot({path:".tmp/release/portfolio-ui/help-"+viewport.width+".png"});
    await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button",{name:"How it works",exact:true})).toBeFocused();
    assert.equal(await page.getByRole("button",{name:"Sign out",exact:true}).evaluate(el=>el.inert), false);
    await expect(page.locator("#gw-surprise-description")).toHaveText("Random voice · uses 1 rewrite");
    await page.getByRole("button",{name:"Outcomes",exact:true}).click();
    await expect(page.locator("#gw-surprise-description")).toHaveText("Random outcome · uses 1 rewrite");
    await page.locator(".gw-outcome-choice").filter({hasText:"Be persuasive"}).click();
    await input.focus();
    await expect(input).toHaveCSS("outline-style","none");
    await expect(page.locator(".gw-composer-field")).toHaveCSS("border-color","rgb(155, 202, 255)");
    await input.press("ControlOrMeta+a");
    await page.locator(".gw-composer-field").screenshot({path:".tmp/release/portfolio-ui/focus-"+viewport.width+".png"});
    await page.clock.install();
    await expect(primary).toHaveCSS("cursor","pointer");
    await expect(page.getByRole("button",{name:"A rainy day thought",exact:true})).toHaveCSS("cursor","pointer");
    await primary.click();await expect(message).toContainText("2 rewrites left in your rolling 24-hour allowance");assert.equal(calls,1);
    await expect(page.locator(".gw-playback-panel-strong > p")).toHaveText("A lantern burned beside the quiet road.");
    await page.getByRole("button",{name:"Copy rewrite",exact:true}).click();
    await expect(page.getByRole("button",{name:"Rewrite copied",exact:true})).toBeVisible();
    await expect(primary).toBeEnabled();await expect(primary).toHaveCSS("cursor","pointer");
    const secondStatus=page.waitForResponse(r=>r.url().endsWith("/api/ghostwriter/auth"));
    await page.getByRole("button",{name:"Authors",exact:true}).click();
    // Switching modes triggers its own session/allowance refresh; the rewrite
    // button only actually submits once that settles, so wait for it before
    // clicking, not after (a mode switch must never fire a rewrite against a
    // stale allowance snapshot).
    await (await secondStatus).finished();await page.waitForTimeout(100);
    await expect(primary).toBeEnabled();
    await primary.click();
    await expect.poll(()=>calls).toBe(2);
    if(viewport.width<=1100){
      await expect(page.locator(".gw-inspiration-toggle")).toHaveAttribute("aria-expanded","false");
      const resultTop=await page.locator(".gw-studio-output").evaluate(el=>el.getBoundingClientRect().top);
      assert.ok(resultTop>=-2 && resultTop<viewport.height,"Starting a mobile rewrite brings its result into view");
    }
    await expect(primary).toBeEnabled();
    const surpriseStatus=page.waitForResponse(r=>r.url().endsWith("/api/ghostwriter/auth"));
    await page.getByRole("button",{name:"Surprise me",exact:true}).click();
    await (await surpriseStatus).finished();await page.waitForTimeout(100);
    await expect(primary).toBeDisabled();assert.equal(calls,3);
    allowance={remaining:2,todayRemaining:2,available:true};await refreshSession();await expect(primary).toBeEnabled();await input.fill(text);
    for(const status of [429,503,-1]){
      const failureStatus=page.waitForResponse(r=>r.url().endsWith("/api/ghostwriter/auth"));
      failure=status;await primary.click();
      // GhostwriterPage.tsx relays the server's own JSON error verbatim for a
      // real structured API response (429/503 here), and only falls back to
      // the generic "AI demo is temporarily unavailable" copy when the fetch
      // itself fails with no response at all (status -1 aborts the request).
      await expect(page.locator(".gw-error-panel")).toContainText(
        status===429 ? "Please wait 60 seconds" : status===503 ? "Synthetic unavailability" : "AI demo is temporarily unavailable",
      );
      await (await failureStatus).finished();await page.waitForTimeout(100);
      if(status===429){await expect(primary).toBeDisabled();await page.clock.fastForward(61000);}
      await expect(primary).toBeEnabled();await expect(input).toHaveValue(text);
      const count=calls;await page.waitForTimeout(300);assert.equal(calls,count);
      await expect(page.getByRole("button",{name:"Try again",exact:true})).toHaveCount(0);
    }
    allowance={remaining:0,todayRemaining:0,available:true};await refreshSession();
    await expect(primary).toBeDisabled();await expect(message).toContainText("3 rewrites in the last 24 hours");
    await expect(page.getByRole("button",{name:"Surprise me",exact:true})).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
    await expect(input).toHaveValue(text);
    allowance={remaining:2,todayRemaining:2,available:false};await refreshSession();await expect(message).toContainText("temporarily unavailable");await expect(primary).toBeDisabled();
    allowance={remaining:3,todayRemaining:3,available:true};await refreshSession();await expect(primary).toBeEnabled();
    // Verify unknown is never treated as anonymous, even after a known session.
    unavailable=true;await refreshSession();
    await expect(page.locator('[data-session-status="unavailable"]')).toBeVisible();await expect(signIn).toHaveCount(0);
    // Portfolio/headless mode has no visible "Try again" button (BetaSignIn
    // renders only a sr-only control); recovery is the same session-refresh
    // signal the rest of this flow already uses.
    unavailable=false;await refreshSession();
    await expect(primary).toBeEnabled();
    const geometry=await page.evaluate(()=>{
      window.scrollTo(0,document.documentElement.scrollHeight);
      return {width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scroller:document.scrollingElement===document.documentElement,portal:!!document.querySelector("nextjs-portal")};
    });
    assert.ok(geometry.scrollWidth<=geometry.width);assert.ok(geometry.scroller);assert.equal(geometry.portal,false);
    const accessibility = await new AxeBuilder({ page }).include(".gw-studio").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    assert.deepEqual(accessibility.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)})), [], "Studio must have no automated WCAG A/AA violations");
    const undersized = await page.locator(".gw-studio button").evaluateAll(buttons=>buttons.filter(button=>{
      const rect=button.getBoundingClientRect();
      return rect.width>0 && rect.height>0 && (rect.width<24 || rect.height<24);
    }).map(button=>button.textContent.trim()));
    assert.deepEqual(undersized, [], "Visible buttons must meet the 24 CSS pixel WCAG minimum without spacing exceptions");
    await page.screenshot({path:".tmp/release/portfolio-ui/bottom-"+viewport.width+".png"});
    await page.screenshot({path:".tmp/release/portfolio-ui/full-"+viewport.width+".png",fullPage:true});
    await page.getByRole("button",{name:"Sign out",exact:true}).click();
    await expect(signIn).toBeVisible();await expect(primary).toBeEnabled();await page.reload();await expect(signIn).toBeVisible();await expect(primary).toBeEnabled();
    assert.equal(calls,6);assert.deepEqual(requestedModes.slice(0,2),["outcome","author"]);assert.deepEqual(errors,[]);await context.close();
  }
  console.log(JSON.stringify({ status: "PASS", scope: "Production-rendered desktop/mobile UI with synthetic auth and rewrite responses only", checks: ["routes", "invalid-oauth-callback-fails-closed", "anonymous-only-signin", "zero-signin-insertions-on-refresh-and-new-tab", "unavailable-is-not-logged-out", "session-retry", "authors-outcomes-mood-quick-starts", "daily-quota-explanation", "trial-allowance", "exhausted", "paused", "quota-and-network-failure-preserve-text", "no-automatic-retry", "one-document-scroller", "no-horizontal-overflow", "no-page-errors"], liveProviderCalls: 0 }));
} catch (error) {
  if (/bootstrap_check_in|MachPortRendezvous|Permission denied|operation not permitted/.test(String(error))) {
    console.error("BROWSER_BLOCKED: native browser bootstrap permission denied"); process.exitCode = 2;
  } else { console.error(error); process.exitCode = 1; }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null) await new Promise(done => server.once("exit", done));
}
