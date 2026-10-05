# Duet implementation report

Final local acceptance: **PASS**. Complete browser matrix: **195/195**. Independent review: seven material fixes resolved. Broader deployment clearance remains blocked by the separate existing issues recorded below.

Branch: `design/duet-responsive`. Checkout: `/Users/malmeida/Documents/Development/second-voice-duet`. Base: `2c9abc01b4cdd7e2b82417573e3cd6c3473249a0`. Work remains uncommitted; no merge, push or deployment was performed. Environment secrets and dependency manifests were not changed.

## Implementation

The supplied `codex-duet-handoff/references/01-APPROVED-DUET-VISUAL-AUTHORITY.png` governs the redesign. The other five references supplied feature/state requirements only. Duet uses cream original-writing and forest rewrite canvases, a shared sage control plane, apricot Rewrite action, sans-serif draft/controls and serif output. A small `DuetControls` component handles the shared controls while existing request/state handlers remain in place. `src/app/duet.css` contains the scoped design tokens and responsive rules; older shared styles remain for other application routes.

Desktop retains the equal comparison columns. At 768–1100px, spacing and controls adapt within two columns. Below 768px, the reading order becomes original → controls → Rewrite → forest result. The auto-growing editor, one document scroller, 2,000-character limit, all four authors, five outcomes, six Quick Starts, author mood, processing/live/skip/reduced-motion playback, Copy, Try another rewrite and Surprise remain available. Existing optional Lab, feedback and public-sharing flags remain intact.

Help, identity controls, sign-in/error/loading shells, account and legal/privacy reading surfaces use the Duet system. Substantive legal copy, APIs, authentication, allowance/admission policy and server code were preserved. Clipboard failures now produce an actionable message instead of false success; a successfully created public link remains available if Safari denies the subsequent clipboard operation. Requesting text describes waiting for the response without inventing backend stages.

## Changed files

- Design/layout: `src/app/duet.css`, `src/app/layout.tsx`, `src/app/second-voice/account/page.tsx`, `src/app/second-voice/error.tsx`.
- Components under `src/components/ghostwriter/`: `DuetControls.tsx`, `GhostwriterPage.tsx`, `AuthorOrbital.tsx`, `OutcomeOptions.tsx`, `QuickStartsPanel.tsx`, `RewritePlayback.tsx`, `HowItWorksDrawer.tsx`, `BetaSignIn.tsx`, `SecondVoiceExperience.tsx`, `SecondVoiceSignInPage.tsx`.
- Browser verification: `playwright.config.ts`, `scripts/release/test-portfolio-browser.mjs`, `tests/e2e/pages/AppPage.ts`, and specs `duet`, `duet-evidence`, `auth`, `error-states`, `filters`, `modals`, `portfolio-film`, `tables`.
- Existing source contracts: `tests/ui-layout-guard.test.ts`, `tests/portfolio-reliability.test.ts`.
- Documentation/evidence: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `.impeccable/surfaces/second-voice.md`, `DUET-PROGRESS.md`, this report, the supplied `codex-duet-handoff/` folder, and ignored screenshot/review outputs. `.gitignore` excludes regenerated visual evidence.

## Verification

All commands use Node 22.23.2 through:

```sh
export PATH=/Users/malmeida/.nvm/versions/node/v22.23.2/bin:$PATH
```

| Exact command | Result |
| --- | --- |
| `npm run test:release:gate` | PASS, exit 0. `npm run lint`: zero errors, three existing warnings. `npx tsc --noEmit`: PASS. `npm run test:security`: 207/207. `npm run test:scroll`: 22/22. `npm run test:integration`: PASS. `npm run test:e2e`: 195/195 across five projects, 10.6 minutes. |
| `npm run build` | PASS on the final UI correction batch. |
| `node scripts/release/test-portfolio-browser.mjs` | PASS: production-rendered synthetic auth/rewrite UI at six viewports, no provider calls. |
| `npx playwright test duet-evidence.spec.ts duet.spec.ts --project=chromium --project=mobile-chrome --reporter=list --output=.tmp/duet-evidence-results` | PASS, 10/10 focused corrected tests. |
| `npm run verify:release` | Executed; FAIL. Passing SQL output is misparsed by the existing verifier; audit reports five high dependency findings; this intermediate run also had a WebKit synthetic-film clipboard failure and source-stability failure while review edits continued. Those browser changes are included in the final gate above. |

The broader verifier separately passed real isolated Next HTTP + GoTrue + PostgREST + PostgreSQL authentication, production webpack build, secret scans and client-secret canary. Its paid-profile evidence still declares unperformed authenticated dispatch/recovery race gates and unknown external controls. It is not a deployment approval.

