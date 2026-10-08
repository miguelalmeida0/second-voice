# Contributing

Second Voice is developed on `test` and released through `main`. Do not create additional feature branches. Read [`AGENTS.md`](AGENTS.md) and the current [launch gate](docs/security/LAUNCH_GATE.md) before editing server policy or release configuration.

## Before a change

1. Identify the owning layer: app routes, writing-studio UI, server policy, database migration or tests.
2. For UI/CSS work, read [the scroll-integrity skill](skills/ghostwriter-scroll-integrity/SKILL.md). Preserve a single native page scroller.
3. For a bug, reproduce it first, add a regression test, then make the smallest fix.
4. Keep credentials, paid provider traffic and live user content out of tests and fixtures.

## Verify

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run test:unit
npm run test:security
npm run test:scroll
```

For release candidates, follow [`docs/security/TECHNICAL_REFERENCE.md`](docs/security/TECHNICAL_REFERENCE.md) for integration and browser checks, and `npm run verify:release`. Document any skipped test and its prerequisite. **Do not silently lower authentication, abuse or budget controls to make a test pass.**

Only promote independently validated changes to `main`; neither an agent nor a local environment is allowed to bypass repository protections.
