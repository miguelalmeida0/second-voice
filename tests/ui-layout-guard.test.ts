import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const GLOBALS_PATH = new URL("../src/app/globals.css", import.meta.url);
const GUARD_PATH = new URL("../src/app/ghostwriter-overflow-guard.css", import.meta.url);
const LAYOUT_PATH = new URL("../src/app/layout.tsx", import.meta.url);
const ROUTE_PATH = new URL("../src/app/second-voice/page.tsx", import.meta.url);
const CASE_STUDY_ROUTE_PATH = new URL("../src/app/second-voice/case-study/page.tsx", import.meta.url);
const LEGACY_ROUTE_PATH = new URL("../src/app/ghostwriter/page.tsx", import.meta.url);
const LEGACY_CASE_STUDY_ROUTE_PATH = new URL(
  "../src/app/ghostwriter/case-study/page.tsx",
  import.meta.url,
);
const OG_ROUTE_PATH = new URL("../src/app/api/og/[id]/route.ts", import.meta.url);
const PROXY_PATH = new URL("../src/proxy.ts", import.meta.url);
const NEXT_CONFIG_PATH = new URL("../next.config.ts", import.meta.url);
const PACKAGE_PATH = new URL("../package.json", import.meta.url);
const PAGE_PATH = new URL("../src/components/ghostwriter/GhostwriterPage.tsx", import.meta.url);
const SHARE_PAGE_PATH = new URL("../src/app/g/[id]/page.tsx", import.meta.url);
const SHARE_NOT_FOUND_PATH = new URL("../src/app/g/[id]/not-found.tsx", import.meta.url);
const CASE_STUDY_PATH = new URL(
  "../src/components/ghostwriter/case-study/CaseStudyPage.tsx",
  import.meta.url,
);
const CASE_STUDY_TOP_BAR_PATH = new URL(
  "../src/components/ghostwriter/case-study/TopBar.tsx",
  import.meta.url,
);
const CASE_STUDY_FOOTER_PATH = new URL(
  "../src/components/ghostwriter/case-study/Footer.tsx",
  import.meta.url,
);
const CASE_STUDY_HERO_PATH = new URL(
  "../src/components/ghostwriter/case-study/Hero.tsx",
  import.meta.url,
);
const CASE_STUDY_PULL_QUOTE_PATH = new URL(
  "../src/components/ghostwriter/case-study/PullQuote.tsx",
  import.meta.url,
);
const CASE_STUDY_CLOSING_NOTES_PATH = new URL(
  "../src/components/ghostwriter/case-study/ClosingNotes.tsx",
  import.meta.url,
);
const CASE_STUDY_WHY_STACK_PATH = new URL(
  "../src/components/ghostwriter/case-study/WhyThisStack.tsx",
  import.meta.url,
);
const CASE_STUDY_WHAT_CHANGED_PATH = new URL(
  "../src/components/ghostwriter/case-study/WhatChanged.tsx",
  import.meta.url,
);
const HERO_ART_PATH = new URL("../src/components/ghostwriter/HeroArtwork.tsx", import.meta.url);
const ORBITAL_PATH = new URL("../src/components/ghostwriter/AuthorOrbital.tsx", import.meta.url);
const MOOD_DIAL_PATH = new URL("../src/components/ghostwriter/MoodDial.tsx", import.meta.url);
const OUTCOME_OPTIONS_PATH = new URL(
  "../src/components/ghostwriter/OutcomeOptions.tsx",
  import.meta.url,
);
const REWRITE_PLAYBACK_PATH = new URL(
  "../src/components/ghostwriter/RewritePlayback.tsx",
  import.meta.url,
);
const REWRITE_FEEDBACK_PANEL_PATH = new URL(
  "../src/components/ghostwriter/RewriteFeedbackPanel.tsx",
  import.meta.url,
);
const FEATURE_FLAGS_PATH = new URL(
  "../src/server/ghostwriter-feature-flags.ts",
  import.meta.url,
);
const REWRITE_LAB_PANEL_PATH = new URL(
  "../src/components/ghostwriter/RewriteLabPanel.tsx",
  import.meta.url,
);
const REWRITE_LAB_SCORE_CARD_PATH = new URL(
  "../src/components/ghostwriter/RewriteLabScoreCard.tsx",
  import.meta.url,
);
const REWRITE_LAB_TRACE_PATH = new URL(
  "../src/components/ghostwriter/RewriteLabTrace.tsx",
  import.meta.url,
);
const REWRITE_LAB_ROUTE_PATH = new URL(
  "../src/app/api/ghostwriter/lab/route.ts",
  import.meta.url,
);
const REWRITE_LAB_SERVER_PATH = new URL("../src/server/ghostwriter-lab.ts", import.meta.url);
const REWRITE_LAB_SHARED_PATH = new URL(
  "../src/lib/ghostwriter-lab-shared.ts",
  import.meta.url,
);
const CLIENT_GUARD_PATH = new URL("../src/lib/ghostwriter-client-guard.ts", import.meta.url);
const HOW_IT_WORKS_DRAWER_PATH = new URL(
  "../src/components/ghostwriter/HowItWorksDrawer.tsx",
  import.meta.url,
);
const CASE_LIVE_EXAMPLE_PATH = new URL(
  "../src/components/ghostwriter/case-study/LiveExample.tsx",
  import.meta.url,
);
const CASE_FOOTER_PATH = new URL(
  "../src/components/ghostwriter/case-study/Footer.tsx",
  import.meta.url,
);
const CASE_TOPBAR_PATH = new URL(
  "../src/components/ghostwriter/case-study/TopBar.tsx",
  import.meta.url,
);
const AGENTS_PATH = new URL("../AGENTS.md", import.meta.url);
const SCROLL_SKILL_PATH = new URL("../skills/ghostwriter-scroll-integrity/SKILL.md", import.meta.url);
const GITHUB_SECURITY_WORKFLOW_PATH = new URL("../.github/workflows/security.yml", import.meta.url);

test("imports the ghostwriter overflow guard stylesheet", () => {
  const layout = readFileSync(LAYOUT_PATH, "utf8");

  assert.match(layout, /import "\.\/ghostwriter-overflow-guard\.css";/);
});

