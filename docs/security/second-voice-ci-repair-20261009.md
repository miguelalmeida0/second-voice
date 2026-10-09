# Second Voice CI repair scope — 2026-10-09

## Verified historical evidence

- Current main CI failed compiling `src/app/layout.tsx` through the Google font build-time loader. The later UI server start failure was downstream of the failed build.
- The historical Duet mobile test looked for an obsolete `.duet-action-selection` element. The real selected author has accessible `aria-pressed` semantics and the incorrect selection is asserted false.
- A full-history Gitleaks run reported three `generic-api-key` matches at commit `7732a721d70fc6e255b369916ded069a6d062a45`: workflow lines 33 and 46, security-abuse test line 39.
- Those three source locations assign the same deterministic, repeating 32-hex demonstration vector, not three independent generated credentials. The current versions no longer contain this vector at those locations.
- `.gitleaksignore` now contains **only** those three additional exact historical fingerprints. No broad rule/path/commit exclusions; no changes to Gitleaks invocation or security gating.

## Repair

- Vendor the three existing OFL-licensed type families as WOFF2 and use `next/font/local`. Preserve Duet typography and the CSP's `font-src 'self'` while eliminating Google Fonts network dependency during builds.
- Replace the obsolete presentation selector with an accessible, state-based author-selection assertion for mobile.

## Limits

- This patch does not prove a production credential was never reused elsewhere. Check external deployment credentials separately if any signing fixture was reused; revoke and rotate on uncertainty.
- Browser/auth requests in the portfolio test are explicitly synthetic. This patch does not certify live OAuth, real AI execution, or the full production release.
- No historic Git commits are rewritten. CI must independently run and pass before merge.
