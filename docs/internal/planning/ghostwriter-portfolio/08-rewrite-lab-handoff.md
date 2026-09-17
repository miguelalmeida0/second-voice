# Rewrite Lab Handoff

## Executive Thesis

Rewrite Lab is the feature that turns Second Voice from a beautiful AI demo into a miniature AI systems product.

The main app should stay simple:

1. write text
2. choose author
3. move mood
4. rewrite

Rewrite Lab is what appears after a successful rewrite for people who want to see how the machine thinks.

The product story:

> Second Voice does not blindly trust one model sample. It generates candidate rewrites, evaluates them against a rubric, selects a winner, and shows a compact trace of the decision.

The technical story:

> This is an observable generation pipeline with sampling, structured evaluation, ranking, fallback behavior, and UI-compressed traces.

This should impress senior AI engineers because it shows understanding of the real problem in AI apps: not calling a model, but building a controlled system around an uncertain model.

## What This Is

Rewrite Lab is an optional post-rewrite panel opened by a small button:

`Open Rewrite Lab`

It runs a 3-candidate generation and evaluation pass. The visible labels should feel human, not academic:

1. Generate three directions in parallel: `Keep the meaning`, `Add more feeling`, `Make it shorter`
2. Evaluate each candidate with a separate rubric
3. Select the winner
4. Show a product-readable summary and a technical trace

Keep the internal IDs as `faithful`, `expressive`, and `compressed` for schema stability. The user should never have to decode those words.

## What This Is Not

Rewrite Lab is not:

- a chat interface
- a prompt debugger
- a raw logs viewer
- a model benchmark
- a full eval platform
- a fake progress animation

The feature should feel like a tiny, elegant lab instrument embedded inside a playful app.

## Why It Matters

Most AI writing apps expose a single output and pretend it is authoritative.

Rewrite Lab makes the system more honest:

- sampling produces options
- scoring exposes tradeoffs
- selection is inspectable
- failure modes are visible
- the user can understand why the winner was chosen

For normal users, this creates trust.

For senior reviewers, this demonstrates architectural judgment.

## The One-Liner

`Second Voice generates three possible rewrites, grades them with a structured rubric, then shows why one won.`

## User Experience

### Entry Point

After a successful rewrite, show a small secondary button near the output actions:

`Open Rewrite Lab`

Recommended location:

- in `RewritePlayback`, once `phase === "complete"`
- near copy/share actions if present
- visually quieter than the primary rewrite button

Button copy options:

- `Open Rewrite Lab`
- `Why this version?`
- `Show the lab`

Recommended v1:

- `Open Rewrite Lab`

Why:

It sounds more intentional and more portfolio-worthy.

### First Open

When the user opens the lab, show a panel with four pipeline stages:

1. `Generate candidates`
2. `Evaluate candidates`
3. `Select winner`
4. `Show trace`

The lab can start running immediately on open.

Keep the visual language restrained:

- small status lights
- progress rows
- score table
- no sci-fi terminal theatrics

### Loading State

Use stage-aware loading:

1. `Generating three candidate rewrites`
2. `Scoring meaning, voice, readability, surprise, and risk`
3. `Selecting the strongest version`
4. `Building trace`

This communicates that the system is doing work, not just waiting.

### Success State

The lab should show three layers:

#### Layer 1: User-readable result

Show:

- winner label
- one sentence explaining why it won
- winner rewrite

Example:

`Expressive won because it carried the strongest Tolkien texture while preserving the original emotional meaning.`

#### Layer 2: Candidate comparison

Show three compact rows:

- `Faithful`
- `Expressive`
- `Compressed`

Each row shows:

- overall score
- meaning score
- voice score
- readability score
- surprise score
- overreach risk

#### Layer 3: Technical trace

Show a collapsible `Trace` panel:

- provider
- model
- generator prompt profile
- evaluator rubric version
- candidate count
- generation latency
- evaluation latency
- total latency
- winner
- fallback behavior
- schema validation status

This is where the senior reviewer should pause.

## Candidate Profiles

Generate exactly three candidates in v1.

### Keep The Meaning

