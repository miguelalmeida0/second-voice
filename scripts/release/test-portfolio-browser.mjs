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
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1512, height: 982 }, { width: 1920, height: 1080 }]) {
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
    const signIn=page.getByRole("button",{name:"Sign in with GitHub",exact:true}).and(page.locator(":not(.sr-only)"));
    const primary=page.getByRole("button",{name:/^Rewrite (my draft|again)$/});
    const input=page.getByLabel("Write or paste here");
    const message=page.locator(".duet-actions").getByRole("status");
    const capture=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`.tmp/release/portfolio-ui/${name}-${viewport.width}.png`,fullPage:true});};
    async function refreshSession(){await page.evaluate(()=>window.dispatchEvent(new Event("ghostwriter-allowance-changed")));}
    await page.goto(origin+"/second-voice");
    await expect(signIn).toBeVisible();await expect(primary).toBeDisabled();assert.equal(calls,0);
    await expect(message).toContainText("3 free rewrites left today");
    await expect(primary).toHaveCount(1);
    assert.equal(await page.evaluate(()=>scrollY),0);
    const initialAction=await primary.boundingBox();
    assert.ok(initialAction.y>=0 && initialAction.y+initialAction.height<=viewport.height);
    if(viewport.width<768) await expect(page.locator(".duet-action-selection")).toHaveText("Tolkien");
    await capture("anonymous-recruiter");
    await signIn.click();
    await expect(page.locator(".duet-auth-message")).toBeVisible();
    await capture("auth-return-error");
    signedIn=true;allowance={remaining:3,todayRemaining:3,available:true};
    await refreshSession();await expect(page.getByRole("button",{name:"Sign out",exact:true})).toBeVisible();
    await expect(signIn).toHaveCount(0);
    const text="I missed the train, so I walked home.";
    await input.fill(text);await expect(primary).toBeEnabled();
    await capture("ready");
    const second=await context.newPage();await second.goto(origin+"/second-voice");
    await expect(second.getByRole("button",{name:"Sign out",exact:true})).toBeVisible();
    await expect(second.getByRole("button",{name:/^Rewrite (my draft|again)$/})).toBeDisabled();
    await second.close();
    await page.getByRole("button",{name:"Outcomes",exact:true}).click();
    await page.getByRole("group",{name:"Outcome options"}).getByRole("button",{name:/Be concise/}).click();
    await primary.click();await expect(message).toContainText("2 rewrites left");
    await expect(page.locator(".gw-playback-panel-strong > p")).toHaveText("A lantern burned beside the quiet road.");
    await page.getByRole("button",{name:"Copy rewrite",exact:true}).click();
    await expect(page.getByRole("button",{name:"Rewrite copied",exact:true})).toBeVisible();
    await capture("result");
    await page.getByRole("button",{name:"Authors",exact:true}).click();
    await primary.click();await expect.poll(()=>calls).toBe(2);
    await expect(message).toContainText("1 rewrites left");
    await page.getByRole("button",{name:"Surprise me",exact:true}).click();
    await expect.poll(()=>calls).toBe(3);await expect(primary).toBeDisabled();
    await expect(message).toContainText("3 rewrites in the last 24 hours");
    await expect(page.locator(".gw-inspiration-status-detail")).toContainText("Try again when an earlier rewrite leaves that window");
    await capture("exhausted");
    for(const status of [503,-1,429]){
      allowance={remaining:2,todayRemaining:2,available:true};await refreshSession();await expect(primary).toBeEnabled();
      failure=status;await primary.click();
      await expect(page.locator(".gw-error-panel")).toContainText(status===429?"Please wait 60 seconds":status===503?"Synthetic unavailability":"AI demo is temporarily unavailable");
      await expect(input).toHaveValue(text);
      const count=calls;await page.waitForTimeout(300);assert.equal(calls,count);
      await capture("failure-"+status);
      if(status===429){await expect(primary).toBeDisabled();await page.clock.setFixedTime(Date.now()+61000);}
    }
    failure=0;
    allowance={remaining:2,todayRemaining:2,available:false};await refreshSession();await expect(message).toContainText("temporarily unavailable");await expect(primary).toBeDisabled();
    unavailable=true;await refreshSession();await expect(page.locator('[data-session-status="unavailable"]')).toBeVisible();await expect(signIn).toHaveCount(0);
    unavailable=false;allowance={remaining:3,todayRemaining:3,available:true};await refreshSession();await expect(primary).toBeEnabled();
    const help=page.getByRole("button",{name:"How it works",exact:true});
    await help.click();await expect(page.getByRole("dialog")).toHaveCSS("opacity","1");
    assert.equal(await page.getByRole("button",{name:"Sign out",exact:true}).evaluate(el=>el.inert),true);
    await capture("help");await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toBeHidden();await expect(help).toBeFocused();
    assert.equal(await page.getByRole("button",{name:"Sign out",exact:true}).evaluate(el=>el.inert),false);
    const geometry=await page.evaluate(()=>{window.scrollTo(0,document.documentElement.scrollHeight);return {width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,scroller:document.scrollingElement===document.documentElement,portal:!!document.querySelector("nextjs-portal")};});
    assert.ok(geometry.scrollWidth<=geometry.width);assert.ok(geometry.scroller);assert.equal(geometry.portal,false);
    const accessibility=await new AxeBuilder({page}).include(".gw-studio").withTags(["wcag2a","wcag2aa","wcag21aa","wcag22aa"]).analyze();
    assert.deepEqual(accessibility.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)})),[]);
    await page.screenshot({path:`.tmp/release/portfolio-ui/bottom-${viewport.width}.png`});
    await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(signIn).toBeVisible();await expect(input).toHaveValue("");await expect(primary).toBeDisabled();
    await page.reload();await expect(signIn).toBeVisible();await expect(primary).toBeDisabled();
    assert.equal(calls,6);assert.deepEqual(requestedModes.slice(0,2),["outcome","author"]);assert.deepEqual(errors,[]);
    await context.close();
  }
  console.log(JSON.stringify({ status: "PASS", scope: "Production-rendered desktop/mobile UI with synthetic auth and rewrite responses only", checks: ["Duet empty initial state", "routes", "invalid-oauth-callback-fails-closed", "anonymous-signin-entry", "authenticated-new-tab", "unavailable-is-not-logged-out", "session-refresh", "author-and-outcome-requests", "daily-quota-explanation", "exhausted", "paused", "quota-and-network-failure-preserve-text", "no-automatic-retry", "copy-confirmation", "help-focus-restoration", "axe-WCAG-AA", "one-document-scroller", "no-horizontal-overflow", "signout-clears-draft", "no-page-errors"], liveProviderCalls: 0 }));
} catch (error) {
  if (/bootstrap_check_in|MachPortRendezvous|Permission denied|operation not permitted/.test(String(error))) {
    console.error("BROWSER_BLOCKED: native browser bootstrap permission denied"); process.exitCode = 2;
  } else { console.error(error); process.exitCode = 1; }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null) await new Promise(done => server.once("exit", done));
}
