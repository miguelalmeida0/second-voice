# Second Voice
**A privacy-conscious rewrite product with explicit model routing, abuse protection, opt-in public sharing, and a production-oriented security boundary.**

[Live Second Voice ↗](https://secondvoice-ai.vercel.app/second-voice) *(external — leaves GitHub)*



Second Voice is built around a deceptively hard product problem: rewriting text feels simple until the application has to protect user content, prevent abuse, handle multiple model providers, support sharing, and remain observable without logging the text itself.

## Product flow

```mermaid
flowchart LR
  subgraph Browser["01 · Browser"]
    WRITE(["Write or paste text"]):::actor
    SESSION["Signed browser session"]:::guard
  end

  subgraph Trust["02 · Request trust boundary"]
    ORIGIN{"Origin + CSRF valid?"}:::decision
    LIMIT["Proof-of-work<br/>+ durable rate limits"]:::guard
    BLOCK(["Reject request"]):::private
  end

  subgraph Rewrite["03 · Rewrite engine"]
    ROUTE[["Explicit provider routing"]]:::system
    MODEL["Selected model provider"]:::system
    RESULT(["Schema-validated rewrite"]):::actor
  end

  subgraph Outcome["04 · User-controlled outcome"]
    KEEP[("Private result")]:::private
    SHARE(["Public-safe artifact"]):::safe
    FEEDBACK[("Metadata-only feedback")]:::data
  end

  WRITE --> SESSION --> ORIGIN
  ORIGIN -- "no" --> BLOCK
  ORIGIN -- "yes" --> LIMIT --> ROUTE --> MODEL --> RESULT
  RESULT -- "keep private" --> KEEP
  RESULT -- "share explicitly" --> SHARE
  RESULT -- "rate / report" --> FEEDBACK

  style Browser fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1px
  style Trust fill:#FFF7ED,stroke:#FED7AA,stroke-width:1px
  style Rewrite fill:#ECFEFF,stroke:#A5F3FC,stroke-width:1px
  style Outcome fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1px
  classDef actor fill:#E8F1FF,stroke:#2563EB,color:#0F172A,stroke-width:1.6px;
classDef system fill:#ECFEFF,stroke:#0891B2,color:#0F172A,stroke-width:1.6px;
classDef decision fill:#FFFBEB,stroke:#D97706,color:#0F172A,stroke-width:1.6px;
classDef guard fill:#FFF7ED,stroke:#EA580C,color:#0F172A,stroke-width:1.6px;
classDef safe fill:#ECFDF5,stroke:#059669,color:#0F172A,stroke-width:1.6px;
classDef private fill:#FFF1F2,stroke:#E11D48,color:#0F172A,stroke-width:1.6px;
classDef data fill:#F8FAFC,stroke:#64748B,color:#0F172A,stroke-width:1.6px;
linkStyle default stroke:#94A3B8,stroke-width:1.5px;
```

## Security architecture

```mermaid
flowchart TB
  USER(["Next.js client"]):::actor

  subgraph Server["Server trust boundary"]
    SESSION["Signed session"]:::guard
    GATE{"Origin · CSRF · abuse checks"}:::decision
    API[["Protected server routes"]]:::system
    PROVIDER["Explicit inference provider"]:::system
    VALIDATED["Validated model response"]:::safe
  end

  subgraph Data["Data boundary"]
    ABUSE[("Shared abuse state")]:::guard
    PRIVATE[("Private rewrite data")]:::private
    PUBLIC[("Public-safe view")]:::safe
    META[("Metadata-only telemetry")]:::data
  end

  USER --> SESSION --> GATE --> API
  GATE --> ABUSE
  API --> PROVIDER --> VALIDATED --> API
  API --> PRIVATE
  API --> PUBLIC
  API --> META

  style Server fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1px
  style Data fill:#F8FAFC,stroke:#CBD5E1,stroke-width:1px
  classDef actor fill:#E8F1FF,stroke:#2563EB,color:#0F172A,stroke-width:1.6px;
classDef system fill:#ECFEFF,stroke:#0891B2,color:#0F172A,stroke-width:1.6px;
classDef decision fill:#FFFBEB,stroke:#D97706,color:#0F172A,stroke-width:1.6px;
classDef guard fill:#FFF7ED,stroke:#EA580C,color:#0F172A,stroke-width:1.6px;
classDef safe fill:#ECFDF5,stroke:#059669,color:#0F172A,stroke-width:1.6px;
classDef private fill:#FFF1F2,stroke:#E11D48,color:#0F172A,stroke-width:1.6px;
classDef data fill:#F8FAFC,stroke:#64748B,color:#0F172A,stroke-width:1.6px;
linkStyle default stroke:#94A3B8,stroke-width:1.5px;
```

### Explicit provider routing

The server chooses the configured provider intentionally. It does not silently hop between model vendors when one fails, which keeps cost, behavior, and data routing inspectable.

### Public sharing is opt-in

A rewrite is not public merely because a share feature exists. Public visibility requires an explicit user action and server-side allowance.

### Public readers never query the base table directly

Shared pages read through a constrained public view. Source text is masked by default and only exposed when an explicit source-visibility decision exists.

### Abuse state is durable

Production rate limiting and challenge replay protection use a shared Supabase-backed store rather than per-instance memory.

### Observability without content logging

Quality telemetry records request-scoped metadata such as provider/model, latency, schema/fallback behavior and feedback outcomes without logging prompt or rewrite text.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Zod
- Supabase
- server-side model providers

## Protected request path

Representative server surfaces:

```text
/api/ghostwriter/challenge
/api/ghostwriter
/api/ghostwriter/lab
/api/ghostwriter/share
/api/ghostwriter/feedback
```

State-changing/model routes enforce same-origin checks, CSRF, signed sessions, proof-of-work, layered rate limits, and replay protection.

## Data model principles

```mermaid
flowchart LR
  PRIVATE[("Private rewrite<br/>source + output + metadata")]:::private
  DECIDE{"Explicit share?"}:::decision
  STAY(["Remain private"]):::private
  PUBLIC[("Public-safe view<br/>source hidden by default")]:::safe
  FEEDBACK[("Feedback metadata<br/>request id · rating · provider · hash")]:::data

  PRIVATE --> DECIDE
  DECIDE -- "no" --> STAY
  DECIDE -- "yes" --> PUBLIC
  PRIVATE -. "no content copied" .-> FEEDBACK

  classDef actor fill:#E8F1FF,stroke:#2563EB,color:#0F172A,stroke-width:1.6px;
classDef system fill:#ECFEFF,stroke:#0891B2,color:#0F172A,stroke-width:1.6px;
classDef decision fill:#FFFBEB,stroke:#D97706,color:#0F172A,stroke-width:1.6px;
classDef guard fill:#FFF7ED,stroke:#EA580C,color:#0F172A,stroke-width:1.6px;
classDef safe fill:#ECFDF5,stroke:#059669,color:#0F172A,stroke-width:1.6px;
classDef private fill:#FFF1F2,stroke:#E11D48,color:#0F172A,stroke-width:1.6px;
classDef data fill:#F8FAFC,stroke:#64748B,color:#0F172A,stroke-width:1.6px;
linkStyle default stroke:#94A3B8,stroke-width:1.5px;
```

## Verification

```bash
npm run security:check
npm run test:release:gate
npm run test:security
npm run test:scroll
npx tsc --noEmit
npm run lint
npm run build
```

## Run locally

```bash
git clone https://github.com/miguelalmeida0/second-voice.git
cd second-voice
npm install
npm run dev
```

Copy the example environment and configure only the providers/services you intend to use. Never commit provider keys or Supabase service-role credentials.

## What this project demonstrates

- secure browser → server inference design;
- explicit AI provider routing;
- durable abuse prevention;
- privacy-preserving public artifacts;
- schema-validated model outputs;
- product analytics without storing user content;
- migration discipline around public/private data boundaries.

---

Built by [Miguel Almeida](https://github.com/miguelalmeida0).


[Repository guide](./docs/START_HERE.md)

<!-- repository-presentation-repair:1 -->
