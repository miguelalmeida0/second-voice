import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { portfolioAccessView } from "../src/lib/portfolio-access.ts";

const require = createRequire(import.meta.url);

// Execute the real route/proxy with only their external boundaries replaced.
// No production delay or test-only flag is needed to stall the datastore.
function loadSource(path: string, boundaries: Record<string, unknown>) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const evaluated = { exports: {} as Record<string, (...args: never[]) => unknown> };
  const scopedRequire = (id: string) => {
    if (id in boundaries) return boundaries[id];
    if (id.startsWith("@/")) throw new Error(`Uncontrolled boundary: ${id}`);
    return require(id);
  };
  new Function("require", "module", "exports", outputText)(scopedRequire, evaluated, evaluated.exports);
  return evaluated.exports;
}

test("studio route returns a fail-closed shell while the session datastore is stalled", async () => {
  const previous = process.env.GHOSTWRITER_RELEASE_PROFILE;
  process.env.GHOSTWRITER_RELEASE_PROFILE = "portfolio-free";
  let resolveSession!: (value: unknown) => void;
  const stalled = new Promise((resolve) => { resolveSession = resolve; });
  const route = loadSource("src/app/second-voice/page.tsx", {
    "next/headers": { headers: async () => new Headers() },
    "next/navigation": { redirect: () => { throw new Error("unexpected redirect"); } },
    "@/server/auth-origin": { localAuthPageRedirect: () => null },
    "@/server/ghostwriter-feature-flags": { getGhostwriterFeatureAvailability: () => ({ rewriteEnabled: true }) },
    "@/server/portfolio-session": { resolvePortfolioSession: () => stalled },
    "@/components/ghostwriter/PortfolioAccess": { PortfolioAccess: "PortfolioAccess" },
    "@/components/ghostwriter/SecondVoiceExperience": { SecondVoiceExperience: "SecondVoiceExperience" },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      route.default(),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), 150); }),
    ]) as { props: { enabled: boolean; initialSession?: { status: "checking" }; children: { type: string } } } | null;
    assert.ok(result, "studio must return before the datastore resolves");
    assert.equal(result.props.enabled, true);
    assert.equal(result.props.children.type, "SecondVoiceExperience");
    assert.equal(portfolioAccessView(result.props.initialSession ?? { status: "checking" }, true, true).canGenerate, false);
  } finally {
    clearTimeout(timer);
    resolveSession({ status: "checking" });
    if (previous === undefined) delete process.env.GHOSTWRITER_RELEASE_PROFILE;
    else process.env.GHOSTWRITER_RELEASE_PROFILE = previous;
  }
});

test("canonical host redirect still precedes studio rendering", async () => {
  const route = loadSource("src/app/second-voice/page.tsx", {
    "next/headers": { headers: async () => new Headers({ host: "localhost:4003" }) },
    "next/navigation": { redirect: (url: string) => { throw new Error(`redirect:${url}`); } },
    "@/server/auth-origin": { localAuthPageRedirect: () => "http://127.0.0.1:4003/" },
    "@/server/ghostwriter-feature-flags": { getGhostwriterFeatureAvailability: () => { throw new Error("rendered before redirect"); } },
    "@/server/portfolio-session": {},
    "@/components/ghostwriter/PortfolioAccess": {},
    "@/components/ghostwriter/SecondVoiceExperience": {},
  });
  await assert.rejects(async () => route.default(), /redirect:http:\/\/127.0.0.1:4003\//);
});

test("new visitors get identity and shield cookies on the studio response without a self redirect", () => {
  const previous = process.env.GHOSTWRITER_RELEASE_PROFILE;
  process.env.GHOSTWRITER_RELEASE_PROFILE = "portfolio-free";
  const { NextRequest } = require("next/server");
  const proxy = loadSource("src/proxy.ts", {
    "@/server/auth-origin": { homepageOAuthRedirect: () => null },
    "@/lib/security-http": { buildContentSecurityPolicy: () => "default-src 'self'" },
    "@/server/security-events": { logSecurityEvent: () => {} },
    "@/server/abuse-protection": {
      GHOSTWRITER_CSRF_COOKIE: "test-csrf", GHOSTWRITER_SESSION_COOKIE: "test-shield",
      cookieSettings: () => ({ httpOnly: true, sameSite: "lax", path: "/" }),
      ensureShieldCookies: () => ({ needsSet: true, sessionToken: "fixture-shield", csrfToken: "fixture-csrf" }),
    },
    "@/server/anonymous-visitor": {
      ensureAnonymousVisitor: () => ({ isNew: true, envelope: "fixture-visitor" }),
      anonymousVisitorCookieName: () => "test-visitor",
      anonymousVisitorCookieSettings: () => ({ httpOnly: true, sameSite: "lax", path: "/" }),
    },
  });
  try {
    const response = proxy.proxy(new NextRequest("http://127.0.0.1:4003/") as never) as Response & { cookies: { get: (key: string) => { value: string; httpOnly?: boolean } } };
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.cookies.get("test-visitor").value, "fixture-visitor");
    assert.equal(response.cookies.get("test-shield").httpOnly, true);
    assert.equal(response.cookies.get("test-csrf").httpOnly, false);
    assert.ok(response.headers.get("content-security-policy"));
  } finally {
    if (previous === undefined) delete process.env.GHOSTWRITER_RELEASE_PROFILE;
    else process.env.GHOSTWRITER_RELEASE_PROFILE = previous;
  }
});
