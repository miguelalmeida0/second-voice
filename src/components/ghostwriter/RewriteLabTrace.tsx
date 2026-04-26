"use client";

import type { RewriteLabTrace as RewriteLabTracePayload } from "@/lib/ghostwriter-lab-shared";

function ms(value: number | null) {
  return value === null ? "n/a" : `${value}ms`;
}

export function RewriteLabTrace({ trace }: { trace: RewriteLabTracePayload }) {
  const rows = [
    ["Provider", trace.provider],
    ["Model", trace.model],
    ["Generator profile", trace.generatorPromptProfile],
    ["Evaluator rubric", trace.evaluatorRubricVersion],
    ["Candidates", String(trace.candidateCount)],
    ["Generation", ms(trace.generationLatencyMs)],
    ["Evaluation", ms(trace.evaluationLatencyMs)],
    ["Total", ms(trace.totalLatencyMs)],
    ["Schema", trace.schemaValidation],
    ["Winner", trace.winner],
    ["Fallback", trace.fallbackBehavior],
  ] as const;

  return (
    <details className="gw-lab-trace">
      <summary>
        <span>Trace</span>
        <small>
          Product contract around sampling, evaluation, schema validation, and fallback behavior.
        </small>
      </summary>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
