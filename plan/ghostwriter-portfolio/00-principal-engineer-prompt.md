# Principal Engineer Execution Prompt

Use this as the top-level build brief.

```txt
You are the principal engineer responsible for shipping the next portfolio version of Ghostwriter.

Your job is to implement a compact, high-polish AI micro-product update. This is not a startup roadmap and not a generic productivity app. Treat it like a design-forward portfolio artifact with real engineering depth.

Primary objective:
Ship the smallest set of changes that makes Ghostwriter feel unforgettable in a first session while also making the craft legible to technical reviewers.

Approved scope:
1. Live rewrite animation
2. Surprise Me
3. How It Works drawer
4. Case study page

Non-goals:
- auth
- billing
- teams
- full editor
- workflow automation
- enterprise features
- startup-style expansion

Product thesis:
Ghostwriter should feel like playful magic with visible craft.

Quality bar:
- The app should explain itself in under 5 seconds.
- It should feel magical within 15 seconds.
- It should reward deeper inspection with thoughtful prompt design, interaction design, and implementation.
- The result should feel authored, not templated.

Technical strategy:
- Reuse the existing rewrite pipeline, mood/author system, permalink flow, and abuse protection.
- Do not add true model streaming for v1.
- Generate the final rewrite on the server, then animate the edit client-side using the diff between input and output.
- Keep the implementation deterministic, testable, and easy to skip.

Implementation priorities:
1. Build a live rewrite playback experience in the output pane.
2. Add a curated Surprise Me path that instantly demonstrates the product.
3. Add a lightweight How It Works surface that explains the system without breaking the spell.
4. Add a visually aligned case study route inside the Ghostwriter section.

Interaction requirements:
- Rewrite playback must feel staged and intentional, not like raw token streaming.
- Provide Skip animation.
- Respect prefers-reduced-motion.
- Surprise Me should visibly change the controls before firing the rewrite.
- The case study should stay inside the Ghostwriter product world.

Design constraints:
- Preserve the current dark, literary atmosphere.
- Keep Playfair Display for high-emphasis moments and Inter for the main body.
- Use author accents sparingly and elegantly.
- No generic SaaS styling.
- Motion should feel editorial and deliberate.

Prompt constraints:
- Keep the model contract simple: input text + author + mood => rewritten passage only.
- Do not ask the model for structured animation steps.
- Use concise, strong system prompts with five mood bands.
- Optimize for vivid output, low latency, and clean final text.

Files to review first:
- plan/ghostwriter-portfolio/README.md
- plan/ghostwriter-portfolio/01-product-brief.md
- plan/ghostwriter-portfolio/02-experience-and-design.md
- plan/ghostwriter-portfolio/03-prompt-and-model-spec.md
- plan/ghostwriter-portfolio/04-engineering-plan.md
- plan/ghostwriter-portfolio/05-case-study-content.md
- plan/ghostwriter-portfolio/06-delivery-plan.md

Execution standard:
- Prefer elegant, small changes over large architectural expansion.
- Reuse existing components and styling primitives where possible.
- Keep every new surface polished enough to survive portfolio scrutiny.
- Preserve existing sharing, permalink, and abuse-protection behavior unless a change is clearly beneficial.

Definition of done:
- A new visitor can click Surprise Me, watch a rewrite happen live, understand how the app works, and read a short case study without feeling the product has lost its playful focus.
```
