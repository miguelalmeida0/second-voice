"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, CheckCircle2, Copy, FlaskConical, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RewriteLabScoreCard } from "@/components/ghostwriter/RewriteLabScoreCard";
import { RewriteLabTrace } from "@/components/ghostwriter/RewriteLabTrace";
import {
  isRecoverableSessionError,
  issueGhostwriterChallenge,
  readGhostwriterCsrfToken,
  refreshGhostwriterShieldSession,
} from "@/lib/ghostwriter-client-guard";
import type { AuthorId } from "@/lib/ghostwriter-shared";
import type {
  RewriteLabPayload,
  RewriteLabResponse,
  RewriteLabWinnerSelection,
} from "@/lib/ghostwriter-lab-shared";

const LAB_STAGES = [
  {
    detail: "Faithful, expressive, and compressed candidates run in parallel.",
    title: "Generating three candidate rewrites",
  },
  {
    detail: "The evaluator grades meaning, voice, readability, spark, and risk.",
    title: "Scoring the candidates",
  },
  {
    detail: "The app applies deterministic weights instead of trusting vibes.",
    title: "Selecting the strongest version",
  },
  {
    detail: "Provider, model, schema, latency, winner, and fallback are recorded.",
    title: "Building the technical trace",
  },
] as const;
const LAB_STAGE_SCHEDULE_MS = [1200, 3200, 5200] as const;
const LAB_CLIENT_TIMEOUT_MS = 45_000;

type LabState =
  | { error: string | null; lab: null; runId: null; status: "idle"; stage: number }
  | { error: null; lab: null; runId: number; status: "loading"; stage: number }
  | { error: string; lab: null; runId: number; status: "error"; stage: number }
  | { error: null; lab: RewriteLabPayload; runId: number; status: "success"; stage: number };

async function requestRewriteLab({
  author,
  baselineRewrite,
  mood,
  signal,
  source,
}: {
  author: AuthorId;
  baselineRewrite: string;
  mood: number;
  signal: AbortSignal;
  source: string;
}): Promise<RewriteLabPayload> {
  let csrfToken = readGhostwriterCsrfToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (!csrfToken) {
        throw new Error("Protection cookies are missing. Refresh the page and try again.");
      }

      const challenge = await issueGhostwriterChallenge(csrfToken, { signal });
      const response = await fetch("/api/ghostwriter/lab", {
        body: JSON.stringify({
          author,
          baselineRewrite,
          challengeNonce: challenge.challengeNonce,
          challengeToken: challenge.challengeToken,
          mood,
          source,
        }),
        headers: {
          "content-type": "application/json",
          "x-ghostwriter-csrf": csrfToken,
        },
        method: "POST",
        signal,
      });
      const payload = (await response.json()) as RewriteLabResponse;

      if (!response.ok || payload.error || !payload.lab) {
        throw new Error(payload.error || "Rewrite Lab could not finish this run.");
      }

      return payload.lab;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rewrite Lab could not finish.";

      if (attempt === 0 && isRecoverableSessionError(message)) {
        csrfToken = await refreshGhostwriterShieldSession({ signal });

        if (csrfToken) {
          continue;
        }
      }

      throw error;
    }
  }

  throw new Error("Rewrite Lab could not finish this run.");
}

function getLabErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Rewrite Lab took too long to finish. The original rewrite is still available.";
  }

  return error instanceof Error
    ? error.message
    : "Rewrite Lab could not finish this run. The original rewrite is still available.";
}

async function writeClipboardText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