Internal ID: `faithful`

Goal:

- preserve meaning aggressively
- keep close to source
- apply author voice with restraint

Prompt direction:

```txt
Rewrite the passage in the selected voice, but prioritize semantic preservation and clarity.
Stay close to the source. Avoid adding new facts, new emotional stakes, or extra imagery unless the source implies them.
```

### Add More Feeling

Internal ID: `expressive`

Goal:

- maximize voice signal
- make the rewrite visibly transformed
- preserve intent, but allow more style

Prompt direction:

```txt
Rewrite the passage with a stronger author lens.
Let rhythm, imagery, and sentence texture become more visible, while preserving the original meaning and point of view.
```

### Make It Shorter

Internal ID: `compressed`

Goal:

- reduce wording
- keep the strongest meaning
- make the line cleaner and tighter

Prompt direction:

```txt
Rewrite the passage in a more compressed form.
Keep the emotional and factual core, remove slack, and preserve the selected voice with as few words as possible.
```

## Evaluator Rubric

The evaluator should score each candidate on five dimensions.

All scores should be integers from `0` to `100`.

### Meaning Preservation

Question:

`Does this preserve the user's original meaning, facts, intent, and point of view?`

High score:

- no invented facts
- no changed stance
- no distorted emotion

### Voice Match

Question:

`Does this reflect the selected author lens and mood band without becoming parody?`

High score:

- clear tonal signal
- controlled style
- no cartoonish imitation

### Readability

Question:

`Is the rewrite clear, fluent, and pleasant to read?`

High score:

- clean sentence rhythm
- no awkward model phrasing
- no unnecessary complexity

### Surprise

Question:

`Does this create a meaningfully fresh version instead of a bland paraphrase?`

High score:

- fresh phrasing
- memorable turn
- visible transformation

### Overreach Risk

Question:

`How likely is this candidate to add too much, distort the source, or over-style the output?`

Use enum:

- `low`
- `medium`
- `high`

## Scoring Formula

Use a weighted score.

Recommended v1:

```ts
overall =
  meaningPreservation * 0.34 +
  voiceMatch * 0.24 +
  readability * 0.20 +
  surprise * 0.14 +
  overreachPenalty * 0.08
```

Convert risk to penalty:

```ts
const overreachPenalty = {
  low: 100,
  medium: 65,
  high: 20,
}[overreachRisk];
```

Why this weighting:

- meaning must dominate
- voice matters because it is the product hook
- readability prevents technically correct but ugly outputs
- surprise rewards delight
- risk keeps the system from selecting a flamboyant but distorted rewrite

## Selection Rules

Base rule:

- choose the highest weighted score

Tie-breakers:

1. higher meaning preservation
2. lower overreach risk
3. higher readability
4. `faithful` as final fallback

The winner explanation should be short and product-facing.

Do not expose chain-of-thought.

Example:

`Expressive won because it had the strongest voice match while staying close to the source meaning.`

## Structured Output Contract

The evaluator should return strict structured data.

Recommended schema:

```ts
const EvaluationSchema = z.object({
  rubricVersion: z.literal("rewrite-lab-rubric-v1"),
  candidates: z.array(
    z.object({
      id: z.enum(["faithful", "expressive", "compressed"]),
      scores: z.object({
        meaningPreservation: z.number().int().min(0).max(100),
        voiceMatch: z.number().int().min(0).max(100),
        readability: z.number().int().min(0).max(100),
        surprise: z.number().int().min(0).max(100),
        overreachRisk: z.enum(["low", "medium", "high"]),
      }),
      evaluatorNote: z.string().min(1).max(220),
      flags: z.array(
        z.enum([
          "invented_fact",
          "changed_meaning",
          "too_plain",
          "too_stylized",
          "awkward_phrasing",
          "strong_candidate",
        ]),
      ).max(4),
    }),
  ).length(3),
  winnerId: z.enum(["faithful", "expressive", "compressed"]),
  selectionReason: z.string().min(1).max(220),
});
```

Important:

- validate with Zod even if the provider supports schema-constrained output
- show schema validation status in the trace
- if evaluator output fails validation, use fallback selection and mark the trace clearly

