"use client";

import {
  REWRITE_LAB_SHORT_DESCRIPTIONS,
  type RewriteLabCandidate,
  type RewriteLabCandidateId,
} from "@/lib/ghostwriter-lab-shared";

function riskTone(risk: RewriteLabCandidate["scores"]["overreachRisk"]) {
  return risk === "low" ? "quiet" : risk === "medium" ? "watch" : "hot";
}

export function RewriteLabScoreCard({
  candidate,
  winnerId,
}: {
  candidate: RewriteLabCandidate;
  winnerId: RewriteLabCandidateId;
}) {
  const selected = candidate.id === winnerId;

  return (
    <article className="gw-lab-score-card" data-selected={selected}>
      <div className="gw-lab-score-main">
        <div>
          <div className="gw-lab-score-title-row">
            <h5>{candidate.label}</h5>
            {selected ? <span>Picked</span> : null}
          </div>
          <p>{REWRITE_LAB_SHORT_DESCRIPTIONS[candidate.id]}</p>
        </div>
        <strong>{candidate.scores.overall}</strong>
      </div>

      <div className="gw-lab-score-metrics" aria-label={`${candidate.label} rubric scores`}>
        <span>
          <b>Meaning</b>
          {candidate.scores.meaningPreservation}
        </span>
        <span>
          <b>Voice</b>
          {candidate.scores.voiceMatch}
        </span>
        <span>
          <b>Clarity</b>
          {candidate.scores.readability}
        </span>
        <span>
          <b>Spark</b>
          {candidate.scores.surprise}
        </span>
        <span data-risk={riskTone(candidate.scores.overreachRisk)}>
          <b>Risk</b>
          {candidate.scores.overreachRisk}
        </span>
      </div>

      <p className="gw-lab-evaluator-note">{candidate.evaluatorNote}</p>

      <details className="gw-lab-candidate-details">
        <summary>Read this version</summary>
        <p>{candidate.rewrite}</p>
      </details>
    </article>
  );
}
