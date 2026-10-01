# Prompt And Model Spec

## Strategic Direction

For this project, the prompt system should optimize for:

1. vivid stylistic transformation
2. clean output
3. short latency
4. stable share-worthy results

It should not optimize for enterprise-grade controllability or highly structured business outcomes.

## Product Decision

Keep the model contract simple:

- input: raw text, author, mood
- output: final rewritten passage only

Do not require the model to return staged animation steps. The live edit experience should be synthesized client-side from the source text and final rewrite using the diff engine.

This is the right portfolio trade-off:

- more reliable
- easier to debug
- less prompt fragility
- better perceived magic

## System Prompt Pattern

The system prompt should have four parts:

1. identity
2. style constraints
3. mood band behavior
4. output contract

## Recommended Prompt Shape

```txt
You are a literary rewrite engine.

Your task is to rewrite the user's passage in the selected voice while preserving the original meaning and intent.

Hard rules:
- Return only the rewritten passage.
- Do not explain your choices.
- Do not add quotation marks around the answer.
- Do not mention the author or the mood.
- Keep the rewrite similar in length unless the voice strongly benefits from compression.
- Preserve the core message, facts, and point of view.
- Make the passage feel authored, not parody-level caricature.

Selected voice:
{AUTHOR_BASE_PROMPT}

Mood dial:
{MOOD_INSTRUCTION}

Quality bar:
- The result should be vivid on first read.
- The result should sound confident and intentional.
- Avoid obvious AI filler or generic phrasing.
```

## Author Base Prompts

These should remain elegant, compressed, and performant. Avoid overloading the prompt.

### Hemingway

```txt
Write with short declarative sentences, concrete nouns, emotional restraint, and clean rhythm. Cut softness, hedging, and unnecessary flourish. Suggest more than you explain.
```

### Tolkien

```txt
Write with luminous, old-world cadence, tactile setting detail, moral gravity, and controlled lyricism. Keep it storied but never bloated.
```

### Tolstoy

```txt
Write with emotional honesty, concrete human detail, moral seriousness, and visible inner conflict. Make the feeling legible without becoming melodramatic.
```

### Stephen King

```txt
Write with plainspoken immediacy, vivid sensory detail, and the sense that ordinary life could tilt strange at any second. Stay lucid and human, not campy.
```

## Mood Dial Guidance

Use five bands internally. The UI can still expose a 0-100 slider, but the prompt behavior should bucket into five strong modes.

### Why

Continuous numeric prompts look sophisticated but mostly create fuzzy outputs. Banding keeps the interaction expressive and the prompt understandable.

## Sample Mood Text Format

```txt
Mood dial: 72% mythic.
Band: battle-song.
Instruction: give the prose heroic lift, stronger rhythm, grave stakes, and a hint of legend. Keep it clear.
```

## Output Quality Rules

Add a small post-processing cleanup pass in code:

- trim whitespace
- collapse repeated blank lines
- strip enclosing quotes when obvious

Do not aggressively normalize punctuation. Slight stylistic edge is part of the product.

## Surprise Me Logic

`Surprise Me` should feel curated, not random-noisy.

Rules:

1. Sample from a hand-picked set of strong demo inputs
2. Bias toward more dramatic author/mood combinations
3. Avoid repeating the current author when possible
4. Avoid always selecting mid-range moods

Recommended weighting:

- low moods: 20%
- mid moods: 30%
- high moods: 50%

Reason:

Higher moods produce more visibly transformed outputs, which is better for demo impact.

## Suggested Demo Inputs

Add 6 to 10 samples total. The best samples are:

- slightly awkward
- emotionally legible
- semantically simple
- visibly transformable in one pass

Strong categories:

- hedging email
- awkward social moment
- founder advice
- breakup text
- product launch blurb
- apology note
- passive-aggressive work message
- overlong bio

## Prompt Guardrails

Because this is a portfolio artifact, strong safe defaults matter more than prompt maximalism.

Rules:

- keep rewrites under the existing length limit
- reject empty or trivial input
- preserve the current abuse protection model
- do not attempt chain-of-thought exposure or hidden rationale generation

## Future-Proofing Note

If the project later swaps public-author voices for original archetypes, the system prompt architecture can stay the same. Only the author base prompts and UI metadata need to change.
