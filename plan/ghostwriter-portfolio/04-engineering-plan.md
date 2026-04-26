# Engineering Plan

## Summary

Implement the new portfolio version with minimal backend expansion.

The most important engineering decision:

Use the existing rewrite endpoint to get the final rewritten text, then create the live rewrite animation on the client using the current diff system.

This preserves reliability while producing a more premium experience.

## Existing Assets To Reuse

Current codebase already gives us:

- rewrite endpoint
- mood and author model
- diff engine
- permalink flow
- OG generation
- abuse protection

Primary reuse points:

- `src/components/ghostwriter/diff.ts`
- `src/components/ghostwriter/GhostwriterPage.tsx`
- `src/server/ghostwriter.ts`
- `src/app/g/[id]/page.tsx`

## Feature Breakdown

### 1. Live Rewrite Animation

#### Goal

Turn the final rewrite into a staged animated diff.

#### Recommended Approach

After the API returns:

1. diff the original and rewritten text
2. split the diff into animation groups
3. reveal groups over time
4. allow user to skip to completed state

#### State Model

```ts
type RewritePlaybackPhase =
  | "idle"
  | "requesting"
  | "prelude"
  | "animating"
  | "complete"
  | "error";

type AnimatedOp = {
  kind: "equal" | "delete" | "insert";
  text: string;
  visible: boolean;
};
```

#### Suggested Hook

```ts
type UseRewritePlaybackArgs = {
  source: string;
  result: string;
  enabled: boolean;
};

type UseRewritePlaybackReturn = {
  phase: RewritePlaybackPhase;
  ops: AnimatedOp[];
  skip: () => void;
  reset: () => void;
};
```

#### Animation Heuristic

Keep it simple and legible:

1. equal text is visible immediately
2. delete groups appear first
3. insert groups appear just after the corresponding delete
4. long passages animate in chunks, not token by token

Recommended chunk strategy:

- split diff ops at sentence or clause boundaries when possible
- minimum step interval: 80ms
- maximum full animation time: 5000ms

#### Code Sketch

```ts
function buildPlaybackSteps(source: string, result: string) {
  const ops = diffWords(source, result);
  const steps: AnimatedOp[][] = [];
  let frame: AnimatedOp[] = [];

  for (const op of ops) {
    if (op.kind === "equal") {
      frame.push({ ...op, visible: true });
      continue;
    }

    frame.push({ ...op, visible: true });
    steps.push(structuredClone(frame));
  }

  if (steps.length === 0) {
    steps.push(
      ops.map((op) => ({
        ...op,
        visible: true,
      })),
    );
  }

  return steps;
}
```

This is intentionally conservative. The engineer can refine the grouping logic after the first version looks correct.

### 2. Surprise Me

#### Goal

Create a zero-friction demo path.

#### Suggested Data Model

```ts
type DemoPreset = {
  id: string;
  text: string;
  author: Author["id"];
  mood: number;
};
```

Keep a small curated array in shared client data.

#### Interaction

1. pick a preset different from the current one
2. update input, author, and mood
3. wait 250ms to let the controls visually change
4. fire `handleRewrite()`

#### Why curated presets instead of fully random?

Because portfolio products should optimize for first-impression quality, not statistical variety.

### 3. How It Works Drawer

#### Goal

Explain the craft without leaving the main experience.

#### Component Suggestion

```ts
type HowItWorksSection = {
  id: string;
  title: string;
  body: string;
};
```

Desktop:

- right-side drawer or floating panel

Mobile:

- bottom sheet

#### Behavior

- accessible close behavior
- ESC closes
- click outside closes on desktop
- preserve body scroll lock while open

### 4. Case Study Page

#### Goal

Turn the app into a portfolio artifact with a strong narrative layer.

#### Route Suggestion

- `/ghostwriter/case-study`

This keeps the page within the product world and avoids bouncing the user into a generic portfolio shell.

## Suggested File Touches

Expected changes:

- `src/components/ghostwriter/GhostwriterPage.tsx`
- `src/components/ghostwriter/diff.ts`
- `src/lib/ghostwriter-shared.ts`
- `src/app/ghostwriter/page.tsx`
- new component for live playback
- new component for How It Works drawer
- new case study route

Potential additions:

- `src/components/ghostwriter/RewritePlayback.tsx`
- `src/components/ghostwriter/HowItWorksDrawer.tsx`
- `src/app/ghostwriter/case-study/page.tsx`

## Suggested Technical Decisions

### Decision 1

Do not stream model output for v1.

Reason:

- adds latency complexity
- complicates reliability
- not needed for the illusion

### Decision 2

Use client-side playback from the final diff.

Reason:

- deterministic
- testable
- easy to skip
- looks premium when staged well

### Decision 3

Treat the drawer and case study as first-class product surfaces.

Reason:

They are part of the portfolio artifact, not support docs.

## Accessibility Requirements

1. All interactive controls keyboard reachable
2. `Surprise Me` has descriptive label
3. animated playback has `Skip animation`
4. output remains readable with reduced motion
5. drawer focus is managed correctly

## Reduced Motion Support

If `prefers-reduced-motion` is enabled:

- skip staged playback
- render final diff immediately
- minimize hero motion

This is both good accessibility and good engineering polish.

## Acceptance Criteria

### Live Rewrite

- rewrite output no longer snaps instantly into place
- user can skip animation
- final rendered state matches the actual rewrite exactly
- rerunning a rewrite resets playback cleanly

### Surprise Me

- one click updates the controls and triggers a rewrite
- selected preset feels deliberate and visually distinct

### How It Works

- drawer opens and closes smoothly
- explains system in under 30 seconds of reading

### Case Study

- page is visually aligned with the app
- product, prompt, and security choices are clear

## QA Checklist

1. Consecutive rewrites do not leak old playback state
2. Skip works during every animation phase
3. Empty, error, loading, and success states all remain legible
4. Mobile layout still feels premium
5. Case study route has correct metadata
6. Permalinks continue to work

## Review Standard

The finished product should feel like a principal engineer and a strong product designer worked in tandem, even if the code stays modest.