## Prompt Design

### Generator Prompt

Reuse the existing author and mood system.

Add a candidate profile instruction.

The generator should return only the candidate rewrite.

Do not ask the generator to self-evaluate.

### Evaluator Prompt

The evaluator gets:

- original source
- author
- mood label
- candidate rewrites
- rubric

The evaluator should:

- score all candidates
- identify flags
- choose a winner
- produce a short public explanation

The evaluator should not:

- produce hidden reasoning
- mention private chain-of-thought
- rewrite the candidates
- introduce a new candidate

Evaluator system direction:

```txt
You are an evaluator for a literary rewrite system.
Grade candidate rewrites against the source text using the supplied rubric.
Return only valid JSON matching the schema.
Prefer semantic preservation over stylistic intensity when there is a conflict.
Do not reveal private reasoning. Use concise public evaluator notes only.
```

## API Design

Add a new route:

- `POST /api/ghostwriter/lab`

Why separate route:

- lab is more expensive
- lab has a different response contract
- lab can have tighter limits
- the normal rewrite path stays fast and simple

### Request

```ts
type RewriteLabRequest = {
  author: AuthorId;
  challengeNonce: string;
  challengeToken: string;
  mood: number;
  source: string;
  baselineRewrite: string;
};
```

### Response

```ts
type RewriteLabResponse = {
  error: string | null;
  lab: {
    candidates: Array<{
      id: "faithful" | "expressive" | "compressed";
      label: string;
      rewrite: string;
      scores: {
        meaningPreservation: number;
        voiceMatch: number;
        readability: number;
        surprise: number;
        overreachRisk: "low" | "medium" | "high";
        overall: number;
      };
      evaluatorNote: string;
      flags: string[];
      latencyMs: number | null;
    }>;
    winnerId: "faithful" | "expressive" | "compressed";
    selectionReason: string;
    trace: {
      provider: string;
      model: string;
      generatorPromptProfile: string;
      evaluatorRubricVersion: "rewrite-lab-rubric-v1";
      candidateCount: 3;
      generationLatencyMs: number;
      evaluationLatencyMs: number | null;
      totalLatencyMs: number;
      schemaValidation: "passed" | "failed" | "fallback";
      fallbackBehavior: string;
    };
  } | null;
};
```

## Backend Implementation Plan

### Files To Add

- `src/app/api/ghostwriter/lab/route.ts`
- `src/server/ghostwriter-lab.ts`

### Files To Touch

- `src/server/ghostwriter.ts`
- `src/server/abuse-protection.ts` only if lab needs separate rate buckets
- `src/lib/ghostwriter-shared.ts` if shared labels/types are useful
- `src/components/ghostwriter/GhostwriterPage.tsx`
- `src/components/ghostwriter/RewritePlayback.tsx`
- new UI components listed below

### Server Flow

1. Validate same browser guard used by `/api/ghostwriter`
2. Validate body with Zod
3. Cap source length for lab, recommended `1200` characters
4. Generate candidates in parallel with `Promise.allSettled`
5. Track per-candidate latency
6. If all candidates fail, return lab error
7. Evaluate successful candidates
8. Validate evaluator output with Zod
9. Compute weighted scores in code
10. Select winner
11. Return lab payload and trace

### Parallel Generation

Use:

```ts
const candidateResults = await Promise.allSettled(
  CANDIDATE_PROFILES.map((profile) =>
    generateCandidate({
      author,
      mood,
      profile,
      source,
      provider,
      signal,
    }),
  ),
);
```

Use an overall lab timeout.

Recommended:

- candidate generation timeout: `14_000ms`
- evaluator timeout: `10_000ms`
- total lab timeout: `22_000ms`

### Fallback Behavior

If one candidate fails:

- evaluate the successful candidates
- trace: `1 candidate failed; evaluated remaining candidates`

If evaluator fails schema validation:

- fallback to deterministic heuristic
- choose candidate with best meaning-preservation proxy if available
- otherwise choose `faithful`
- trace: `Evaluator schema validation failed; selected fallback candidate`

