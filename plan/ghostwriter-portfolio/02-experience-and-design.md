# Experience And Design

## Creative Direction

Ghostwriter should feel like:

- literary
- nocturnal
- theatrical
- tactile
- intelligent

It should not feel like:

- a generic SaaS dashboard
- a productivity app
- a chatbot wrapper
- a neon cyberpunk cliche

## Art Direction

Reference mood:

- editorial cover art
- luxury book jacket
- midnight study
- analog marginalia with digital precision

## Visual System

Keep the current dark atmospheric foundation, but tighten it into a more explicit system.

### Base Tokens

```css
.ghostwriter {
  --void: oklch(0.13 0.008 270);
  --void-2: oklch(0.16 0.01 270);
  --void-3: oklch(0.2 0.015 270);

  --ghost: oklch(0.98 0.005 90);
  --mist: oklch(0.73 0.015 270);
  --whisper: oklch(0.56 0.02 270);
  --line: rgba(255, 255, 255, 0.08);

  --ink-delete: oklch(0.58 0.02 280);
  --ink-insert: oklch(0.9 0.08 230);

  --tolkien: oklch(0.84 0.08 230);
  --tolstoy: oklch(0.92 0.18 125);
  --king: oklch(0.82 0.1 300);
  --hemingway: oklch(0.86 0.09 50);

  --card-bg: rgba(255, 255, 255, 0.035);
  --card-strong: rgba(255, 255, 255, 0.06);
  --glass-blur: 22px;
}
```

### Accent Use

- Author color should tint buttons, inserts, focus states, active chips, and animation cues.
- Deletions should use a muted strike-through color, never bright red.
- Inserts should feel precious and luminous.

## Typography

Keep the current pairing because it already supports the concept:

- Sans: `Inter`
- Display serif: `Playfair Display`

Use `Playfair Display` only for moments of emphasis:

- title accents
- active author name
- insertions during the animated diff
- case study pull quotes

## Layout Direction

### Hero

Current hero structure is solid. Improve the messaging hierarchy:

- Title: keep large and dramatic
- Subtitle: tighter and more evocative
- Primary CTA: `Rewrite`
- Secondary CTA: `Surprise Me`
- Tertiary link: `How it works`

### Main Surface

Keep the two-column interaction:

- left: source input and controls
- right: live rewriting theater

The output pane should feel more stage-like than utility-like.

## Motion Language

Motion should feel literary and deliberate, not app-like.

### Timing

- page-load reveals: 400ms to 900ms
- rewrite staging: 2.5s to 5s
- drawer open: 260ms to 320ms

### Easing

Prefer: `cubic-bezier(0.22, 1, 0.36, 1)`

### Animation Rules

- Avoid spinning loaders
- Prefer caret pulses, text fades, glow shifts, and staged transitions
- Animate only the meaningful layer of the interface

## Interaction Spec

### Live Rewrite Animation

Use a staged animation, not a simple stream dump.

Phases:

1. `Lock`
   Source text and UI controls stabilize.
2. `Read`
   A subtle caret or scan line implies the model is reading.
3. `Cut`
   Deleted fragments dim and strike through.
4. `Rewrite`
   Insertions appear in the author style and accent color.
5. `Settle`
   The final passage becomes stable, readable prose.

User controls:

- `Skip animation`
- rerun is always available after completion

### Surprise Me

Place it adjacent to the main action.

Interaction:

1. Click triggers random author + mood + sample
2. UI visibly updates controls first
3. Rewrite starts automatically after a short beat

This beat matters. The user should see what changed.

### How It Works Drawer

Use a bottom sheet on mobile and a side drawer on desktop.

Sections:

1. `Voice design`
2. `Mood dial`
3. `Rewrite engine`
4. `Sharing`
5. `Abuse protection`

Each section should be 2 to 4 short sentences max.

## Recommended UI Copy

### Hero

Headline:

`Rewrite anything in the voice of a great writer.`

Subhead:

`Pick a voice, turn the mood dial, and watch your sentence come back transformed.`

### Buttons

- `Rewrite as Tolkien`
- `Surprise Me`
- `Skip animation`
- `How it works`
- `Read the case study`

### Output Empty State

`Run a rewrite and the edit will happen here, line by line, like it’s being worked on in front of you.`

### Surprise Me Helper

`A random sample, voice, and mood. Best way to get the joke fast.`

## Permalink Direction

Make permalink pages feel collectible.

Add:

- stronger title treatment
- clearer original vs rewrite hierarchy
- diff summary line
- link back to the main app
- link to case study

## Case Study Visual Tone

The case study should inherit Ghostwriter’s design language, not switch to generic blog styling.

Use:

- dark background
- narrow measure
- large section headers
- occasional screenshots
- diff snippets

## Design Review Checklist

1. Does the app feel like one authored idea?
2. Can a user understand the concept instantly?
3. Does motion add drama without slowing the app down?
4. Is the live rewrite readable at every stage?
5. Does the case study feel like part of the same product world?