Logs: `.tmp/duet-final-gate.log`, `.tmp/duet-build.log`, `.tmp/duet-portfolio-ui.log`, `.tmp/duet-evidence-final.log`, `.tmp/duet-release.log`, `.tmp/release/evidence.json`. The completed final gate supersedes earlier browser results for the final source. Final source/build identity is recorded in `.tmp/duet-final-source.json`.

## Browser and viewport evidence

Projects: Chromium, Firefox and WebKit desktop (1440×1100), Pixel 7 mobile Chromium, and the added iPhone 13 mobile WebKit project. Required widths exercised in each project's width sweep: 320, 360, 375, 390, 430, 600, 768, 820, 1024, 1280, 1440, 1920 and 2560px; phone landscape 844×390; breakpoints 767/768/769 and 1099/1100/1101 (plus inherited 999/1000/1001). A 16px-step sweep from 320 to 2560 tests 2,000-character drafts for preserved text, no horizontal overflow and no textarea internal scrolling. Additional checks cover in-flight resize, 200% root font size and reduced motion.

Production-mode Chromium checks run at 360×800, 390×844, 768×1024, 1024×768, 1440×900 and 1512×982. They exercise anonymous/authenticated identity, auth error, new-tab session, author/outcome requests, copy, exhaustion, offline/503/429 errors, unavailable session, help isolation/restoration, sign-out clearing and no automatic retries. Responses are synthetic; the real server has an unreachable auth store and cannot issue a provider spend.

Screenshots: `artifacts/duet/{chromium,firefox,webkit,mobile-chrome,mobile-webkit}/` contains numbered default, ready, outcome, processing, live, result, Surprise, help, bottom edge, account, privacy and enlarged-text captures. Production states are in `.tmp/release/portfolio-ui/`, named by state and width. Representative files:

- `artifacts/duet/chromium/06-result.png`
- `artifacts/duet/mobile-chrome/06-result.png`
- `.tmp/release/portfolio-ui/help-390.png`
- `.tmp/release/portfolio-ui/exhausted-1440.png`
- `artifacts/duet/chromium/09-bottom.png`

Independent Impeccable review scored all seven requested fixes resolved, disposition **ship at the fix-list scope**. Details: `artifacts/duet/review.md`. Reviewed bottom captures show no forbidden horizontal scrollbar/thumb. No generated image or concept was used.

## Accessibility and limits

Axe reported zero violations in the tested main app, result, help, account, privacy and existing case-study states; production-state checks use WCAG A/AA tags. Keyboard focus trapping, Escape/restoration, range-arrow operation, accessible copy status, practical 44px control targets, reduced motion and overflow assertions passed across the final matrix. These automated checks do not replace human assistive-technology testing.

Live GitHub OAuth, physical-device virtual keyboards, assistive-technology users and actual browser zoom were not independently exercised. HTML root-font enlargement is the automated enlarged-text check. Existing lint warnings remain in three unrelated scripts/fixtures. The five high audit findings are in the existing ESLint dependency chain; no blind breaking dependency upgrade was made. The broader release verifier's parser and paid-release gaps remain outside this UI redesign.

Local backend recovery on 2026-10-04: this isolated checkout had no backend environment file. The existing configuration at `/Users/malmeida/Documents/mockup/ghostwritter/.env.local` was loaded into the server process without editing or copying secrets. Its existing portfolio-free profile was enabled, with fixture mode false. A real browser rewrite of `hello i am cristiano` returned `Greetings, I am Cristiano.` and the displayed allowance changed from 3 to 2. This single successful live rewrite does not establish the other release gates.

## Subsequent UX correction

The user's later action-discoverability and windowed-density instructions supersede the original floating action geometry. See [DUET-ACTION-REPORT.md](DUET-ACTION-REPORT.md) for the contained desktop action, mobile dock/fallback, compact sizing and fresh verification.

## Run locally

From this checkout:

```sh
/Users/malmeida/.nvm/versions/node/v22.23.2/bin/node -e 'process.loadEnvFile("/Users/malmeida/Documents/mockup/ghostwritter/.env.local"); process.env.NEXT_PUBLIC_SITE_URL="http://127.0.0.1:4003"; const child=require("node:child_process").spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-H","127.0.0.1","-p","4003"],{stdio:"inherit",env:process.env}); child.on("exit",code=>process.exit(code??1));'
```

Open `http://127.0.0.1:4003/second-voice`. This command uses the original checkout's existing environment file; it does not modify that file. Existing provider/auth configuration and durable allowances continue to govern live capabilities.