If all candidates fail:

- return product error
- do not show partial lab

## UI Design

### Component Additions

Recommended files:

- `src/components/ghostwriter/RewriteLabPanel.tsx`
- `src/components/ghostwriter/RewriteLabTrace.tsx`
- `src/components/ghostwriter/RewriteLabScoreCard.tsx`

### Panel Placement

After a successful rewrite, show:

- `Open Rewrite Lab`

When opened, render a drawer or inline panel near the output.

Recommended v1:

- use a drawer or bottom sheet similar to How It Works
- keep it separate from the main output so the base app stays clean

### Visual Hierarchy

The panel should have:

1. Pipeline status at top
2. Winner summary
3. Candidate comparison
4. Trace disclosure

### Candidate Row

Each candidate row:

- label
- short description
- overall score
- risk badge
- expandable rewrite text

Example:

```txt
Add more feeling
Overall 88
Meaning 91 | Voice 94 | Clarity 86 | Spark 83 | Risk low
```

### Score Matrix

Use a compact table or grid.

Columns:

- candidate
- meaning
- voice
- clarity
- spark
- risk
- overall

Rows:

- Keep the meaning
- Add more feeling
- Make it shorter

Do not use a chart in v1. A table is clearer and more impressive to technical reviewers.

### Trace Panel

Use a collapsible technical panel.

Label:

- `Trace`

Content:

```txt
Provider: Groq
Model: openai/gpt-oss-20b
Generator profile: rewrite-lab-candidates-v1
Evaluator rubric: rewrite-lab-rubric-v1
Candidates: 3
Generation: 1840ms
Evaluation: 910ms
Total: 2890ms
Schema: passed
Fallback: none
```

This should look like a clean lab card, not a terminal dump.

## Product Copy

### Button

`Open Rewrite Lab`

### Empty State

`Run a rewrite first. Then the lab can generate alternatives, score them, and show why one version wins.`

### Loading

`Generating candidates`

`Scoring the rewrites`

`Selecting the strongest version`

### Success

`The lab tried three versions and selected the strongest one.`

### Trace Helper

`This trace shows the product contract around the model call: sampling, evaluation, schema validation, and fallback behavior.`

### Error

`Rewrite Lab could not finish this run. The original rewrite is still available.`

## Security And Cost Controls

Rewrite Lab is expensive relative to normal rewrite.

Protect it.

Recommended controls:

- reuse existing CSRF/session/proof-of-work flow
- add stricter lab-specific rate limit
- cap source length lower than the normal rewrite path
- do not run lab automatically on page load
- run only after user explicitly opens it
- do not store lab candidates by default
- do not include lab traces in public artifacts in v1

Suggested lab rate limit:

- `3 lab runs / 10 minutes / session`
- `10 lab runs / hour / IP`

## Privacy Rules

Default:

- lab results stay client-visible only
- no lab candidate persistence
- no source text in public artifact
- no raw prompt exposure in the UI

Trace can show:

- prompt profile ID
- rubric version
- schema validation state
- model/provider
- latency

Trace should not show:

- full system prompt
- private API keys
- hidden evaluator instructions
- private reasoning

## Case Study Update

After implementation, update the case study.

Add a section:

`From single output to observable generation`

Core copy:

```txt
The first version returned one rewrite. Rewrite Lab turns that into a small AI pipeline: parallel candidate generation, structured evaluation, deterministic winner selection, and a visible trace. The interaction stays simple for users, but the system exposes the product contract that makes the result trustworthy.
```

This section should sit near the existing engineering note.

## Acceptance Criteria

### Product

- After a rewrite, the user can open Rewrite Lab
- Lab generates three candidates
- Lab evaluates candidates with the rubric
- Lab selects a winner
- User can inspect scores and trace
- Normal rewrite flow remains fast and uncluttered

### Engineering

- lab route is protected by browser guard
- candidate generation runs in parallel
- evaluator output is schema validated
- weighted scores are computed in code
- fallback behavior is explicit
- lab route has timeout handling
- no candidate persistence by default

### Design