export function RewriteLabPanel({
  author,
  baselineRewrite,
  mood,
  onUseWinner,
  open,
  runId,
  source,
}: {
  author: AuthorId;
  baselineRewrite: string;
  mood: number;
  onUseWinner?: (selection: RewriteLabWinnerSelection) => void;
  open: boolean;
  runId: number;
  source: string;
}) {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<LabState>({
    error: null,
    lab: null,
    runId: null,
    stage: 0,
    status: "idle",
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const [copiedWinnerRunId, setCopiedWinnerRunId] = useState<number | null>(null);
  const activeLabKeyRef = useRef<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const stageTimersRef = useRef<number[]>([]);
  const currentStage = LAB_STAGES[Math.min(state.stage, LAB_STAGES.length - 1)];
  const winner =
    state.status === "success"
      ? state.lab.candidates.find((candidate) => candidate.id === state.lab.winnerId)
      : null;
  const winnerCopied = Boolean(winner && copiedWinnerRunId === runId);
  const emptyMessage =
    !source || !baselineRewrite
      ? "Run a rewrite first. Then the lab can generate alternatives, score them, and show why one version wins."
      : null;

  useEffect(() => {
    if (!open || emptyMessage) {
      return;
    }

    const labKey = JSON.stringify([runId, author, mood, source, baselineRewrite]);

    if (activeLabKeyRef.current === labKey) {
      return;
    }

    activeLabKeyRef.current = labKey;
    let cancelled = false;
    let didFinish = false;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, LAB_CLIENT_TIMEOUT_MS);

    function clearStageTimers() {
      for (const timerId of stageTimersRef.current) {
        window.clearTimeout(timerId);
      }

      stageTimersRef.current = [];
    }

    function scheduleStage(stage: number, delay: number) {
      stageTimersRef.current.push(
        window.setTimeout(() => {
          setState((current) => {
            if (current.status !== "loading" || current.runId !== runId) {
              return current;
            }

            return {
              ...current,
              stage,
            };
          });
        }, delay),
      );
    }

    async function runLab() {
      clearStageTimers();
      setState({
        error: null,
        lab: null,
        runId,
        stage: 0,
        status: "loading",
      });

      LAB_STAGE_SCHEDULE_MS.forEach((delay, index) => {
        scheduleStage(index + 1, delay);
      });

      try {
        const lab = await requestRewriteLab({
          author,
          baselineRewrite,
          mood,
          signal: abortController.signal,
          source,
        });

        if (cancelled) {
          return;
        }

        didFinish = true;
        setState({
          error: null,
          lab,
          runId,
          stage: LAB_STAGES.length - 1,
          status: "success",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        didFinish = true;
        activeLabKeyRef.current = null;
        setState({
          error: getLabErrorMessage(error),
          lab: null,
          runId,
          stage: 0,
          status: "error",
        });
      } finally {
        clearStageTimers();
        window.clearTimeout(timeoutId);
      }
    }

    void runLab();

    return () => {
      cancelled = true;
      abortController.abort();
      clearStageTimers();
      window.clearTimeout(timeoutId);

      if (!didFinish && activeLabKeyRef.current === labKey) {
        activeLabKeyRef.current = null;
      }
    };
  }, [author, baselineRewrite, emptyMessage, mood, open, retryNonce, runId, source]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function retryLab() {
    activeLabKeyRef.current = null;
    setRetryNonce((current) => current + 1);
  }

  async function copyWinner() {
    if (!winner) {
      return;
    }

    await writeClipboardText(winner.rewrite);
    setCopiedWinnerRunId(runId);

    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }

    copyTimerRef.current = window.setTimeout(() => setCopiedWinnerRunId(null), 1600);
  }

  function useWinner() {
    if (!winner) {
      return;
    }

    onUseWinner?.({
      artifactToken: winner.artifactToken,
      label: winner.label,
      overall: winner.scores.overall,
      reason: state.status === "success" ? state.lab.selectionReason : "",
      rewrite: winner.rewrite,
    });
  }

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          className="gw-lab-panel"
          aria-busy={state.status === "loading"}
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: reducedMotion ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="gw-lab-header">
            <div>
              <p className="gw-lab-kicker">Rewrite Lab</p>
              <h4>The app tries three human directions, then picks one.</h4>
            </div>
            <FlaskConical className="h-5 w-5" aria-hidden />
          </header>

          {state.status === "loading" ? (
            <div className="gw-lab-loading" aria-live="polite" role="status">
              <div className="gw-lab-progress" data-stage={state.stage}>
                <div className="gw-lab-progress-meta">
                  <span>Lab running</span>
                  <strong>Step {Math.min(state.stage + 1, LAB_STAGES.length)} of {LAB_STAGES.length}</strong>
                </div>
                <div className="gw-lab-progress-track" aria-hidden>
                  <span className="gw-lab-progress-bar" />
                </div>
              </div>

              <div className="gw-lab-current-stage">
                <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                <div>
                  <p>{currentStage.title}</p>
                  <span>{currentStage.detail}</span>
                </div>
              </div>

              <div className="gw-lab-stage-list">
                {LAB_STAGES.map((stage, index) => (
                  <div
                    key={stage.title}
                    className="gw-lab-stage"
                    data-active={index <= state.stage}
                    data-complete={index < state.stage}
                    data-current={index === state.stage}
                  >
                    {index < state.stage ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    ) : index === state.stage ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <span aria-hidden />
                    )}
                    <p>{stage.title}</p>
                  </div>
                ))}
              </div>

              {state.stage === LAB_STAGES.length - 1 ? (
                <p className="gw-lab-loading-note">
                  Still working. The lab is waiting on the versions and scorecard.
                </p>
              ) : null}
            </div>
          ) : null}

          {emptyMessage ? (
            <div className="gw-lab-error" role="status">
              <AlertCircle className="h-4 w-4" aria-hidden />
              <div className="gw-lab-error-copy">
                <p>{emptyMessage}</p>
              </div>
            </div>
          ) : null}

          {!emptyMessage && state.status === "error" ? (
            <div className="gw-lab-error" role="status">
              <AlertCircle className="h-4 w-4" aria-hidden />
              <div className="gw-lab-error-copy">
                <p>{state.error}</p>
                <button type="button" className="gw-lab-retry" onClick={retryLab}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Try Rewrite Lab again
                </button>
              </div>
            </div>
          ) : null}

          {state.status === "success" ? (
            <div className="gw-lab-result" aria-live="polite">
              <section className="gw-lab-winner" aria-label="Rewrite Lab winner">
                <p className="gw-lab-winner-label">
                  Picked: {winner?.label ?? "winner"} · {winner?.scores.overall ?? "--"} overall
                </p>
                <h5>{state.lab.selectionReason}</h5>
                {winner ? <p className="gw-lab-winner-rewrite">{winner.rewrite}</p> : null}
                {winner ? (
                  <div className="gw-lab-winner-actions">
                    {onUseWinner ? (
                      <button type="button" className="gw-lab-action-primary" onClick={useWinner}>
                        <Check className="h-4 w-4" aria-hidden />
                        Use this version
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="gw-lab-action-secondary"
                      onClick={() => void copyWinner()}
                    >
                      {winnerCopied ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                      {winnerCopied ? "Copied" : "Copy winner"}
                    </button>
                  </div>
                ) : null}
              </section>

              <section className="gw-lab-comparison" aria-label="Candidate comparison">
                {state.lab.candidates.map((candidate) => (
                  <RewriteLabScoreCard
                    key={candidate.id}
                    candidate={candidate}
                    winnerId={state.lab.winnerId}
                  />
                ))}
              </section>

              <RewriteLabTrace trace={state.lab.trace} />
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
