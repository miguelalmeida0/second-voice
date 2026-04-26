# How It Works Drawer Handoff

## Purpose

This brief is for implementing the missing in-product `How It Works` drawer inside the main app.

The app already has a strong case study surface, but it lives out-of-band. The missing layer is a compact, elegant in-app explanation of the system that:

1. Rewards curiosity without interrupting the magic
2. Makes the product feel intentional and legible
3. Signals engineering judgment without reading like docs

This feature should make a user think:

`The app is playful, but the builder clearly knows exactly what they made and why.`

## Product Goal

Add a beautiful, compact drawer to the main `/second-voice` experience that explains:

1. the voice system
2. the mood dial
3. the rewrite playback
4. the privacy and sharing model

This should not feel like help center content.

It should feel like a private note from the maker.

## Strategic Role

This is not a support feature. It is a portfolio credibility feature.

The drawer should sit between:

- the playful top layer of the app
- the long-form case study layer

That makes it the ideal middle layer:

- lighter than the case study
- deeper than the main page
- still fully in product context

## Current Product Context

Current strengths:

- The main app already feels distinctive
- rewrite playback is live and theatrical
- there is a good case-study route
- the security and privacy posture is stronger than most portfolio demos

Current gap:

- There is no compact in-product explanation layer
- understanding the system requires leaving the main experience

## Design Thesis

The drawer should feel:

- literary
- precise
- calm
- authored
- expensive in taste, not in ornament

It should not feel:

- like SaaS settings
- like a modal full of product copy
- like an FAQ
- like a generic docs flyout

## Experience Summary

User journey:

1. User lands on `/second-voice`
2. User sees `How it works` near the hero actions
3. User opens the drawer
4. User reads four short sections in under 30 seconds
5. User closes it and continues using the app
6. If they want more depth, they can go to the case study

## Success Criteria

The drawer succeeds if:

1. it is discoverable but not loud
2. it opens instantly and feels polished
3. it explains the system in plain language
4. it preserves the app’s atmosphere
5. it makes the case study feel optional, not required

## Component Placement

### Trigger placement

Place the trigger in the hero action row in:

- [src/components/ghostwriter/GhostwriterPage.tsx](/Users/malmeida/Documents/mockup/ghostwritter/src/components/ghostwriter/GhostwriterPage.tsx)

It should sit beside:

- `Read the case study`

Recommended order:

1. `How it works`
2. `Read the case study`

Reason:

- `How it works` is the shorter path
- `Read the case study` is the deeper path

## UX Spec

### Trigger

Use a chip-style button that visually belongs to the current hero system.

Recommended label:

- `How it works`

Recommended supporting behavior:

- hover: subtle border brighten
- active: small press feel
- keyboard focus: existing focus-visible ring

### Drawer behavior

Desktop:

- right-side drawer
- visually inset from the viewport edge
- width around `400px` to `440px`
- full-height feel with generous top and bottom padding

Mobile:

- bottom sheet
- rounded top corners
- max height around `88vh`
- safe-area aware

### Open / close behavior

Required:

- open on trigger click
- close on backdrop click
- close on `Esc`
- close button in top-right
- focus moves into the drawer when opened
- focus returns to trigger when closed
- body scroll locks while open

### Motion

The motion should feel editorial, not app-like.

Use:

- backdrop fade
- panel slide with slight opacity lift

Desktop:

- subtle right-to-left entrance

Mobile:

- bottom-up sheet motion

Recommended duration:

- `240ms` to `320ms`

Recommended easing:

- `cubic-bezier(0.22, 1, 0.36, 1)`

Reduced motion:

- render nearly instant
- no flourish

## Container Breakdown

### 1. Backdrop container

Purpose:

- separate the drawer from the main page
- quiet the background without making the experience feel blocked

Style:

- dark translucent overlay
- low blur is acceptable if it performs well

Do not:

- use a fully opaque modal blackout

### 2. Drawer shell

Purpose:

- hold the entire reading experience

Style:

- dark glass or smoky panel
- subtle frame border
- soft internal highlight

It should feel like it belongs to the current `gw-card-strong` family, but slightly more refined.

### 3. Header container

Purpose:

- establish tone quickly
- explain the surface in one glance

Required content:

- small eyebrow
- concise title
- short intro sentence
- close button

