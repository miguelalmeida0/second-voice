"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FlaskConical,
  LoaderCircle,
  RotateCcw,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Author } from "@/components/ghostwriter/AuthorOrbital";
import { diffWords, type DiffOp } from "@/components/ghostwriter/diff";
import {
  RewriteFeedbackPanel,
  type RewriteFeedbackSubmission,
} from "@/components/ghostwriter/RewriteFeedbackPanel";
import type { RewriteLabWinnerSelection } from "@/lib/ghostwriter-lab-shared";
import { MOOD_NAME, type RewriteMode } from "@/lib/ghostwriter-shared";

const RewriteLabPanel = dynamic(
  () =>
    import("@/components/ghostwriter/RewriteLabPanel").then(
      (module) => module.RewriteLabPanel,
    ),
  { loading: () => null },
);

export type RewritePlaybackPhase =
  | "idle"
  | "requesting"
  | "prelude"
  | "animating"
  | "complete"
  | "error";

export type RewritePlaybackProvenance = {
  label: string;
  overall: number;
  reason: string;
  source: "rewrite-lab";
};
export type RewriteShareLink = {
  href: string;
  shortId: string;
};
type RewriteShareStatus =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "saving" }
  | { href: string; kind: "ready"; shortId: string }
  | { kind: "error"; message: string };

type PlaybackUnit = {
  cut: boolean;
  id: string;
  kind: DiffOp["kind"];
  text: string;
  visible: boolean;
};

type PlaybackEvent = {
  ids: string[];
  kind: "cut" | "insert";
};

type PlaybackTimeline = {
  events: PlaybackEvent[];
  initialUnits: PlaybackUnit[];
  stepMs: number;
};

function reviewedLine(author: Author, mode: RewriteMode, outcomeLabel: string) {
  if (mode === "outcome") {
    return `Second Voice optimized the draft for ${outcomeLabel.toLowerCase()}.`;
  }

  return `${author.name} reviewed your draft and handed back this version.`;
}