test("ghostwriter global font import includes the required local font families", () => {
  const globals = readFileSync(GLOBALS_PATH, "utf8");
  const layout = readFileSync(LAYOUT_PATH, "utf8");

  assert.match(globals, /--font-sans:\s*var\(--font-inter\)/);
  assert.match(globals, /--font-serif:\s*var\(--font-source-serif\)/);
  assert.match(globals, /--color-background:\s*var\(--background\)/);
  assert.match(globals, /--color-card:\s*var\(--card\)/);
  assert.match(globals, /--success:\s*oklch\(0\.75 0\.18 145\)/);
  assert.match(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /Instrument_Serif/);
  assert.match(layout, /Source_Serif_4/);
  assert.match(layout, /JetBrains_Mono/);
  assert.match(layout, /preload:\s*false/);
  assert.match(layout, /sourceSerif\.variable/);
  assert.doesNotMatch(layout, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test("public UI surfaces use the Second Voice AI product name", () => {
  const layout = readFileSync(LAYOUT_PATH, "utf8");
  const route = readFileSync(ROUTE_PATH, "utf8");
  const caseRoute = readFileSync(CASE_STUDY_ROUTE_PATH, "utf8");
  const topBar = readFileSync(CASE_STUDY_TOP_BAR_PATH, "utf8");
  const footer = readFileSync(CASE_STUDY_FOOTER_PATH, "utf8");
  const caseHero = readFileSync(CASE_STUDY_HERO_PATH, "utf8");
  const pullQuote = readFileSync(CASE_STUDY_PULL_QUOTE_PATH, "utf8");
  const closingNotes = readFileSync(CASE_STUDY_CLOSING_NOTES_PATH, "utf8");
  const whyStack = readFileSync(CASE_STUDY_WHY_STACK_PATH, "utf8");
  const whatChanged = readFileSync(CASE_STUDY_WHAT_CHANGED_PATH, "utf8");
  const sharePage = readFileSync(SHARE_PAGE_PATH, "utf8");
  const shareNotFound = readFileSync(SHARE_NOT_FOUND_PATH, "utf8");
  const ogRoute = readFileSync(OG_ROUTE_PATH, "utf8");
  const legacyRoute = readFileSync(LEGACY_ROUTE_PATH, "utf8");
  const legacyCaseRoute = readFileSync(LEGACY_CASE_STUDY_ROUTE_PATH, "utf8");

  assert.match(layout, /title: "Second Voice AI"/);
  assert.match(route, /title: "Second Voice AI — Rewrite anything with a great author"/);
  assert.match(route, /title: "Second Voice AI"/);
  assert.match(caseRoute, /Second Voice AI Case Study/);
  assert.match(topBar, /Back to Second Voice AI/);
  assert.match(footer, /SecondVoiceMark/);
  assert.match(footer, /Open Second Voice AI/);
  assert.match(caseHero, /I have built the Second Voice To See How Much One Sentence Could Change/);
  assert.match(caseHero, /An experiment in personal AI writing · author lens · mood-specific rewrites/);
  assert.match(pullQuote, /Why this exists/);
  assert.match(pullQuote, /Most AI writing apps talk in workflows/);
  assert.match(whatChanged, /What changed while building it/);
  assert.match(closingNotes, /What I would do next/);
  assert.match(closingNotes, /Open Second Voice AI/);
  assert.match(whyStack, /The stack serves the feeling/);
  assert.match(whyStack, /Groq-powered AI layer/);
  assert.match(sharePage, /Second Voice AI/);
  assert.match(shareNotFound, /Second Voice AI permalink/);
  assert.match(ogRoute, /SECOND VOICE AI/);
  assert.match(legacyRoute, /permanentRedirect\("\/second-voice"\)/);
  assert.match(legacyCaseRoute, /permanentRedirect\("\/second-voice\/case-study"\)/);
});

test("Second Voice AI keeps canonical second-voice URLs while legacy ghostwriter URLs redirect safely", () => {
  const home = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const page = readFileSync(PAGE_PATH, "utf8");
  const topBar = readFileSync(CASE_STUDY_TOP_BAR_PATH, "utf8");
  const footer = readFileSync(CASE_STUDY_FOOTER_PATH, "utf8");
  const closingNotes = readFileSync(CASE_STUDY_CLOSING_NOTES_PATH, "utf8");
  const sharePage = readFileSync(SHARE_PAGE_PATH, "utf8");
  const shareNotFound = readFileSync(SHARE_NOT_FOUND_PATH, "utf8");
  const ogRoute = readFileSync(OG_ROUTE_PATH, "utf8");
  const proxy = readFileSync(PROXY_PATH, "utf8");

  assert.match(home, /permanentRedirect\("\/second-voice"\)/);
  assert.match(page, /refreshGhostwriterShieldSession/);
  assert.match(page, /href="\/second-voice\/case-study"/);
  assert.match(topBar, /href="\/second-voice"/);
  assert.match(footer, /href="\/second-voice"/);
  assert.match(closingNotes, /href="\/second-voice"/);
  assert.match(sharePage, /href="\/second-voice"/);
  assert.match(sharePage, /href="\/second-voice\/case-study"/);
  assert.match(shareNotFound, /href="\/second-voice"/);
  assert.match(shareNotFound, /href="\/second-voice\/case-study"/);
  assert.match(ogRoute, /→ \/second-voice/);
  assert.match(proxy, /pathname === "\/second-voice"/);
  assert.doesNotMatch(proxy, /pathname\.startsWith\("\/second-voice\/"\)/);
  assert.doesNotMatch(proxy, /pathname === "\/ghostwriter"/);
  assert.doesNotMatch(proxy, /pathname\.startsWith\("\/ghostwriter\/"\)/);
  assert.match(proxy, /pathname\.startsWith\("\/g\/"\)/);
});

test("hero image optimization prefers modern transparent formats", () => {
  const nextConfig = readFileSync(NEXT_CONFIG_PATH, "utf8");

  assert.match(nextConfig, /images:\s*\{[\s\S]*formats:\s*\[\s*"image\/avif",\s*"image\/webp"\s*\]/);
});

test("guard stylesheet enforces horizontal overflow protection", () => {
  const guard = readFileSync(GUARD_PATH, "utf8");
  const nextConfig = readFileSync(NEXT_CONFIG_PATH, "utf8");

  assert.match(guard, /white bottom-left scrollbar\/thumb artifact/);
  assert.match(nextConfig, /devIndicators:\s*false/);
  assert.match(guard, /html,\s*body\s*\{/);
  assert.match(guard, /overflow-x:\s*clip;/);
  assert.match(guard, /\.ghostwriter\s*\{/);
  assert.match(guard, /max-width:\s*100vw;/);
  assert.doesNotMatch(guard, /scrollbar-width:\s*none;/);
  assert.match(guard, /::-webkit-scrollbar:horizontal/);
  assert.match(guard, /\*::-webkit-scrollbar:horizontal/);
  assert.match(guard, /::-webkit-scrollbar-thumb:horizontal/);
  assert.match(guard, /\*::-webkit-scrollbar-thumb:horizontal/);
  assert.match(guard, /::-webkit-scrollbar-track:horizontal/);
  assert.match(guard, /::-webkit-scrollbar-track-piece:horizontal/);
  assert.match(guard, /::-webkit-scrollbar-button:horizontal/);
  assert.match(guard, /::-webkit-scrollbar-corner/);
  assert.match(guard, /body > \*::-webkit-scrollbar:horizontal/);
  assert.match(guard, /body > div::-webkit-scrollbar:horizontal/);
  assert.match(guard, /\.ghostwriter \.gw-overflow-guard::-webkit-scrollbar:horizontal/);
  assert.match(guard, /::-webkit-scrollbar:horizontal[\s\S]*display:\s*none !important;[\s\S]*width:\s*0 !important;[\s\S]*height:\s*0 !important;/);
  assert.match(guard, /::-webkit-scrollbar-thumb:horizontal[\s\S]*display:\s*none !important;[\s\S]*background:\s*transparent !important;[\s\S]*box-shadow:\s*none !important;/);
  assert.match(guard, /body > \* \{/);
  assert.match(guard, /body > \* \{[\s\S]*overflow-x:\s*clip;/);
  assert.match(guard, /body > div,\s*body > \[data-nextjs-scroll-focus-boundary\] \{[\s\S]*overflow-x:\s*clip;/);
  assert.match(guard, /\.ghostwriter \.gw-overflow-guard \{[\s\S]*overflow-x:\s*clip;/);
  assert.match(guard, /\.ghostwriter \.gw-overflow-grid > \* \{/);
  assert.match(guard, /overscroll-behavior-x:\s*none;/);
});

test("page shells use clip instead of hidden horizontal overflow", () => {
  const files = [
    readFileSync(GLOBALS_PATH, "utf8"),
    readFileSync(GUARD_PATH, "utf8"),
    readFileSync(PAGE_PATH, "utf8"),
    readFileSync(SHARE_PAGE_PATH, "utf8"),
    readFileSync(SHARE_NOT_FOUND_PATH, "utf8"),
    readFileSync(CASE_STUDY_PATH, "utf8"),
  ];

  for (const file of files) {
    assert.doesNotMatch(file, /overflow-x-hidden/);
    assert.doesNotMatch(file, /overflow-x:\s*hidden;/);
  }
});

test("ghostwriter page follows the designer handoff hero structure", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const heroArtwork = readFileSync(HERO_ART_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(page, /ghostwriter gw-overflow-guard relative min-h-dvh overflow-x-clip/);
  assert.doesNotMatch(page, /SecondVoiceMark|second-voice-main-mark/);
  assert.match(page, /<section className="hero" data-headline-length=\{headlineNeedsAuthorWrap \? "long" : "short"\}>/);
  assert.match(page, /data-headline-length=\{headlineNeedsAuthorWrap \? "long" : "short"\}/);
  assert.match(page, /<div className="hero-text">/);
  assert.match(page, /<HeroArtwork \/>/);
  assert.match(page, /hero-headline max-w-\[min\(100%,24ch\)\]/);
  assert.match(page, /text-\[clamp\(2\.65rem,13vw,6\.15rem\)\]/);
  assert.match(page, /lg:text-\[clamp\(3rem,6\.8vw,6\.35rem\)\]/);
  assert.match(page, /<span className="hero-rewrite-line">Rewrite<\/span>/);
  assert.match(page, /const DEFAULT_AUTHOR_ID: AuthorId = "tolkien";/);
  assert.match(page, /const \[activeId, setActiveId\] = useState<AuthorId>\(DEFAULT_AUTHOR_ID\);/);
  assert.match(page, /const headlineNeedsAuthorWrap = active\.cardTitle\.length >= 7;/);
  assert.match(page, /lg:max-w-\[15ch\]/);
  assert.match(page, /lg:max-w-\[13\.8ch\] lg:text-\[clamp\(3rem,5\.8vw,5\.2rem\)\]/);
  assert.match(page, /<span className="hero-anything-line whitespace-nowrap">anything with<\/span>/);
  assert.match(page, /<span className="hero-author-line">/);
  assert.match(page, /<span className="gw-voice-text italic font-normal">/);
  assert.match(page, /\{active\.cardTitle\}/);
  assert.match(page, /<span className="hero-author-tail">as author\.<\/span>/);
  assert.doesNotMatch(page, /a second voice\.|Choose an author first\.|Choose an author/);
  assert.match(page, /className="hero-copy mt-7 max-w-\[38rem\] text-\[0\.99rem\] leading-\[1\.62\] text-\[var\(--mist\)\] sm:mt-8 sm:text-\[1\.02rem\] lg:max-w-\[29rem\] lg:text-\[1rem\]"/);
  assert.match(page, /className="hero-actions mt-6 flex flex-wrap items-center gap-3"/);
  assert.match(page, /onClick=\{handleSurpriseMe\}/);
  assert.match(page, /gw-primary-cta gw-hero-primary-cta/);
  assert.match(page, /disabled=\{loading\}/);
  assert.match(page, /LoaderCircle/);
  assert.match(page, /\{loading \? "Rewriting\.\.\." : "Surprise me"\}/);
  assert.match(page, /const studioRef = useRef<HTMLElement>\(null\);/);
  assert.match(page, /function scrollToRewriteStudio\(\)/);
  assert.match(page, /window\.requestAnimationFrame/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(page, /studio\.scrollIntoView\(\{/);
  assert.match(page, /scrollToRewriteStudio\(\);/);
  assert.match(page, /id="ghostwriter-studio"[\s\S]*ref=\{studioRef\}/);
  assert.match(page, /Read the case study/);
  assert.doesNotMatch(page, /style=\{\{/);
  assert.match(heroArtwork, /getImageProps/);
  assert.match(heroArtwork, /ghostwriter-hero-desktop-edge-clean\.png/);
  assert.match(heroArtwork, /ghostwriter-hero-medium-edge-clean\.png/);
  assert.match(heroArtwork, /ghostwriter-hero-small-edge-clean\.png/);
  assert.doesNotMatch(heroArtwork, /\?v=/);
  assert.match(heroArtwork, /<source media="\(min-width: 1280px\)" srcSet=\{desktopSrcSet\} \/>/);
  assert.match(heroArtwork, /<source media="\(min-width: 1024px\)" srcSet=\{mediumSrcSet\} \/>/);
  assert.match(heroArtwork, /<source media="\(max-width: 1023px\)" srcSet=\{smallSrcSet\} \/>/);
  assert.match(heroArtwork, /<picture className=\{wrapperClassName\}>/);
  assert.match(heroArtwork, /className="hero-character-image"/);
  assert.doesNotMatch(heroArtwork, /hero-character-state/);
  const heroBlock = globals.match(/\.ghostwriter \.hero \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(heroBlock, /min-height: 90vh;/);
  assert.match(heroBlock, /overflow-x: clip;/);
  assert.match(heroBlock, /overflow-y: visible;/);
  assert.doesNotMatch(heroBlock, /overflow: hidden;/);
  assert.doesNotMatch(globals, /second-voice-main-mark/);
  assert.match(globals, /\.ghostwriter \.hero-text \{[\s\S]*z-index: 2;/);
  assert.match(globals, /\.ghostwriter \.hero-headline \{[\s\S]*text-wrap: balance;/);
  assert.match(globals, /\.ghostwriter \.hero-rewrite-line,[\s\S]*\.ghostwriter \.hero-anything-line,[\s\S]*\.ghostwriter \.hero-author-line \{[\s\S]*display: inline;/);
  assert.match(globals, /\.ghostwriter \.hero-anything-line \{[\s\S]*max-width: 100%;/);
  assert.match(globals, /\.ghostwriter \.hero-author-line \{[\s\S]*text-wrap: balance;/);
  assert.match(globals, /\.ghostwriter \.hero-author-tail \{[\s\S]*display: inline-block;[\s\S]*white-space: nowrap;/);
  assert.match(globals, /\.ghostwriter \.hero-actions \{[\s\S]*justify-content: center;/);
  assert.match(globals, /@media \(min-width: 1024px\) \{[\s\S]*\.ghostwriter \.hero-rewrite-line,[\s\S]*\.ghostwriter \.hero-anything-line,[\s\S]*\.ghostwriter \.hero-author-line \{[\s\S]*display: block;/);
  assert.match(globals, /@media \(min-width: 1024px\) \{[\s\S]*\.ghostwriter \.hero-actions \{[\s\S]*justify-content: flex-start;/);
  assert.match(globals, /\.ghostwriter \.hero-character \{[\s\S]*top: 49%;[\s\S]*right: 0;[\s\S]*width: min\(44vw, 760px\);[\s\S]*height: auto;[\s\S]*transform: translateY\(-50%\);[\s\S]*z-index: 1;[\s\S]*pointer-events: none;/);
  assert.match(globals, /\.ghostwriter \.hero-character-image \{[\s\S]*width: 100%;[\s\S]*height: auto;[\s\S]*max-width: 100%;/);
  assert.doesNotMatch(globals, /hero-character-state/);
  assert.doesNotMatch(globals, /will-change:\s*opacity,\s*transform;/);
  assert.match(globals, /@media \(min-width: 1024px\) and \(max-width: 1279px\) \{[\s\S]*width: min\(52vw, 620px\);[\s\S]*\.ghostwriter \.hero-copy \{[\s\S]*max-width: 22rem;/);
  assert.match(globals, /@media \(min-width: 1024px\) and \(max-width: 1279px\) \{[\s\S]*top: 49%;[\s\S]*right: 2%;[\s\S]*width: clamp\(400px, 44vw, 560px\);[\s\S]*transform: translateY\(-50%\);/);
  assert.match(globals, /\.ghostwriter \.hero\[data-headline-length="long"\] \.hero-character \{[\s\S]*top: 46%;[\s\S]*right: 1%;[\s\S]*width: clamp\(400px, 44vw, 560px\);/);
  assert.match(globals, /@media \(max-width: 1023px\) \{[\s\S]*flex-direction: column;[\s\S]*align-items: stretch;[\s\S]*text-align: center;[\s\S]*\.ghostwriter \.hero-headline \{[\s\S]*width: min\(100%, 24ch\);[\s\S]*\.ghostwriter \.hero-copy \{[\s\S]*width: min\(100%, 42rem\);[\s\S]*width: clamp\(260px, 68vw, 460px\);[\s\S]*height: auto;[\s\S]*margin-top: clamp\(30px, 5\.5vw, 48px\);/);
  assert.match(globals, /@media \(max-width: 1023px\) \{[\s\S]*\.ghostwriter \.hero-character-image \{[\s\S]*width: 100%;[\s\S]*height: auto;[\s\S]*max-width: 100%;/);
});

test("main app includes an accessible How It Works drawer", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const drawer = readFileSync(HOW_IT_WORKS_DRAWER_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(page, /const HowItWorksDrawer = dynamic\(/);
  assert.match(page, /import\("@\/components\/ghostwriter\/HowItWorksDrawer"\)/);
  assert.match(page, /loading: \(\) => null/);
  assert.match(page, /const \[howItWorksOpen, setHowItWorksOpen\] = useState\(false\);/);
  assert.match(page, /aria-haspopup="dialog"/);
  assert.match(page, /aria-expanded=\{howItWorksOpen\}/);
  assert.match(page, /aria-controls="gw-how-drawer"/);
  assert.match(page, /How it works/);
  assert.match(page, /Read the case study/);
  assert.match(page, /<HowItWorksDrawer[\s\S]*open=\{howItWorksOpen\}[\s\S]*onClose=\{\(\) => setHowItWorksOpen\(false\)\}[\s\S]*returnFocusRef=\{howItWorksTriggerRef\}[\s\S]*\/>/);

  assert.match(drawer, /const HOW_TO_USE_STEPS/);
  assert.match(drawer, /id: "write"/);
  assert.match(drawer, /title: "Write one thing"/);
  assert.match(drawer, /title: "Choose the feeling"/);
  assert.match(drawer, /title: "Press rewrite"/);
  assert.match(drawer, /Start here/);
  assert.match(drawer, /How to use Second Voice/);
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-modal="true"/);
  assert.match(drawer, /aria-labelledby="gw-how-title"/);
  assert.match(drawer, /aria-describedby="gw-how-intro"/);
  assert.match(drawer, /window\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(drawer, /event\.key === "Escape"/);
  assert.match(drawer, /event\.key !== "Tab"/);
  assert.match(drawer, /document\.body\.style\.overflow = "hidden";/);
  assert.match(drawer, /previousFocusRef\.current\.focus/);
  assert.match(drawer, /useReducedMotion/);
  assert.match(drawer, /useMediaQuery\("\(max-width: 767px\)"\)/);
  assert.match(drawer, /href="\/second-voice\/case-study"/);

  assert.match(globals, /\.ghostwriter \.gw-how-backdrop \{/);
  assert.match(
    globals,
    /\.ghostwriter \.gw-how-drawer-wrap \{[\s\S]*position: fixed;[\s\S]*overflow-x: clip;/,
  );
  assert.match(
    globals,
    /\.ghostwriter \.gw-how-drawer \{[\s\S]*width: min\(430px, calc\(100vw - 2rem\)\);[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/,
  );
  assert.match(globals, /\.ghostwriter \.gw-how-step \{/);
  assert.match(globals, /\.ghostwriter \.gw-how-footer \{/);
  assert.match(
    globals,
    /@media \(max-width: 767px\) \{[\s\S]*\.ghostwriter \.gw-how-drawer-wrap \{[\s\S]*align-items: flex-end;[\s\S]*\.ghostwriter \.gw-how-drawer \{[\s\S]*max-height: min\(88dvh,/,
  );
});

test("ghostwriter page renders the four-card writer selector from the mockup", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const orbital = readFileSync(ORBITAL_PATH, "utf8");
  const outcomeOptions = readFileSync(OUTCOME_OPTIONS_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");
  const authorCardBlock =
    globals.match(/\.ghostwriter \.gw-author-card \{[\s\S]*?\n\}/)?.[0] ?? "";
  const selectedAuthorCardBlock =
    globals.match(/\.ghostwriter \.gw-author-card\[data-selected="true"\] \{[\s\S]*?\n\}/)?.[0] ?? "";
  const voiceConsoleBlock =
    globals.match(/\.ghostwriter \.gw-voice-console \{[\s\S]*?\n\}/)?.[0] ?? "";
  const voiceHeaderBlock =
    globals.match(/\.ghostwriter \.gw-voice-console-header \{[\s\S]*?\n\}/)?.[0] ?? "";
  const voiceTitleBlock =
    globals.match(/\.ghostwriter \.gw-voice-title \{[\s\S]*?\n\}/)?.[0] ?? "";
  const voiceInstructionBlock =
    globals.match(/\.ghostwriter \.gw-voice-instruction \{[\s\S]*?\n\}/)?.[0] ?? "";
  const voiceDividerBlock =
    globals.match(/\.ghostwriter \.gw-voice-divider \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(page, /<section className="gw-voice-console" aria-labelledby="gw-voice-title">/);
  assert.match(page, /<p className="gw-voice-kicker">Rewrite controls<\/p>/);
  assert.match(page, /<h2 id="gw-voice-title" className="gw-voice-title">/);
  assert.match(page, /Choose a writer/);
  assert.match(page, /Choose an outcome/);
  assert.doesNotMatch(page, /ArrowDown|gw-voice-arrow|gw-voice-cue|&darr;/);
  assert.doesNotMatch(page, /gw-voice-cue-line|gw-voice-cue-dot/);
  assert.match(page, /Pick one of the cards\. Then tune the mood\./);
  assert.match(page, /Pick what the rewrite should accomplish\./);
  assert.match(page, /className="gw-mode-toggle"/);
  assert.match(page, /<button[\s\S]*>\s*Authors\s*<\/button>/);
  assert.match(page, /<button[\s\S]*>\s*Outcomes\s*<\/button>/);
  assert.match(page, /<AuthorOrbital active=\{active\.id\} disabled=\{loading\} onSelect=\{setActiveId\} \/>/);
  assert.match(page, /<OutcomeOptions/);
  assert.match(outcomeOptions, /options\.map\(\(option\) =>/);
  assert.match(outcomeOptions, /className="gw-outcome-card"/);
  assert.match(page, /<div className="gw-voice-divider" aria-hidden \/>/);
  assert.doesNotMatch(page, /<section className="pb-8">|<section className="mt-4">/);
  assert.match(orbital, /<div className="gw-author-grid grid w-full grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">/);
  assert.match(orbital, /grid w-full grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4/);
  assert.match(orbital, /min-h-\[220px\]/);
  assert.match(orbital, /gw-author-meta mb-6 flex items-start justify-between/);
  assert.match(orbital, /Selected/);
  assert.match(orbital, /Author/);
  assert.match(orbital, /Choose \$\{author\.name\}/);
  assert.match(orbital, /data-author=\{author\.id\}/);
  assert.match(orbital, /data-selected=\{isSelected\}/);
  assert.doesNotMatch(orbital, /style=\{\{|data-tint|gw-author-card-sheen|gw-author-card-outline|\[container-type:inline-size\]/);
  assert.match(globals, /--author-tolkien: 212 75% 80%;/);
  assert.match(globals, /--author-king: 258 65% 82%;/);
  assert.match(globals, /--author-tolstoy: 78 55% 80%;/);
  assert.match(globals, /--author-hemingway: 18 75% 82%;/);
  assert.match(authorCardBlock, /background: hsl\(var\(--author-card\)\);/);
  assert.match(authorCardBlock, /container-type: inline-size;/);
  assert.match(authorCardBlock, /min-width: 0;/);
  assert.match(authorCardBlock, /border-color: var\(--gw-frame-border-strong\);/);
  assert.match(authorCardBlock, /border-radius: 12px;/);
  assert.match(globals, /\.ghostwriter \.gw-author-title \{[\s\S]*font-size: clamp\(2\.05rem, 12cqi, 3\.05rem\);[\s\S]*overflow-wrap: anywhere;/);
  assert.match(globals, /@media \(max-width: 1023px\) \{[\s\S]*\.ghostwriter \.hero-anything-line \{[\s\S]*white-space: normal;/);
  assert.match(globals, /\.ghostwriter \.gw-author-grid \{[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(globals, /@media \(max-width: 767px\) \{[\s\S]*\.ghostwriter \.gw-author-grid \{[\s\S]*width: 100%;[\s\S]*max-width: 100%;[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*\.ghostwriter \.gw-author-card \{[\s\S]*aspect-ratio: auto;[\s\S]*min-height: clamp\(9\.5rem, 28vw, 12\.25rem\);[\s\S]*\.ghostwriter \.gw-author-title \{[\s\S]*font-size: clamp\(1\.28rem, 12\.5cqi, 1\.72rem\);[\s\S]*\.ghostwriter \.gw-author-description \{[\s\S]*display: none;/);
  assert.match(voiceConsoleBlock, /padding: 0;/);
  assert.match(voiceConsoleBlock, /overflow-x: clip;/);
  assert.match(voiceConsoleBlock, /border: 0;/);
  assert.match(voiceConsoleBlock, /background: transparent;/);
  assert.match(voiceConsoleBlock, /box-shadow: none;/);
  assert.doesNotMatch(voiceConsoleBlock, /border-radius:/);
  assert.match(voiceHeaderBlock, /grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(voiceHeaderBlock, /width: 100%;/);
  assert.match(voiceHeaderBlock, /max-width: 100%;/);
  assert.match(voiceHeaderBlock, /margin-bottom: clamp\(1rem, 2vw, 1\.35rem\);/);
  assert.match(voiceHeaderBlock, /display: grid;/);
  assert.match(voiceTitleBlock, /display: block;/);
  assert.match(voiceTitleBlock, /font-size: clamp\(2\.35rem, 5\.1vw, 4\.65rem\);/);
  assert.match(voiceTitleBlock, /letter-spacing: 0;/);
  assert.match(voiceInstructionBlock, /display: flex;/);
  assert.match(voiceInstructionBlock, /max-width: min\(100%, 28rem\);/);
  assert.match(voiceInstructionBlock, /margin: clamp\(0\.62rem, 1\.1vw, 0\.82rem\) 0 0;/);
  assert.match(globals, /\.ghostwriter \.gw-voice-instruction::before \{[\s\S]*width: clamp\(1\.4rem, 2\.2vw, 2\.2rem\);/);
  assert.match(globals, /\.ghostwriter \.gw-mode-toggle \{[\s\S]*grid-template-columns: repeat\(2, max-content\);/);
  assert.match(globals, /\.ghostwriter \.gw-mode-toggle \{[\s\S]*width: max-content;/);
  assert.match(globals, /\.ghostwriter \.gw-mode-toggle \{[\s\S]*min-width: 0;/);
  assert.doesNotMatch(globals, /\.ghostwriter \.gw-mode-toggle \{[\s\S]*min-width: min\(100%, 14rem\);/);
  assert.doesNotMatch(globals, /\.ghostwriter \.gw-mode-toggle \{[\s\S]*width: min\(100%, 18rem\);/);
  assert.match(globals, /\.ghostwriter \.gw-mode-toggle-button\[data-selected="true"\] \{[\s\S]*background: var\(--gw-author-cta-color\);/);
  assert.match(globals, /\.ghostwriter \.gw-outcome-grid \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
  assert.match(globals, /\.ghostwriter \.gw-outcome-card \{[\s\S]*min-height: 10\.5rem;/);
  assert.match(globals, /\.ghostwriter \.gw-outcome-card\[data-selected="true"\] \{[\s\S]*background: var\(--gw-author-cta-color\);/);
  assert.match(globals, /@media \(max-width: 1023px\) \{[\s\S]*\.ghostwriter \.gw-outcome-grid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(voiceDividerBlock, /width: min\(54rem, 64%\);/);
  assert.match(voiceDividerBlock, /height: 1px;/);
  assert.match(
    voiceDividerBlock,
    /margin: clamp\(0\.8rem, 1\.7vw, 1\.2rem\) auto clamp\(0\.72rem, 1\.35vw, 1rem\) 0;/,
  );
  assert.match(selectedAuthorCardBlock, /border-color: transparent;/);
  assert.match(selectedAuthorCardBlock, /color: hsl\(var\(--author-ink\)\);/);
  assert.match(globals, /\.ghostwriter \.gw-author-card\[data-selected="true"\]\[data-author="stephenking"\] \{[\s\S]*background: hsl\(var\(--author-king\)\);/);
  assert.doesNotMatch(globals, /gw-author-card-sheen|gw-author-card-outline|--gw-card-panel|--gw-card-highlight|--gw-card-edge/);
});

test("ghostwriter composer auto-expands instead of trapping page scroll", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const playback = readFileSync(REWRITE_PLAYBACK_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(page, /const composerRef = useRef<HTMLTextAreaElement>\(null\);/);
  assert.match(page, /resizeComposer\(composerRef\.current\);/);
  assert.match(page, /<div className="gw-input-panel mt-5">/);
  assert.match(page, /<label htmlFor="second-voice-input" className="gw-input-label">/);
  assert.match(page, /Write or paste here/);
  assert.match(page, /id="second-voice-input"/);
  assert.match(page, /ref=\{composerRef\}/);
  assert.match(page, /className="gw-input-textarea min-h-\[240px\] w-full resize-none overflow-hidden/);
  assert.match(globals, /--card-bg-strong: rgba\(244, 237, 225, 0\.062\);/);
  assert.match(globals, /\.gw-card \{[\s\S]*border-radius: 12px;/);
  assert.match(globals, /--gw-frame-border: rgba\(244, 237, 225, 0\.09\);/);
  assert.match(globals, /--gw-control-border: rgba\(244, 237, 225, 0\.17\);/);
  assert.match(globals, /\.gw-card-strong \{[\s\S]*border: 1px solid var\(--gw-frame-border\);[\s\S]*border-radius: 12px;/);
  assert.match(globals, /\.gw-input-panel \{[\s\S]*overflow: clip;[\s\S]*border: 1px solid var\(--gw-frame-border-strong\);[\s\S]*border-radius: 12px;/);
  assert.match(globals, /\.gw-input-panel:focus-within \{[\s\S]*border-color: var\(--gw-focus-ring\);/);
  assert.match(globals, /\.gw-input-label \{[\s\S]*border-bottom: 1px solid var\(--gw-frame-border\);/);
  assert.match(globals, /\.gw-input-textarea \{[\s\S]*background: transparent;/);
  assert.match(playback, /The rewrite appears here after you run it\./);
  assert.match(playback, /AlertCircle/);
  assert.match(playback, /Copy/);
  assert.match(playback, /FlaskConical/);
  assert.match(playback, /Share2/);
  assert.match(playback, /ShieldCheck/);
  assert.match(playback, /async function writeClipboardText\(text: string\)/);
  assert.match(playback, /className="gw-playback-panel relative mt-5 min-h-\[15rem\] rounded-\[12px\][^"]*pr-14/);
  assert.match(playback, /className="gw-copy-result"/);
  assert.match(playback, /aria-label=\{copied \? "Rewrite copied" : "Copy rewrite"\}/);
  assert.match(playback, /gw-loading-panel/);
  assert.match(playback, /role="status"/);
  assert.match(playback, /gw-loading-status/);
  assert.match(playback, /gw-loading-spinner h-5 w-5 animate-spin/);
  assert.match(playback, /Rewriting with \$\{author\.first\}\.\.\./);
  assert.match(playback, /gw-loading-bars/);
  assert.match(page, /const REWRITE_CLIENT_TIMEOUT_MS = 35_000;/);
  assert.match(page, /GhostwriterRequestError/);
  assert.match(page, /requestIdFrom\(rewriteResponse\)/);
  const clientGuard = readFileSync(CLIENT_GUARD_PATH, "utf8");
  assert.match(clientGuard, /export function requestIdFrom\(response: Response\): string \| null/);
  assert.match(clientGuard, /response\.headers\.get\(GHOSTWRITER_REQUEST_ID_HEADER\)/);
  assert.match(page, /const \[lastAttempt, setLastAttempt\] = useState<RewriteAttempt \| null>\(null\);/);
  assert.match(page, /function retryLastRewrite\(\)/);
  assert.match(page, /onRetry=\{lastAttempt && !loading && features\.rewriteEnabled \? retryLastRewrite : undefined\}/);
  assert.match(playback, /errorRequestId\?: string \| null;/);
  assert.match(playback, /className="gw-error-panel"/);
  assert.match(playback, /role="alert"/);
  assert.match(playback, /Request ID \{errorRequestId\}/);
  assert.match(playback, /Try again/);
  assert.match(globals, /--gw-button-height-sm: 2\.25rem;/);
  assert.match(globals, /\.gw-copy-result \{[\s\S]*position: absolute;[\s\S]*right: 0\.82rem;[\s\S]*width: var\(--gw-button-height-sm\);[\s\S]*height: var\(--gw-button-height-sm\);/);
  assert.match(globals, /\.ghostwriter \.gw-playback-panel \{[\s\S]*border-color: var\(--gw-frame-border-strong\);[\s\S]*var\(--gw-surface-panel\);/);
  assert.match(globals, /\.ghostwriter \.gw-loading-status \{/);
  assert.match(globals, /\.ghostwriter \.gw-loading-bars span \{/);
  assert.match(globals, /\.ghostwriter \.gw-error-panel \{/);
  assert.match(globals, /\.ghostwriter \.gw-error-retry \{/);
  assert.match(globals, /animation: gw-loading-bar 1\.25s ease-in-out infinite;/);
  assert.match(globals, /@keyframes gw-loading-bar/);
  assert.match(playback, /rounded-\[12px\]/);
  assert.match(playback, /rounded-\[10px\]/);
  assert.doesNotMatch(`${page}\n${playback}\n${globals}`, /rounded-\[28px\]|border-radius: 18px;|border-radius: 16px;/);
});

test("Rewrite Lab is explicit, protected, and inspectable after playback", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const playback = readFileSync(REWRITE_PLAYBACK_PATH, "utf8");
  const panel = readFileSync(REWRITE_LAB_PANEL_PATH, "utf8");
  const scoreCard = readFileSync(REWRITE_LAB_SCORE_CARD_PATH, "utf8");
  const trace = readFileSync(REWRITE_LAB_TRACE_PATH, "utf8");
  const route = readFileSync(REWRITE_LAB_ROUTE_PATH, "utf8");
  const server = readFileSync(REWRITE_LAB_SERVER_PATH, "utf8");
  const shared = readFileSync(REWRITE_LAB_SHARED_PATH, "utf8");
  const abuseProtection = readFileSync(
    new URL("../src/server/abuse-protection.ts", import.meta.url),
    "utf8",
  );
  const caseEngineering = readFileSync(
    new URL("../src/components/ghostwriter/case-study/EngineeringChoices.tsx", import.meta.url),
    "utf8",
  );
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(page, /type RewriteRun = \{[\s\S]*provenance: RewritePlaybackProvenance \| null;/);
  assert.match(page, /artifactToken: string \| null;/);
  assert.match(page, /provenance: null,/);
  assert.match(page, /function applyLabWinner\(selection: RewriteLabWinnerSelection\)/);
  assert.match(page, /const nextRewrite = selection\.rewrite\.trim\(\);/);
  assert.match(page, /runId: previous\.runId \+ 1/);
  assert.match(page, /provenance: \{[\s\S]*label: selection\.label,[\s\S]*overall: selection\.overall,[\s\S]*reason: selection\.reason,[\s\S]*source: "rewrite-lab",/);
  assert.match(page, /features\.rewriteLabEnabled && displayedMode === "author" \? applyLabWinner : undefined/);
  assert.match(page, /provenance=\{latestRun\.provenance\}/);
  assert.match(playback, /const RewriteLabPanel = dynamic\(/);
  assert.match(playback, /import\("@\/components\/ghostwriter\/RewriteLabPanel"\)/);
  assert.match(playback, /loading: \(\) => null/);
  assert.match(playback, /import type \{ RewriteLabWinnerSelection \}/);
  assert.match(playback, /export type RewritePlaybackProvenance = \{[\s\S]*source: "rewrite-lab";/);
  assert.match(playback, /const \[labRunId, setLabRunId\] = useState<number \| null>\(null\);/);
  assert.match(playback, /const visiblePhase: RewritePlaybackPhase = error \? "error" : loading \? "requesting" : phase;/);
  assert.match(playback, /const canOpenLab =[\s\S]*mode === "author" && visiblePhase === "complete"/);
  assert.match(playback, /onApplyRewrite\?: \(selection: RewriteLabWinnerSelection\) => void;/);
  assert.match(playback, /provenance\?: RewritePlaybackProvenance \| null;/);
  assert.match(playback, /function useLabRewrite\(selection: RewriteLabWinnerSelection\)/);
  assert.match(playback, /setLabRunId\(null\);/);
  assert.match(playback, /Rewrite Lab pick/);
  assert.match(playback, /className="gw-rewrite-provenance"/);
  assert.match(playback, /aria-label=\{`Rewrite Lab pick: \$\{provenance\.label\}, \$\{provenance\.overall\} overall`\}/);
  assert.match(playback, /className="gw-rewrite-provenance-reason"/);
  assert.match(playback, /aria-busy=\{loading\}/);
  assert.match(playback, /aria-live="polite"/);
  assert.match(playback, /visiblePhase === "requesting"/);
  assert.match(playback, /const labOpen = canOpenLab && labRunId === runId;/);
  assert.match(playback, /Open Rewrite Lab/);
  assert.match(playback, /Close Rewrite Lab/);
  assert.match(playback, /<RewriteLabPanel/);
  assert.match(playback, /open=\{labOpen\}/);
  assert.match(playback, /onUseWinner=\{onApplyRewrite \? useLabRewrite : undefined\}/);
  assert.doesNotMatch(playback, /\/api\/ghostwriter\/lab/);

  assert.match(panel, /const LAB_STAGES = \[/);
  assert.match(panel, /Generating three candidate rewrites/);
  assert.match(panel, /Scoring the candidates/);
  assert.match(panel, /Selecting the strongest version/);
  assert.match(panel, /Building the technical trace/);
  assert.match(panel, /const \[retryNonce, setRetryNonce\] = useState\(0\);/);
  assert.match(panel, /aria-busy=\{state\.status === "loading"\}/);
  assert.match(panel, /className="gw-lab-progress" data-stage=\{state\.stage\}/);
  assert.match(panel, /Step \{Math\.min\(state\.stage \+ 1, LAB_STAGES\.length\)\} of \{LAB_STAGES\.length\}/);
  assert.match(panel, /className="gw-lab-current-stage"/);
  assert.match(panel, /data-complete=\{index < state\.stage\}/);
  assert.match(panel, /Try Rewrite Lab again/);
  assert.match(panel, /setRetryNonce\(\(current\) => current \+ 1\)/);
  assert.match(panel, /RewriteLabWinnerSelection/);
  assert.match(panel, /onUseWinner\?: \(selection: RewriteLabWinnerSelection\) => void;/);
  assert.match(panel, /async function copyWinner\(\)/);
  assert.match(panel, /function useWinner\(\)/);
  assert.match(panel, /writeClipboardText\(winner\.rewrite\)/);
  assert.match(panel, /artifactToken: winner\.artifactToken,/);
  assert.match(panel, /label: winner\.label,/);
  assert.match(panel, /overall: winner\.scores\.overall,/);
  assert.match(panel, /reason: state\.status === "success" \? state\.lab\.selectionReason : "",/);
  assert.match(panel, /rewrite: winner\.rewrite,/);
  assert.match(panel, /Use this version/);
  assert.match(panel, /Copy winner/);
  assert.match(panel, /issueGhostwriterChallenge/);
  assert.match(panel, /readGhostwriterCsrfToken/);
  assert.match(panel, /fetch\("\/api\/ghostwriter\/lab"/);
  assert.match(panel, /RewriteLabScoreCard/);
  assert.match(panel, /RewriteLabTrace/);
  assert.match(panel, /Run a rewrite first\. Then the lab can generate alternatives/);
  assert.match(scoreCard, /Meaning/);
  assert.match(scoreCard, /Voice/);
  assert.match(scoreCard, /Clarity/);
  assert.match(scoreCard, /Spark/);
  assert.match(scoreCard, /Risk/);
  assert.match(trace, /Provider/);
  assert.match(trace, /Generator profile/);
  assert.match(trace, /Evaluator rubric/);
  assert.match(trace, /Schema/);
  assert.match(trace, /Fallback/);

  assert.match(route, /validateGhostwriterLabPost/);
  assert.match(route, /RewriteLabInputSchema\.extend/);
  assert.match(route, /runRewriteLab/);
  assert.match(route, /GHOSTWRITER_MAX_BODY_BYTES/);
  assert.match(route, /satisfies RewriteLabResponse/);
  assert.match(server, /Live multi-pass AI is intentionally unavailable/);
  assert.match(server, /closed-beta cost boundary is in force/);
  assert.doesNotMatch(server, /fetch\(|Promise\.allSettled|evaluateCandidates/);
  assert.match(shared, /REWRITE_LAB_CANDIDATE_IDS/);
  assert.match(shared, /artifactToken: string;/);
  assert.match(shared, /export type RewriteLabWinnerSelection = \{/);
  assert.match(shared, /overreachPenalty/);
  assert.match(shared, /calculateRewriteLabOverall/);
  assert.match(shared, /selectRewriteLabWinner/);
  assert.match(abuseProtection, /function buildLabRateRules/);
  assert.match(abuseProtection, /limit: 3,[\s\S]*windowMs: 10 \* 60 \* 1000/);
  assert.match(abuseProtection, /limit: 10,[\s\S]*windowMs: 60 \* 60 \* 1000/);
  assert.match(caseEngineering, /From single output to observable generation/);
  assert.match(caseEngineering, /parallel candidate generation, structured evaluation/);

  assert.match(globals, /\.gw-lab-open-button \{/);
  assert.match(globals, /\.ghostwriter \.gw-lab-panel \{[\s\S]*overflow-x: clip;/);
  assert.match(globals, /\.ghostwriter \.gw-lab-progress \{/);
  assert.match(globals, /\.ghostwriter \.gw-lab-progress-track \{[\s\S]*overflow: clip;/);
  assert.match(globals, /\.ghostwriter \.gw-lab-progress\[data-stage="3"\] \.gw-lab-progress-bar \{[\s\S]*width: 100%;/);
  assert.match(globals, /\.ghostwriter \.gw-lab-current-stage \{/);
  assert.match(globals, /\.ghostwriter \.gw-lab-stage-list \{/);
  assert.match(globals, /\.ghostwriter \.gw-lab-retry \{/);
  assert.match(globals, /\.ghostwriter \.gw-lab-winner-actions \{/);
  assert.match(globals, /\.ghostwriter \.gw-lab-action-primary,/);
  assert.match(globals, /\.ghostwriter \.gw-lab-action-secondary \{/);
  assert.match(globals, /\.ghostwriter \.gw-rewrite-provenance \{/);
  assert.match(globals, /\.ghostwriter \.gw-rewrite-provenance-reason \{/);
  assert.match(globals, /\.ghostwriter \.gw-lab-score-metrics \{[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/);
  assert.match(globals, /@media \(max-width: 640px\) \{[\s\S]*\.ghostwriter \.gw-lab-score-metrics \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("composer separates quick starts from the primary action row", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(page, /Quick starts/);
  assert.match(page, /<div className="gw-composer-actions">/);
  assert.match(page, /<div className="gw-composer-action-row">/);
  assert.match(page, /gw-primary-cta gw-composer-primary-cta/);
  assert.match(page, /className="gw-chip gw-surprise-cta"/);
  assert.match(page, /const rewriteCta =/);
  assert.match(page, /`Rewrite as \$\{active\.cardTitle\}`/);
  assert.match(page, /`Rewrite to \$\{activeOutcome\.label\.toLowerCase\(\)\}`/);
  assert.match(page, /\{loading \? "Rewriting\.\.\." : rewriteCta\}/);
  assert.match(page, /\{loading \? "Rewriting\.\.\." : "Surprise me"\}/);
  assert.match(page, /const userSource = input\.trim\(\);/);
  assert.match(page, /const source = userSource \|\| preset\.text;/);
  assert.match(page, /if \(!userSource\) \{[\s\S]*setInput\(preset\.text\);[\s\S]*\}/);
  assert.match(page, /text: source,/);
  assert.doesNotMatch(page, /setInput\(preset\.text\);\s*void handleRewrite/);
  assert.doesNotMatch(page, /className="gw-share-option"/);
  assert.doesNotMatch(page, /Create a public permalink/);
  assert.match(page, /shareCurrentRewrite/);
  assert.match(page, /share:\s*false/);
  assert.match(page, /shareConsent:\s*PUBLIC_REWRITE_SHARE_CONSENT/);
  assert.match(globals, /--gw-author-cta-color: hsl\(var\(--author-king\)\);/);
  assert.match(globals, /\.ghostwriter\[data-voice="stephenking"\],[\s\S]*--gw-author-cta-color: hsl\(var\(--author-king\)\);/);
  assert.match(globals, /\.gw-primary-cta \{[\s\S]*background: var\(--gw-author-cta-color\);/);
  assert.match(globals, /\.gw-primary-cta:disabled \{[\s\S]*background: var\(--gw-author-cta-color\) !important;/);
  assert.doesNotMatch(globals, /background: rgba\(228, 233, 239, 0\.82\) !important;/);
  assert.match(globals, /\.gw-composer-actions \{[\s\S]*margin-top: clamp\(2rem, 4vw, 3rem\);[\s\S]*padding-top: clamp\(1\.45rem, 2\.6vw, 2rem\);[\s\S]*border-top: 1px solid var\(--gw-frame-border\);/);
  assert.match(globals, /--gw-button-height-lg: 3rem;/);
  assert.match(globals, /--gw-button-radius: 12px;/);
  assert.match(globals, /\.gw-primary-cta \{[\s\S]*min-height: var\(--gw-button-height-lg\);[\s\S]*border-radius: var\(--gw-button-radius\);/);
  assert.match(globals, /\.gw-composer-primary-cta \{[\s\S]*min-width: min\(100%, 12\.5rem\);/);
  assert.match(globals, /\.gw-hero-primary-cta \{[\s\S]*min-width: min\(100%, 10\.75rem\);/);
  assert.match(globals, /\.gw-surprise-cta \{[\s\S]*min-height: var\(--gw-button-height-lg\);/);
});

test("visible rewrite share controls are explicit and privacy-scoped", () => {
  const playback = readFileSync(REWRITE_PLAYBACK_PATH, "utf8");
  const page = readFileSync(PAGE_PATH, "utf8");
  const route = readFileSync(ROUTE_PATH, "utf8");
  const feedbackPanel = readFileSync(REWRITE_FEEDBACK_PANEL_PATH, "utf8");
  const featureFlags = readFileSync(FEATURE_FLAGS_PATH, "utf8");
  const sharePage = readFileSync(SHARE_PAGE_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(route, /getGhostwriterFeatureAvailability/);
  assert.match(page, /features\.publicSharingEnabled \? shareCurrentRewrite : undefined/);
  assert.match(page, /features\.feedbackEnabled \? submitRewriteFeedback : undefined/);
  assert.match(page, /features\.rewriteEnabled/);
  assert.match(page, /gw-composer-status/);
  assert.match(featureFlags, /getSupabaseAdmin\(\)/);
  assert.match(featureFlags, /getSupabasePublic\(\)/);
  assert.match(featureFlags, /resolveAbuseStoreConfig/);
  assert.match(featureFlags, /resolveAiPolicyConfig\(\)/);
  assert.match(featureFlags, /rewriteLabEnabled: e2eFixtureMode/);
  assert.match(featureFlags, /publicSharingEnabled\(process\.env\.GHOSTWRITER_ALLOW_PUBLIC_SHARING\)/);
  assert.match(playback, /RewriteFeedbackPanel/);
  assert.match(feedbackPanel, /Did this edit land/);
  assert.match(feedbackPanel, /REWRITE_FEEDBACK_REASON_LABELS/);
  assert.match(playback, /Create public link/);
  assert.match(playback, /This will create a public permalink for the rewrite currently shown here/);
  assert.match(playback, /The original text stays hidden/);
  assert.match(playback, /Public link copied/);
  assert.match(globals, /\.ghostwriter \.gw-share-panel \{/);
  assert.match(globals, /\.ghostwriter \.gw-feedback-panel \{/);
  assert.match(globals, /\.ghostwriter \.gw-feedback-rating,/);
  assert.match(globals, /\.ghostwriter \.gw-share-primary,/);
  assert.match(globals, /\.ghostwriter \.gw-share-provenance \{/);
  assert.match(sharePage, /Rewrite Lab selected this version/);
  assert.match(sharePage, /Winning direction/);
  assert.match(sharePage, /Overall score/);
});

test("release gate covers lint, typecheck, security, scroll integrity, and E2E", () => {
  const packageJson = readFileSync(PACKAGE_PATH, "utf8");
  const workflow = readFileSync(GITHUB_SECURITY_WORKFLOW_PATH, "utf8");

  assert.match(
    packageJson,
    /"test:release:gate": "npm run lint && npx tsc --noEmit && npm run test:security && npm run test:scroll && npm run test:integration && npm run test:e2e"/,
  );
  assert.match(workflow, /npm run test:release:gate/);
  assert.match(workflow, /npm run security:check/);
  assert.match(workflow, /npm run build -- --webpack/);
  assert.match(workflow, /npm audit --audit-level=moderate/);
});

test("audited contrast fixes stay tokenized", () => {
  const globals = readFileSync(GLOBALS_PATH, "utf8");
  const page = readFileSync(PAGE_PATH, "utf8");
  const orbital = readFileSync(ORBITAL_PATH, "utf8");
  const moodDial = readFileSync(MOOD_DIAL_PATH, "utf8");
  const playback = readFileSync(REWRITE_PLAYBACK_PATH, "utf8");
  const sharePage = readFileSync(SHARE_PAGE_PATH, "utf8");
  const topBar = readFileSync(CASE_TOPBAR_PATH, "utf8");
  const closingNotes = readFileSync(CASE_STUDY_CLOSING_NOTES_PATH, "utf8");
  const uiSource = [globals, page, orbital, moodDial, playback, sharePage, topBar, closingNotes].join("\n");

  assert.match(globals, /--gw-frame-border: rgba\(244, 237, 225, 0\.09\);/);
  assert.match(globals, /--gw-frame-border-strong: rgba\(244, 237, 225, 0\.13\);/);
  assert.match(globals, /--gw-control-border: rgba\(244, 237, 225, 0\.17\);/);
  assert.match(globals, /--gw-control-border-hover: rgba\(244, 237, 225, 0\.25\);/);
  assert.match(globals, /--gw-focus-ring: hsl\(40 18% 92%\);/);
  assert.match(globals, /--gw-disabled-foreground: hsl\(40 8% 62%\);/);
  assert.match(globals, /--gw-deleted-foreground: hsl\(255 14% 72%\);/);
  assert.match(globals, /--status-dot: 0 0% 6%;/);
  assert.match(globals, /--cs-muted-foreground: 36 8% 62%;/);
  assert.match(globals, /--cs-border: 36 8% 42%;/);
  assert.match(globals, /--cs-hairline: 36 8% 38%;/);
  assert.match(globals, /--cs-selected: 220 7% 40%;/);
  assert.match(globals, /\.ghostwriter a\[href\]:focus-visible,/);
  assert.match(globals, /\.gw-case-study a:focus-visible,/);
  assert.match(globals, /\.ghostwriter \.gw-deleted-text\[data-cut="true"\] \{[\s\S]*color: var\(--gw-deleted-foreground\);[\s\S]*text-decoration-thickness: 2px;/);
  assert.match(globals, /\.ghostwriter \.gw-range:focus-visible::-webkit-slider-thumb \{[\s\S]*0 0 0 5px var\(--gw-focus-ring\)/);
  assert.match(closingNotes, /className="cs-closing-cta group inline-flex/);
  assert.match(globals, /\.gw-case-study \.cs-closing-cta \{[\s\S]*background: hsl\(var\(--cs-selected\)\);[\s\S]*color: hsl\(var\(--cs-selected-foreground\)\);/);
  assert.match(globals, /\.gw-case-study \.cs-closing-cta:hover \{[\s\S]*background: hsl\(var\(--cs-primary\)\);[\s\S]*color: hsl\(var\(--cs-primary-foreground\)\);/);
  assert.doesNotMatch(uiSource, /border-white\/(?:5|6|10)/);
  assert.doesNotMatch(uiSource, /disabled:opacity|opacity-70|opacity-60/);
  assert.doesNotMatch(uiSource, /color-mix\(in oklch, var\(--gw-voice-color\) (?:18|20)%, transparent\)/);
  assert.doesNotMatch(uiSource, /--cs-hairline: 36 8% 18%;|--cs-border: 36 8% 14%;|--cs-muted-foreground: 36 8% 58%;/);
  assert.doesNotMatch(uiSource, /hsl\(var\(--cs-primary\)\/0\.(?:08|11|16|45)\)/);
  assert.doesNotMatch(uiSource, /border(?:-color)?: 1px solid rgba\(244, 237, 225, 0\.(?:07|1|12|13|22)\)/);
});

test("mood dial range thumb stays centered in a polished track", () => {
  const moodDial = readFileSync(MOOD_DIAL_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(moodDial, /<div className="gw-mood-dock" data-voice=\{author \?\? undefined\}>/);
  assert.match(moodDial, /Tune the mood/);
  assert.match(moodDial, /drag and the rewrite leans with it/);
  assert.match(moodDial, /<div className="gw-range-control">/);
  assert.match(moodDial, /className="gw-range-progress"/);
  assert.match(moodDial, /aria-valuetext=\{author \? `\$\{value\}% \$\{moodLabel\}` : "Choose an author first"\}/);
  assert.doesNotMatch(moodDial, /gw-range h-2/);
  assert.match(globals, /\.ghostwriter \.gw-range-control \{[\s\S]*align-items: center;[\s\S]*height: 30px;/);
  assert.match(globals, /\.ghostwriter \.gw-range-progress \{[\s\S]*inset: 50% auto auto 0;[\s\S]*height: 6px;[\s\S]*transform: translateY\(-50%\);/);
  assert.match(globals, /\.ghostwriter \.gw-range \{[\s\S]*position: absolute;[\s\S]*height: 30px;[\s\S]*margin: 0;/);
  assert.match(globals, /\.ghostwriter \.gw-range::-webkit-slider-thumb \{[\s\S]*height: 18px;[\s\S]*width: 18px;[\s\S]*margin-top: -6px;[\s\S]*border: 2px solid rgba\(255, 255, 255, 0\.88\);/);
  assert.match(globals, /\.ghostwriter \.gw-range::-moz-range-thumb \{[\s\S]*height: 18px;[\s\S]*width: 18px;[\s\S]*border: 2px solid rgba\(255, 255, 255, 0\.88\);/);
  assert.doesNotMatch(globals, /height: 44px;|height: 14px;|height: 30px;[\s\S]*width: 30px;|0 0 0 8px rgba\(255, 255, 255, 0\.075\)|border: 5px solid/);
});

test("live rewrite mood status matches the designer emphasis", () => {
  const playback = readFileSync(REWRITE_PLAYBACK_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");

  assert.match(playback, /const moodStatus =[\s\S]*mode === "outcome"[\s\S]*\? `Outcome · \$\{outcomeLabel\}`/);
  assert.match(playback, /author[\s\S]*\? `\$\{mood\}% \$\{MOOD_NAME\[author\.id\]\} · \$\{moodLabel\}`/);
  assert.match(playback, /className="gw-rewrite-mood"/);
  assert.match(playback, /aria-label=\{moodStatus\}/);
  assert.match(globals, /\.ghostwriter \.gw-rewrite-mood \{[\s\S]*font-family: var\(--font-serif\);[\s\S]*letter-spacing: 0\.18em;[\s\S]*text-transform: uppercase;/);
  assert.match(globals, /\.ghostwriter \.gw-rewrite-mood \{[\s\S]*color: color-mix\(in oklch, var\(--gw-voice-color\) 72%, var\(--ghost\) 28%\);/);
});

test("case study keeps the product-scale editorial canvas", () => {
  const caseStudy = readFileSync(CASE_STUDY_PATH, "utf8");
  const topBar = readFileSync(CASE_STUDY_TOP_BAR_PATH, "utf8");
  const footer = readFileSync(CASE_STUDY_FOOTER_PATH, "utf8");
  const globals = readFileSync(GLOBALS_PATH, "utf8");
  const hero = readFileSync(
    new URL("../src/components/ghostwriter/case-study/Hero.tsx", import.meta.url),
    "utf8",
  );
  const caseStudyScopeBlock = globals.match(/\.gw-case-study \{[\s\S]*?\n\}/)?.[0] ?? "";
  const eyebrowBlock = globals.match(/\.gw-case-study \.cs-eyebrow \{[\s\S]*?\n\}/)?.[0] ?? "";
  const humanNoteBlock = globals.match(/\.gw-case-study \.cs-human-note \{[\s\S]*?\n\}/)?.[0] ?? "";
  const smallLabelBlock = globals.match(/\.gw-case-study \.cs-inline-label,[\s\S]*?\.gw-case-study \.cs-stack-index \{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(caseStudy, /max-w-\[1520px\]/);
  assert.match(caseStudy, /xl:px-14/);
  assert.match(caseStudy, /lg:gap-16/);
  assert.match(topBar, /max-w-\[1520px\]/);
  assert.match(topBar, /xl:px-14/);
  assert.doesNotMatch(topBar, /Maker&apos;s note/);
  assert.match(footer, /max-w-\[1520px\]/);
  assert.match(footer, /xl:px-14/);
  assert.match(globals, /--cs-primary: 220 7% 72%;/);
  assert.doesNotMatch(globals, /--cs-primary: 38 60% 70%;|--cs-shadow-glow: 0 0 80px -20px hsl\(38 60% 50%/);
  assert.match(caseStudyScopeBlock, /font-family: var\(--font-serif\);/);
  assert.doesNotMatch(caseStudyScopeBlock, /font-family: var\(--font-inter\)/);
  assert.match(globals, /\.gw-case-study \.cs-font-serif-display \{[\s\S]*font-family:\s*var\(--font-serif\);/);
  assert.doesNotMatch(globals, /\.gw-case-study \.cs-font-serif-display \{[\s\S]*font-family:\s*var\(--font-instrument-serif\)/);
  assert.match(eyebrowBlock, /font-family: var\(--font-serif\);/);
  assert.match(eyebrowBlock, /font-style: italic;/);
  assert.doesNotMatch(eyebrowBlock, /font-jetbrains-mono|text-transform:\s*uppercase|letter-spacing:\s*0\.2em/);
  assert.match(humanNoteBlock, /font-family: var\(--font-serif\);/);
  assert.match(humanNoteBlock, /font-style: italic;/);
  assert.match(smallLabelBlock, /font-family: var\(--font-serif\);/);
  assert.doesNotMatch(smallLabelBlock, /font-family: var\(--font-sans\)/);
  assert.match(globals, /\.gw-case-study \.cs-note-row \{/);
  assert.match(globals, /\.gw-case-study \.cs-example-panel \{/);
  assert.match(globals, /\.gw-case-study \.cs-decision-list \{/);
  assert.match(globals, /\.gw-case-study \.cs-closing-note \{/);
  assert.match(hero, /text-\[clamp\(2\.2rem,4\.1vw,3\.85rem\)\]/);
  assert.match(hero, /leading-\[1\.08\]/);
  assert.match(hero, /tracking-\[-0\.015em\]/);
  assert.doesNotMatch(hero, /Maker&apos;s note/);
  assert.match(hero, /className="cs-human-note/);
  assert.match(hero, /className="cs-inline-label"/);
  assert.doesNotMatch(hero, /cs-font-mono|uppercase leading-relaxed tracking/);
});

test("scroll integrity rule is documented and runnable", () => {
  const agents = readFileSync(AGENTS_PATH, "utf8");
  const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const skill = readFileSync(SCROLL_SKILL_PATH, "utf8");
  const nextConfig = readFileSync(NEXT_CONFIG_PATH, "utf8");

  assert.match(agents, /Ghostwriter scroll integrity is a release blocker/);
  assert.match(agents, /skills\/ghostwriter-scroll-integrity\/SKILL\.md/);
  assert.equal(
    pkg.scripts?.["test:scroll"],
    "node --experimental-strip-types --experimental-specifier-resolution=node --test tests/ui-layout-guard.test.ts",
  );
  assert.match(skill, /name: ghostwriter-scroll-integrity/);
  assert.match(skill, /one native document scroller/);
  assert.match(skill, /overflow-x: clip/);
  assert.match(agents, /white bottom-left scrollbar\/thumb artifact/);
  assert.match(agents, /devIndicators: false/);
  assert.match(agents, /release blocker/);
  assert.match(agents, /scroll to the page end and verify there is no horizontal scrollbar\/thumb/);
  assert.match(skill, /white bottom-left scrollbar\/thumb artifact/);
  assert.match(skill, /NEXTJS-PORTAL/);
  assert.match(nextConfig, /devIndicators:\s*false/);
  assert.match(skill, /horizontal scrollbar, track, thumb, or white pill/);
  assert.match(skill, /scroll to the page end and verify there is no horizontal scrollbar\/thumb/);
});

test("ghostwriter client can refresh stale shield cookies before giving up", () => {
  const page = readFileSync(PAGE_PATH, "utf8");
  const clientGuard = readFileSync(CLIENT_GUARD_PATH, "utf8");

  assert.match(clientGuard, /export const RECOVERABLE_SESSION_ERRORS = \[/);
  assert.match(clientGuard, /export async function refreshGhostwriterShieldSession/);
  assert.match(clientGuard, /fetch\("\/second-voice\?shield=refresh"/);
  assert.match(clientGuard, /signal: options\.signal/);
  assert.match(clientGuard, /throwIfAborted\(signal\)/);
  assert.match(page, /isRecoverableSessionError\(message\)/);
});

test("case study polish avoids placeholder links and motion traps", () => {
  const liveExample = readFileSync(CASE_LIVE_EXAMPLE_PATH, "utf8");
  const footer = readFileSync(CASE_FOOTER_PATH, "utf8");
  const topbar = readFileSync(CASE_TOPBAR_PATH, "utf8");
  const howItWorks = readFileSync(
    new URL("../src/components/ghostwriter/case-study/HowItWorks.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(existsSync(HOW_IT_WORKS_DRAWER_PATH), true);
  assert.match(liveExample, /One sentence, three treatments/);
  assert.match(liveExample, /hear language differently/);
  assert.doesNotMatch(liveExample, /small project|keep the pressure low|caring out loud|stakes tucked away/);
  assert.match(liveExample, /label: "warmer"/);
  assert.match(liveExample, /label: "stranger"/);
  assert.match(liveExample, /label: "plainer"/);
  assert.match(liveExample, /aria-pressed=\{index === active\}/);
  assert.match(liveExample, /aria-live="polite"/);
  assert.doesNotMatch(liveExample, /useReducedMotion|setInterval|live ·|progress|Example output|cs-font-mono|uppercase tracking/);
  assert.match(howItWorks, /Three decisions that shaped the interface/);
  assert.match(howItWorks, /Authors as lenses/);
  assert.match(howItWorks, /The dial makes mood visible/);
  assert.match(howItWorks, /The rewrite appears as a change/);
  assert.doesNotMatch(howItWorks, /Section ·|The sentence becomes itself|How it works|cs-font-mono|uppercase tracking/);
  assert.doesNotMatch(footer, /href="#"/);
  assert.doesNotMatch(footer, /Twitter|GitHub|Contact/);
  assert.doesNotMatch(topbar, /Case Study|2026|Case 01 \/ 03/);
});