- panel is readable on desktop and mobile
- score matrix does not overflow
- trace is compact
- normal users can ignore technical details
- technical users can see the system quality quickly

## Testing And Verification Process

The principal agent should treat Rewrite Lab as a real system feature, not a visual add-on.

### Automated Checks

Run:

```bash
npm run lint
npx tsc --noEmit
npm run build -- --webpack
```

If the build fails only because Google Fonts cannot be fetched in a sandboxed environment, rerun with network access or document that specific environment failure.

### Unit-Level Tests

Add focused tests where practical for:

- scoring formula
- overreach risk penalty mapping
- tie-break selection rules
- evaluator schema validation
- evaluator fallback behavior
- partial candidate failure handling

The most important tests are deterministic ranking and fallback behavior. Those are the parts a senior reviewer will expect to be boringly reliable.

### API-Level Tests

Verify:

- lab route rejects invalid bodies
- lab route rejects missing or invalid browser guard data
- lab route caps source length
- lab route returns a stable product error when all candidates fail
- lab route returns partial results when one candidate fails but others succeed
- trace reports schema validation as `passed`, `failed`, or `fallback`

Use mocked provider responses for these tests. Do not require real model calls for core route correctness.

### Manual Product QA

In the browser:

- run a normal rewrite
- open Rewrite Lab
- confirm the lab does not run before explicit user action
- confirm three candidates appear
- confirm one winner is visually selected
- confirm the score matrix is readable on desktop
- confirm the score matrix does not overflow on mobile
- open and close the trace panel
- confirm normal rewrite still works after closing the lab
- test lab error state by forcing a provider failure or mocked failure path

### Reviewer Demo QA

Before calling the feature done, run one polished demo input and make sure the visible story is immediately legible:

1. the app tried multiple versions
2. the app scored them with a rubric
3. the app selected a winner
4. the trace explains the system contract

If that story is not obvious in under 15 seconds, simplify the UI before adding more detail.

## Implementation Phases

### Phase 1: UI Shell

Build:

- `Open Rewrite Lab` button
- drawer/panel shell
- static pipeline layout
- static score matrix
- trace disclosure

Do not connect model calls yet.

Goal:

- nail the information architecture

### Phase 2: Lab Endpoint

Build:

- `POST /api/ghostwriter/lab`
- request validation
- browser guard reuse
- candidate generation profiles
- parallel generation
- trace timing

Goal:

- return real candidates with trace

### Phase 3: Evaluator

Build:

- evaluator prompt
- structured JSON parse
- Zod validation
- scoring formula
- winner selection
- fallback path

Goal:

- make the winner selection credible

### Phase 4: Product Polish

Build:

- stage-aware loading
- mobile polish
- error states
- latency display
- case study update

Goal:

- make it impressive without feeling heavy

## Principal Engineer Prompt

```txt
Implement Rewrite Lab for Second Voice AI.

The goal is to turn the app from a single-output rewrite demo into an observable generation pipeline that still feels simple to normal users.

After a successful rewrite, show an "Open Rewrite Lab" button. Opening the lab should generate three directions in parallel: "Keep the meaning," "Add more feeling," and "Make it shorter." Keep the internal schema IDs as faithful, expressive, and compressed. Then evaluate the candidates with a separate rubric for meaning preservation, voice match, clarity, spark, and overreach risk. Validate the evaluator output with Zod, compute weighted scores in code, select a winner, and show a compact trace.

Keep the normal rewrite experience untouched and fast. Rewrite Lab is optional and explicit.

Use a separate protected API route, reuse the existing browser security guard, add timeout handling, and do not persist lab candidates by default. The trace should show provider, model, prompt profile, rubric version, candidate count, latency, schema validation, winner, and fallback behavior.

Design the UI like a clean lab instrument, not a dashboard. Normal users should understand "the app tried three versions and picked the best one." Senior AI engineers should see sampling, evaluation, schema discipline, fallback behavior, and product restraint.
```

## Final Product Standard

Rewrite Lab is successful if an AI engineer can look at it and say:

`This person understands that AI product quality comes from the system around the model, not just the model call.`
