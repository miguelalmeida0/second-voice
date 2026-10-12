# Instant Duet first paint — 2026-10-12

Implemented locally. **Not committed, pushed, or deployed.** Git writes were denied when staging the final files and committing: `Unable to create '/Users/malmeida/Documents/Development/second-voice-duet/.git/worktrees/second-voice-instant-studio-20261012/index.lock': Operation not permitted`. No alternate checkout, remote write, or direct deployment was used to bypass this denial.

Working branch: `fix/duet-instant-first-paint-20261012` (the explicitly requested launcher branch). Base and currently verified production commit: `cc13efcf68ba8f42662ed17a403c3416010251bb`. Vercel deployment `dpl_6bgrPokuPrqL4M6rnwrarmKdn8MN`, project `secondvoice`, was READY at that commit. The production URL `https://secondvoice-ai.vercel.app/second-voice` redirects to `/`; this existing URL behavior is preserved.

## Cause and implementation

The page awaited `resolvePortfolioSession` before returning the React tree. Proxy also redirected new anonymous visitors back to the same URL to make their identity cookie available to that server lookup. A cold, cookie-less HTTP client repeated this redirect. The old segment loading component rendered a standalone branded destination while its route suspended. Since the current production commit aliases the studio at `/`, removing that segment fallback alone would not fix the root route's network wait.

- `src/app/second-voice/page.tsx` returns the actual studio with `{ status: "checking" }` after the existing canonical-host check. No identity or allowance fetch is awaited before studio markup.
- `src/proxy.ts` retains nonce CSP, signed anonymous identity, shield/CSRF cookies and their settings; it sets them on the studio response without the self-redirect. The browser sends them to the existing client auth handshake.
- `src/components/ghostwriter/BetaSignIn.tsx` and all auth/provider/allowance endpoints are unchanged. Existing status retries, shield recovery, timeout, abort, and fail-closed initial state are reused. No generation is started on page load.
- Deleted `src/app/second-voice/loading.tsx` and its unused rules in `src/app/second-voice-studio.css` and `src/app/duet.css`. Removed approximately 3.5 KB of uncompressed obsolete CSS. Shared legal rules remain.
- `src/components/ghostwriter/RewritePlayback.tsx` uses a small apricot writing signal in the existing output status region. The existing reduced-motion rule disables it. No fabricated progress steps or percentages.
- `src/app/second-voice/account/page.tsx` uses Next Link for the existing return-to-studio action, fixing the baseline lint error and enabling client navigation.

Fonts, approved palette, main layout, security guards, backend accounting, and dependency versions are unchanged. `data-app-ready` does not hide the server-rendered editor; it remains a preference-hydration marker.

## Measured before / after

Node 22.23.2, local production builds, three fresh in-memory cookie jars per version. `tests/performance/slow-store.mjs` adds a 1500 ms delay only to the fake local anonymous allowance RPC when explicitly preloaded into the test process. It is never imported by the app. No production session or credential was saved.

| Measurement | Before | After |
| --- | --- | --- |
| Navigation to final response headers, ms | 1615 / 1513 / 1515 | 114 / 15 / 12 |
| Full HTML received, ms | 1617 / 1513 / 1516 | 118 / 15 / 13 |
| Bootstrap redirects from `/` | 1 | 0 |
| Actual editor in returned HTML | yes, after allowance | yes, before allowance |
| Standalone loader in root HTML | no | no |

Median response-header time improved from 1515 ms to 15 ms in this deliberately delayed local scenario. This proves removal of the datastore dependency, not real-world CWV. The first sample includes process warm-up. Raw receipts: `.tmp/metrics-before.jsonl` and `.tmp/metrics-after.jsonl`.

FCP, LCP, CLS, INP, throttled mobile network results, and field CWV are **unverified**. The connected browser's read-only evaluation surface does not expose Performance APIs, and native Playwright failed before creating a page. No claims of meeting LCP 2.5 s or CLS 0.1 are made. No speculative font or bundle refactor was undertaken.

## Verification

- `npm ci --cache .tmp/npm-cache`: passed under Node 22.23.2. The global cache is protected, so only the checkout-local cache was used. Install reported five development dependency advisories; `npm audit --omit=dev` separately passed with zero vulnerabilities.
- `npm run lint`: passed, zero errors and three pre-existing script/fixture warnings.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed (final optimized Next 16.3.8 build).
- `npm run test:security`: **225 passed, 0 failed**.
- `npm run test:scroll`: **23 passed, 0 failed**.
- New behavioral tests first failed on the original stalled route and 307 response, then passed after the fix. The canonical-host redirect test passed both times. The obsolete source assertion requiring SSR allowance was replaced by these behavior checks. The shield-refresh source check now reflects the existing canonical `/?shield=refresh` URL.
- Connected Chrome, local production build: actual studio observed during auth checking; typing works while CTA remains disabled; unavailable status retains entered text; Tab from the editor focuses Clear; reload renders one studio. Inspected 1440×900, 390×844 and 320×844. Document width equals viewport width; textarea is 20 px; native document scrolling and the mobile CTA dock remain; bottom screenshots showed no horizontal thumb/pill. Browser error/warning log inspection returned none for the sampled local tab.
- `npm run test:integration`: **blocked**, Docker daemon unavailable at `/Users/malmeida/.docker/run/docker.sock`.
- Native Playwright: **blocked**, Chrome process exits `SIGABRT` before opening a page. Its bundled Chromium executable is also absent. Connected-Chrome checks above are distinct from automated E2E passes.
- Completed rewrite, authenticated/expired transitions, deliberately delayed client auth success, reduced-motion runtime, and full navigation matrix: new automated coverage saved but **not executed successfully**.
- Impeccable scan completed. Existing token/typography advisories and test-regex findings were left standing; no design suppressions or broad restyling were introduced.

## Regression coverage and continuation

`tests/instant-studio.test.ts` executes the real page/proxy with controlled external boundaries. `tests/e2e/instant/instant-studio.spec.ts` covers SSR without JS, pending/failing/expired auth, keyboard input, refresh, contextual rewrite feedback, reduced motion, and 1440/768/390/320 widths. Run it with `npm run test:instant`; its separate config enables portfolio access gating with existing development-only fixture availability. It is intentionally separate from the default non-portfolio E2E suite.

`.github/workflows/instant-studio.yml` is prepared to run build, lint, types, security, scroll, Docker integration and Chromium/mobile browser coverage on a hosted runner, then retain browser evidence. It has **not run**, because the Git permission denial prevented committing/pushing it.

To continue: restore normal write access to this worktree's Git metadata through the execution environment, stage the final working-tree files (the index contains an earlier partial staging, including the old test location), commit with the required Miguel Almeida author/committer, and push the already-authorized launcher branch. Run and inspect hosted verification. Only after critical checks pass, recheck current remote main, fast-forward without overwriting intervening work, and verify the resulting Vercel deployment and public UI. Do not deploy this unverified candidate directly around the Git denial.

Local cleanup note: the diagnostic Next dev server regenerates two `.tmp/next-first-paint` include entries in `tsconfig.json`; these are incidental, not required by the fix. Process cleanup was also denied (`kill: operation not permitted`). Task-started servers on ports 4017–4021 may remain and should be stopped before removing those generated entries. No unrelated process was targeted.