Recommended copy:

- Eyebrow: `Inside the system`
- Title: `How Second Voice works`
- Body: `A quick look at the voice system, the mood dial, the live playback, and what gets stored.`

### 4. Section stack

Purpose:

- explain the product through four short, high-signal ideas

This should be a vertical stack of four content cards.

Do not make them accordion sections in v1.

The content is already short.

### 5. Footer actions

Purpose:

- give the user the next step
- connect the drawer to the deeper case study

Actions:

- `Read the case study`
- `Close`

## Content Model

Recommended local constant or exported config:

```ts
type HowItWorksSection = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  detail: string;
};
```

Recommended content:

```ts
export const HOW_IT_WORKS_SECTIONS: HowItWorksSection[] = [
  {
    id: "voice",
    kicker: "01",
    title: "Voice system",
    body:
      "Each author works like a tonal lens, not a literal impersonation engine. The prompts are tuned for rhythm, imagery, restraint, and sentence texture, so the output feels recognizable without tipping into parody.",
    detail:
      "Why it matters: the result feels stylized, but still readable and controlled.",
  },
  {
    id: "mood",
    kicker: "02",
    title: "Mood bands",
    body:
      "The dial looks continuous, but under the hood it maps into five stronger mood bands. That keeps the interaction expressive without making the prompt fuzzy or unpredictable.",
    detail:
      "Why it matters: one slider gives you a creative choice without asking you to write instructions.",
  },
  {
    id: "playback",
    kicker: "03",
    title: "Live playback",
    body:
      "The model generates the final rewrite first. Then the app stages the edit on the client by diffing the source text against the finished result, so the rewrite appears as a sequence of cuts and insertions.",
    detail:
      "Why it matters: the experience feels alive, but stays deterministic and easy to trust.",
  },
  {
    id: "privacy",
    kicker: "04",
    title: "Privacy and sharing",
    body:
      "Rewrites stay private by default. Public links are opt-in, and the sharing layer is designed to protect the original text unless source visibility is explicitly enabled.",
    detail:
      "Why it matters: the product can be playful without being careless.",
  },
];
```

## Visual Design Direction

### Core aesthetic

This drawer should inherit the existing product language from:

- [src/app/globals.css](/Users/malmeida/Documents/mockup/ghostwritter/src/app/globals.css)

Use the current design system:

- `--ghost`
- `--mist`
- `--whisper`
- `--gw-frame-border`
- `--gw-frame-border-strong`
- `--gw-surface-panel`
- `--gw-surface-panel-strong`
- `--gw-voice-color`

### Drawer styling principles

1. Quieter than the hero
2. Slightly more refined than the input card
3. Strong spacing rhythm
4. Accent color used with restraint

### Recommended styling details

Drawer shell:

- background: deep smoked panel
- border: `1px solid var(--gw-frame-border-strong)`
- radius: `18px` desktop, `20px` top corners mobile sheet
- subtle internal highlight
- strong but soft shadow

Section cards:

- use a lighter internal panel style
- small vertical rhythm
- no hard contrast jumps

Kickers:

- muted small caps or uppercase
- numeric markers are fine if tasteful

Titles:

- serif display
- slightly larger than body

Body:

- high readability
- no dense paragraphs

Detail line:

- smaller
- slightly dimmer
- reads like a note, not secondary marketing copy

## Suggested Class Names

Add scoped classes in `globals.css`:

- `.gw-how-backdrop`
- `.gw-how-drawer-wrap`
- `.gw-how-drawer`
- `.gw-how-header`
- `.gw-how-kicker`
- `.gw-how-title`
- `.gw-how-intro`
- `.gw-how-close`
- `.gw-how-sections`
- `.gw-how-section`
- `.gw-how-section-index`
- `.gw-how-section-title`
- `.gw-how-section-body`
- `.gw-how-section-detail`
- `.gw-how-footer`

## Suggested File Structure

Create:

- [src/components/ghostwriter/HowItWorksDrawer.tsx](/Users/malmeida/Documents/mockup/ghostwritter/src/components/ghostwriter/HowItWorksDrawer.tsx)

Optional:

- move content config into `src/lib/ghostwriter-shared.ts` if reuse is likely

Likely touched:

- [src/components/ghostwriter/GhostwriterPage.tsx](/Users/malmeida/Documents/mockup/ghostwritter/src/components/ghostwriter/GhostwriterPage.tsx)
- [src/app/globals.css](/Users/malmeida/Documents/mockup/ghostwritter/src/app/globals.css)

## Component API

Recommended props:

```ts
type HowItWorksDrawerProps = {
  open: boolean;
  onClose: () => void;
};
```

Recommended structure:

```tsx
<AnimatePresence>
  {open ? (
    <>
      <motion.button className="gw-how-backdrop" />
      <motion.div className="gw-how-drawer-wrap">
        <motion.aside
          className="gw-how-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gw-how-title"
          aria-describedby="gw-how-intro"
        >
          <header className="gw-how-header" />
          <div className="gw-how-sections" />
          <footer className="gw-how-footer" />
        </motion.aside>
      </motion.div>
    </>
  ) : null}
</AnimatePresence>
```

## Integration Plan

### Step 1

Add state and trigger to `GhostwriterPage`.

Recommended state:

```ts
const [howItWorksOpen, setHowItWorksOpen] = useState(false);
```

Add trigger in the hero action row.

### Step 2

Render `HowItWorksDrawer` near the root of the page component so it is not trapped by local container overflow.

### Step 3

Implement motion and close behavior.

### Step 4

Add content cards and footer actions.

### Step 5

Add final CSS and mobile polish.

## Interaction Notes

### Focus management

Required:

- trap focus within drawer while open
- return focus to trigger on close

This can be achieved with a lightweight approach if done carefully, but if the engineer prefers a robust local pattern that is fine.

### Scroll locking

Required:

- body scroll lock while open

This matters because the drawer should feel intentional, not flimsy.

### Backdrop pointer behavior

Use a real clickable backdrop so the user can dismiss the drawer naturally.

## Accessibility Requirements

1. Trigger button must have clear label
2. Drawer must use `role="dialog"` and `aria-modal="true"`
3. Title and intro should be referenced with `aria-labelledby` and `aria-describedby`
4. Escape closes the drawer
5. Keyboard-only users can open, read, and close comfortably
6. Reduced motion path should remain elegant

## Content Tone Rules

The content should:

- be plainspoken
- feel thoughtful
- explain trade-offs
- avoid internal jargon

The content should not:

- mention every implementation detail
- read like API documentation
- over-explain the model provider setup
- sound like marketing copy

## Relationship To The Case Study

The drawer is not a replacement for the case study.

Think of the layers this way:

- Main app: magic
- How It Works drawer: legibility
- Case study: authorship

The drawer should end with a clear path to:

- `/second-voice/case-study`

## Recommended Footer Copy

Primary:

- `Read the case study`

Secondary:

- `Close`

## QA Checklist

1. Drawer opens from hero trigger
2. Backdrop closes drawer
3. Escape closes drawer
4. Focus returns to trigger
5. Mobile sheet is readable and scrollable
6. Desktop panel feels inset and polished
7. Reduced motion path is correct
8. Visual design matches the rest of the product
9. Case study link works

## Acceptance Criteria

The feature is done when:

1. the app has an in-product `How it works` entry point
2. the drawer explains the system in under 30 seconds
3. the motion and layout feel premium on desktop and mobile
4. the feature improves credibility without making the product heavier

## Strong Opinions

1. Do not turn this into a modal essay.
2. Do not add more than four sections in v1.
3. Do not expose raw infrastructure details unless they directly affect user trust.
4. Do not outshine the main rewrite experience.

## Suggested Execution Prompt

Use this if needed as the implementation brief:

```txt
Implement an in-product How It Works drawer for Second Voice AI.

The drawer should be a compact, elegant explanation layer inside the main app, not a docs modal.

It must explain four things:
1. voice system
2. mood bands
3. live playback
4. privacy and sharing

Design it to feel literary, precise, and premium. It should preserve the app’s current visual language and sit naturally beside the case study link in the hero.

Use a right-side drawer on desktop and a bottom sheet on mobile. Include:
- backdrop close
- escape close
- focus management
- body scroll lock
- reduced motion support

Keep the copy short, direct, and high-signal. The drawer should be understandable in under 30 seconds and should end with a link to the case study.

Reuse the current design tokens and component language where possible. Do not make this feel like generic SaaS UI.
```