function chunkText(text: string): string[] {
  if (text.length <= 28) {
    return [text];
  }

  const punctuated = text.match(/[^,;:.!?]+[,:;.!?]*\s*|.+/g) ?? [text];
  const chunks: string[] = [];
  let buffer = "";

  for (const piece of punctuated) {
    if ((buffer + piece).length <= 30) {
      buffer += piece;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      buffer = "";
    }

    if (piece.length <= 34) {
      buffer = piece;
      continue;
    }

    const words = piece.match(/\S+\s*|\s+/g) ?? [piece];
    let sentence = "";

    for (const word of words) {
      if ((sentence + word).length <= 24) {
        sentence += word;
        continue;
      }

      if (sentence) {
        chunks.push(sentence);
      }

      sentence = word;
    }

    if (sentence) {
      buffer = sentence;
    }
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks.filter(Boolean);
}

function buildPlaybackTimeline(
  source: string,
  result: string,
  playbackRate = 1,
): PlaybackTimeline {
  const ops = diffWords(source, result);
  const initialUnits: PlaybackUnit[] = [];
  const events: PlaybackEvent[] = [];
  let unitIndex = 0;

  for (const op of ops) {
    const chunks = op.kind === "equal" ? [op.text] : chunkText(op.text);
    const ids: string[] = [];

    for (const text of chunks) {
      const id = `playback-${unitIndex}`;
      unitIndex += 1;
      ids.push(id);
      initialUnits.push({
        cut: false,
        id,
        kind: op.kind,
        text,
        visible: op.kind !== "insert",
      });
    }

    if (op.kind === "delete") {
      events.push({ ids, kind: "cut" });
    }

    if (op.kind === "insert") {
      events.push({ ids, kind: "insert" });
    }
  }

  const safePlaybackRate = Math.max(0.5, Math.min(3, playbackRate));
  const targetDuration =
    Math.min(5000, Math.max(1800, 1000 + events.length * 110)) /
    safePlaybackRate;
  const stepMs = Math.max(80, Math.min(180, Math.floor(targetDuration / Math.max(events.length, 1))));

  return { events, initialUnits, stepMs };
}

function applyEvent(units: PlaybackUnit[], event: PlaybackEvent): PlaybackUnit[] {
  return units.map((unit) => {
    if (!event.ids.includes(unit.id)) {
      return unit;
    }

    if (event.kind === "cut") {
      return { ...unit, cut: true };
    }

    return { ...unit, visible: true };
  });
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

function playbackMessage(
  phase: RewritePlaybackPhase,
  author: Author | null,
  mode: RewriteMode,
  outcomeLabel: string,
) {
  if (!author && mode === "author") {
    return "Choose an author, then run a rewrite and the edit will happen here.";
  }

  switch (phase) {
    case "requesting":
      if (mode === "outcome") {
        return `Reading for ${outcomeLabel.toLowerCase()} while preserving your meaning.`;
      }
      return `Locking the draft and reading for ${author?.first.toLowerCase() ?? "the selected voice"} rhythm.`;
    case "prelude":
      if (mode === "outcome") {
        return "Second Voice is tightening the line around the goal.";
      }
      return `${author?.first ?? "The selected voice"} is taking a pass at the line.`;
    case "animating":
      return `The rewrite is happening in front of you, cut by cut.`;
    case "complete":
      return author
        ? reviewedLine(author, mode, outcomeLabel)
        : `Second Voice optimized the draft for ${outcomeLabel.toLowerCase()}.`;
    case "error":
      return "The edit could not be completed.";
    default:
      return mode === "outcome"
        ? "Choose an outcome, run a rewrite, and the edit will happen here."
        : "Run a rewrite and the edit will happen here, line by line, like it's being worked on in front of you.";
  }
}

export function RewritePlayback({
  author,
  error,
  errorRequestId,
  loading,
  loadingLabel,
  mode = "author",
  mood,
  moodLabel,
  onApplyRewrite,
  onPhaseChange,
  playbackRate = 1,
  onRetry,
  onShareRewrite,
  onSubmitFeedback,
  outcomeLabel = "Improve clarity",
  provenance,
  result,
  runId,
  source,
}: {
  author: Author | null;
  error: string | null;
  errorRequestId?: string | null;
  loading: boolean;
  loadingLabel: string;
  mode?: RewriteMode;
  mood: number;
  moodLabel: string;
  onApplyRewrite?: (selection: RewriteLabWinnerSelection) => void;
  onPhaseChange?: (phase: RewritePlaybackPhase) => void;
  playbackRate?: number;
  onRetry?: () => void;
  onShareRewrite?: () => Promise<RewriteShareLink>;
  onSubmitFeedback?: (submission: RewriteFeedbackSubmission) => Promise<void>;
  outcomeLabel?: string;
  provenance?: RewritePlaybackProvenance | null;
  result: string;
  runId: number;
  source: string;
}) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<RewritePlaybackPhase>("idle");
  const [units, setUnits] = useState<PlaybackUnit[]>([]);
  const [copiedRunId, setCopiedRunId] = useState<number | null>(null);
  const [labRunId, setLabRunId] = useState<number | null>(null);
  const [shareState, setShareState] = useState<{ runId: number; status: RewriteShareStatus }>({
    runId,
    status: { kind: "idle" },
  });
  const timerRef = useRef<number[]>([]);
  const copyTimerRef = useRef<number | null>(null);
  const shareStatus: RewriteShareStatus =
    shareState.runId === runId ? shareState.status : { kind: "idle" };
  const moodStatus =
    mode === "outcome"
      ? `Outcome · ${outcomeLabel}`
      : author
        ? `${mood}% ${MOOD_NAME[author.id]} · ${moodLabel}`
        : "Pick an author first";
  const canCopy = result.trim().length > 0;
  const visiblePhase: RewritePlaybackPhase = error ? "error" : loading ? "requesting" : phase;
  const canShare = visiblePhase === "complete" && Boolean(onShareRewrite) && canCopy && Boolean(source);
  const copied = canCopy && copiedRunId === runId;

  function schedule(callback: () => void, delay = 0) {
    timerRef.current.push(window.setTimeout(callback, delay));
  }

  useEffect(() => {
    for (const timeout of timerRef.current) {
      window.clearTimeout(timeout);
    }
    timerRef.current = [];

    if (error) {
      schedule(() => {
        setPhase("error");
        setUnits([]);
      });
      return;
    }

    if (loading) {
      schedule(() => {
        setPhase("requesting");
        setUnits([]);
      });
      return;
    }

    if (!source || !result) {
      schedule(() => {
        setPhase("idle");
        setUnits([]);
      });
      return;
    }

    const timeline = buildPlaybackTimeline(source, result, playbackRate);

    if (reducedMotion || timeline.events.length === 0) {
      schedule(() => {
        setUnits(timeline.initialUnits.map((unit) => ({ ...unit, cut: true, visible: true })));
        setPhase("complete");
      });
      return;
    }

    schedule(() => {
      setUnits(timeline.initialUnits);
      setPhase("prelude");

      schedule(() => {
        setPhase("animating");

        timeline.events.forEach((event, eventIndex) => {
          schedule(() => {
            setUnits((current) => applyEvent(current, event));

            if (eventIndex === timeline.events.length - 1) {
              schedule(() => setPhase("complete"), 320);
            }
          }, eventIndex * timeline.stepMs);
        });
      }, 420);
    });

    return () => {
      for (const timeout of timerRef.current) {
        window.clearTimeout(timeout);
      }
      timerRef.current = [];
    };
  }, [error, loading, playbackRate, reducedMotion, result, runId, source]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const showSkip = visiblePhase === "prelude" || visiblePhase === "animating";
  const canOpenLab =
    mode === "author" && visiblePhase === "complete" && Boolean(author) && canCopy && Boolean(source);
  const labOpen = canOpenLab && labRunId === runId;

  async function copyResult() {
    if (!canCopy) {
      return;
    }

    await writeClipboardText(result);
    setCopiedRunId(runId);

    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }

    copyTimerRef.current = window.setTimeout(() => setCopiedRunId(null), 1600);
  }

  async function createPublicLink() {
    if (!onShareRewrite || !canShare) {
      return;
    }

    setShareState({ runId, status: { kind: "saving" } });

    try {
      const link = await onShareRewrite();
      const absoluteUrl = new URL(link.href, window.location.origin).toString();

      await writeClipboardText(absoluteUrl);
      setShareState({ runId, status: { ...link, kind: "ready" } });
    } catch (shareError) {
      setShareState({
        runId,
        status: {
          kind: "error",
          message: shareError instanceof Error ? shareError.message : "The public link could not be created.",
        },
      });
    }
  }

  function skipAnimation() {
    for (const timeout of timerRef.current) {
      window.clearTimeout(timeout);
    }
    timerRef.current = [];
    setUnits(
      buildPlaybackTimeline(source, result, playbackRate).initialUnits.map((unit) => ({
        ...unit,
        cut: true,
        visible: true,
      })),
    );
    setPhase("complete");
  }

  function useLabRewrite(selection: RewriteLabWinnerSelection) {
    onApplyRewrite?.(selection);
    setLabRunId(null);
  }

  return (
    <div className="gw-card-strong p-6 sm:p-7 lg:p-8" data-mode={mode} data-voice={author?.id}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="gw-voice-text font-playfair text-[1.08rem] font-medium tracking-[-0.015em] sm:text-[1.14rem]">
            {visiblePhase === "complete" && mode === "outcome"
              ? "Outcome edit"
              : visiblePhase === "complete" && author
                ? `${author.first}'s edit`
                : "Live rewrite"}
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--mist)] sm:text-[13px]">
            The rewrite appears here after you run it.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="gw-rewrite-mood" aria-label={moodStatus}>
            {moodStatus}
          </p>
          {showSkip && (
            <button type="button" onClick={skipAnimation} className="gw-chip">
              Skip animation
            </button>
          )}
          {canOpenLab && (
            <button
              type="button"
              className="gw-lab-open-button"
              aria-expanded={labOpen}
              onClick={() => setLabRunId((current) => (current === runId ? null : runId))}
            >
              {labOpen ? "Close Rewrite Lab" : "Open Rewrite Lab"}
            </button>
          )}
        </div>
      </div>

      <div
        className="gw-playback-panel relative mt-5 min-h-[15rem] rounded-[12px] border p-4 pr-14 text-[17px] leading-[1.7] sm:p-5 sm:pr-16 sm:text-[18px]"
        aria-busy={loading}
        aria-live="polite"
      >
        <button
          type="button"
          onClick={() => void copyResult()}
          disabled={!canCopy}
          aria-label={copied ? "Rewrite copied" : "Copy rewrite"}
          className="gw-copy-result"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>
        {!error && visiblePhase === "requesting" ? (
          <div
            className="gw-playback-panel gw-loading-panel relative overflow-hidden rounded-[10px] border p-4 sm:p-5"
            role="status"
          >
            <motion.div
              aria-hidden
              className="gw-rewrite-scan pointer-events-none absolute inset-x-4 top-2 h-20 rounded-full blur-3xl"
              animate={{ y: ["-10%", "250%"], opacity: [0, 0.2, 0.12, 0] }}
              transition={{ duration: 2.1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />
            <div className="gw-loading-status">
              <LoaderCircle className="gw-loading-spinner h-5 w-5 animate-spin" aria-hidden />
              <div className="min-w-0">
                <p className="gw-loading-title">
                  {mode === "outcome"
                    ? `Optimizing for ${outcomeLabel.toLowerCase()}...`
                    : author
                      ? `Rewriting with ${author.first}...`
                      : `${loadingLabel} an author...`}
                </p>
                <p className="gw-loading-note">
                  {playbackMessage("requesting", author, mode, outcomeLabel)}
                </p>
              </div>
            </div>
            <div className="gw-loading-bars" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div className="gw-loading-source whitespace-pre-wrap text-[var(--ghost)]/88">
              {source ||
                `${loadingLabel} ${
                  mode === "outcome" ? outcomeLabel.toLowerCase() : (author?.first ?? "an author")
                }...`}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="gw-error-panel"
                role="alert"
              >
                <div className="gw-error-heading">
                  <AlertCircle className="h-5 w-5" aria-hidden />
                  <p>Rewrite did not finish</p>
                </div>
                <p className="gw-error-message">{error}</p>
                {errorRequestId ? (
                  <p className="gw-error-request">Request ID {errorRequestId}</p>
                ) : null}
                {onRetry ? (
                  <button type="button" className="gw-error-retry" onClick={onRetry}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Try again
                  </button>
                ) : null}
              </motion.div>
            )}

            {!error && visiblePhase === "idle" && (
              <div key="idle">
                <p className="text-[var(--whisper)]">
                  {playbackMessage("idle", author, mode, outcomeLabel)}
                </p>
              </div>
            )}

            {!error && (visiblePhase === "prelude" || visiblePhase === "animating") && (
              <motion.div
                key={`animating-${runId}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="gw-playback-panel relative overflow-hidden rounded-[10px] border p-4 sm:p-5"
              >
                <motion.div
                  aria-hidden
                  className="gw-rewrite-glow pointer-events-none absolute -left-24 top-1/2 h-28 w-44 -translate-y-1/2 rounded-full blur-3xl"
                  animate={{
                    x: visiblePhase === "prelude" ? ["0%", "230%"] : ["8%", "18%", "8%"],
                    opacity:
                      visiblePhase === "prelude" ? [0, 0.2, 0.12, 0] : [0.08, 0.12, 0.08],
                    scale: visiblePhase === "prelude" ? [0.96, 1.02, 0.98] : [1, 1.02, 1],
                  }}
                  transition={{
                    duration: visiblePhase === "prelude" ? 1.9 : 2.8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                  }}
                />
                {visiblePhase === "prelude" && (
                  <motion.div
                    aria-hidden
                    className="gw-rewrite-line pointer-events-none absolute inset-x-6 top-7 h-px"
                    animate={{ scaleX: [0.35, 1, 0.5], opacity: [0, 0.26, 0.08] }}
                    transition={{ duration: 1.9, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                  />
                )}
                <p className="mb-4 text-[12px] leading-relaxed text-[var(--mist)] sm:text-[13px]">
                  {playbackMessage(visiblePhase, author, mode, outcomeLabel)}
                </p>
                <div className="whitespace-pre-wrap text-[18px] leading-relaxed text-[var(--ghost)]">
                  {units.map((unit) => {
                    if (unit.kind === "insert" && !unit.visible) {
                      return null;
                    }

                    if (unit.kind === "equal") {
                      return <span key={unit.id}>{unit.text}</span>;
                    }

                    if (unit.kind === "delete") {
                      return (
                        <span
                          key={unit.id}
                          className="gw-deleted-text"
                          data-cut={unit.cut}
                        >
                          {unit.text}
                        </span>
                      );
                    }

                    return (
                      <span
                        key={unit.id}
                        className="gw-inserted-text font-playfair"
                      >
                        {unit.text}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {!error && visiblePhase === "complete" && (
              <motion.div
                key={result}
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
                }
              >
                <p className="mb-4 text-[12px] leading-relaxed text-[var(--mist)] sm:text-[13px]">
                  {playbackMessage("complete", author, mode, outcomeLabel)}
                </p>
                {provenance?.source === "rewrite-lab" ? (
                  <div
                    className="gw-rewrite-provenance"
                    aria-label={`Rewrite Lab pick: ${provenance.label}, ${provenance.overall} overall`}
                  >
                    <FlaskConical className="h-4 w-4" aria-hidden />
                    <span>Rewrite Lab pick</span>
                    <strong>{provenance.label}</strong>
                    <span>{provenance.overall} overall</span>
                  </div>
                ) : null}
                {provenance?.source === "rewrite-lab" && provenance.reason ? (
                  <p className="gw-rewrite-provenance-reason">{provenance.reason}</p>
                ) : null}
                <div className="gw-playback-panel-strong rounded-[10px] border p-4 sm:p-5">
                  <p className="whitespace-pre-wrap text-[18px] leading-relaxed text-[var(--ghost)]">
                    {result}
                  </p>
                </div>
                {onSubmitFeedback ? (
                  <RewriteFeedbackPanel
                    disabled={!canCopy}
                    onSubmit={onSubmitFeedback}
                    runId={runId}
                  />
                ) : null}
                {onShareRewrite ? (
                  <div className="gw-share-panel" data-state={shareStatus.kind}>
                    <div className="gw-share-copy">
                      <ShieldCheck className="h-4 w-4" aria-hidden />
                      <p>
                        Public links show this finished rewrite. The original text stays hidden.
                      </p>
                    </div>

                    {shareStatus.kind === "idle" ? (
                      <button
                        type="button"
                        className="gw-share-primary"
                        disabled={!canShare}
                        onClick={() => setShareState({ runId, status: { kind: "confirming" } })}
                      >
                        <Share2 className="h-4 w-4" aria-hidden />
                        Create public link
                      </button>
                    ) : null}

                    {shareStatus.kind === "confirming" ? (
                      <div className="gw-share-confirm">
                        <p>This will create a public permalink for the rewrite currently shown here.</p>
                        <div className="gw-share-actions">
                          <button type="button" className="gw-share-primary" onClick={() => void createPublicLink()}>
                            <Share2 className="h-4 w-4" aria-hidden />
                            Create link
                          </button>
                          <button
                            type="button"
                            className="gw-share-secondary"
                            onClick={() => setShareState({ runId, status: { kind: "idle" } })}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {shareStatus.kind === "saving" ? (
                      <div className="gw-share-status" role="status">
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                        Creating public link...
                      </div>
                    ) : null}

                    {shareStatus.kind === "ready" ? (
                      <div className="gw-share-status">
                        <Check className="h-4 w-4" aria-hidden />
                        <span>Public link copied.</span>
                        <a href={shareStatus.href} className="gw-share-open">
                          Open link
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </div>
                    ) : null}

                    {shareStatus.kind === "error" ? (
                      <div className="gw-share-error" role="alert">
                        <AlertCircle className="h-4 w-4" aria-hidden />
                        <span>{shareStatus.message}</span>
                        <button type="button" className="gw-share-secondary" onClick={() => void createPublicLink()}>
                          Try again
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {author && mode === "author" ? (
        <RewriteLabPanel
          author={author.id}
          baselineRewrite={result}
          mood={mood}
          onUseWinner={onApplyRewrite ? useLabRewrite : undefined}
          open={labOpen}
          runId={runId}
          source={source}
        />
      ) : null}
    </div>
  );
}
