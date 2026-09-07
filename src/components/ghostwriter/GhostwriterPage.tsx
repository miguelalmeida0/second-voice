"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { BookOpen, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AUTHORS, AuthorOrbital } from "@/components/ghostwriter/AuthorOrbital";
import { HeroArtwork } from "@/components/ghostwriter/HeroArtwork";
import { MoodDial } from "@/components/ghostwriter/MoodDial";
import { OutcomeOptions } from "@/components/ghostwriter/OutcomeOptions";
import {
  RewritePlayback,
  type RewritePlaybackProvenance,
  type RewriteShareLink,
} from "@/components/ghostwriter/RewritePlayback";
import type { RewriteFeedbackSubmission } from "@/components/ghostwriter/RewriteFeedbackPanel";
import {
  GhostwriterRequestError,
  isRecoverableSessionError,
  issueGhostwriterChallenge,
  readGhostwriterCsrfToken,
  refreshGhostwriterShieldSession,
  requestIdFrom,
} from "@/lib/ghostwriter-client-guard";
import type { RewriteLabWinnerSelection } from "@/lib/ghostwriter-lab-shared";
import { PUBLIC_REWRITE_SHARE_CONSENT } from "@/lib/ghostwriter-share";
import {
  DEMO_PRESETS,
  DEFAULT_OUTCOME_ID,
  DEFAULT_REWRITE_MODE,
  OUTCOMES,
  SAMPLES,
  moodLabelFor,
  outcomeLabelFor,
  type AuthorId,
  type OutcomeId,
  type RewriteMode,
} from "@/lib/ghostwriter-shared";

const HowItWorksDrawer = dynamic(
  () =>
    import("@/components/ghostwriter/HowItWorksDrawer").then(
      (module) => module.HowItWorksDrawer,
    ),
  { loading: () => null },
);

type RewriteRun = {
  artifactToken: string | null;
  author: AuthorId | null;
  mode: RewriteMode;
  moodLabel: string;
  mood: number | null;
  outcome: OutcomeId | null;
  outcomeLabel: string | null;
  provenance: RewritePlaybackProvenance | null;
  rewrite: string;
  runId: number;
  source: string;
};
type RewriteAttempt = {
  author: AuthorId;
  mode: RewriteMode;
  mood: number;
  outcome: OutcomeId;
  text: string;
};
type RewriteErrorState = {
  message: string;
  requestId: string | null;
};
type GhostwriterFeatureAvailability = {
  feedbackEnabled: boolean;
  publicSharingEnabled: boolean;
  rewriteLabEnabled: boolean;
  rewriteEnabled: boolean;
  rewriteUnavailableReason: string | null;
};

const REWRITE_CLIENT_TIMEOUT_MS = 35_000;
const SHARE_CLIENT_TIMEOUT_MS = 15_000;
const FEEDBACK_CLIENT_TIMEOUT_MS = 12_000;
const DEFAULT_AUTHOR_ID: AuthorId = "tolkien";
const MODE_STORAGE_KEY = "second_voice_rewrite_mode";
const OUTCOME_STORAGE_KEY = "second_voice_outcome";
const EMPTY_RUN: RewriteRun = {
  artifactToken: null,
  author: null,
  mode: DEFAULT_REWRITE_MODE,
  moodLabel: "",
  mood: null,
  outcome: null,
  outcomeLabel: null,
  provenance: null,
  rewrite: "",
  runId: 0,
  source: "",
};
const DEFAULT_FEATURES: GhostwriterFeatureAvailability = {
  feedbackEnabled: false,
  publicSharingEnabled: false,
  rewriteLabEnabled: true,
  rewriteEnabled: true,
  rewriteUnavailableReason: null,
};

function toRewriteErrorState(error: unknown): RewriteErrorState {
  if (error instanceof GhostwriterRequestError) {
    return {
      message: error.message,
      requestId: error.requestId,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      message: "The rewrite took too long to finish. Try again.",
      requestId: null,
    };
  }

  return {
    message: error instanceof Error ? error.message : "The rewrite could not be completed.",
    requestId: null,
  };
}

function resizeComposer(node: HTMLTextAreaElement) {
  const minHeight = Number.parseFloat(window.getComputedStyle(node).minHeight) || 0;
  node.style.height = "auto";
  node.style.height = `${Math.max(node.scrollHeight, minHeight)}px`;
}

export function GhostwriterPage({
  features = DEFAULT_FEATURES,
}: {
  features?: GhostwriterFeatureAvailability;
}) {
  const [activeId, setActiveId] = useState<AuthorId>(DEFAULT_AUTHOR_ID);
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>(DEFAULT_REWRITE_MODE);
  const [outcome, setOutcome] = useState<OutcomeId>(DEFAULT_OUTCOME_ID);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [mood, setMood] = useState(52);
  const [input, setInput] = useState(SAMPLES[1]?.text ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RewriteErrorState | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [latestRun, setLatestRun] = useState<RewriteRun>(EMPTY_RUN);
  const [lastAttempt, setLastAttempt] = useState<RewriteAttempt | null>(null);
  const howItWorksTriggerRef = useRef<HTMLButtonElement>(null);
  const [requestContext, setRequestContext] = useState<{
    author: AuthorId;
    mode: RewriteMode;
    mood: number;
    moodLabel: string;
    outcome: OutcomeId;
    outcomeLabel: string;
    source: string;
  } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const studioRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (composerRef.current) {
      resizeComposer(composerRef.current);
    }
  }, [input]);

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      const storedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
      const storedOutcome = window.localStorage.getItem(OUTCOME_STORAGE_KEY);

      if (storedMode === "author" || storedMode === "outcome") {
        setRewriteMode(storedMode);
      }

      if (OUTCOMES.some((entry) => entry.id === storedOutcome)) {
        setOutcome(storedOutcome as OutcomeId);
      }

      setPreferencesReady(true);
    }, 0);

    return () => window.clearTimeout(preferenceTimer);
  }, []);

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    window.localStorage.setItem(MODE_STORAGE_KEY, rewriteMode);
  }, [preferencesReady, rewriteMode]);

  useEffect(() => {
    if (!preferencesReady) {
      return;
    }

    window.localStorage.setItem(OUTCOME_STORAGE_KEY, outcome);
  }, [outcome, preferencesReady]);

  const active = useMemo(
    () => AUTHORS.find((author) => author.id === activeId) ?? AUTHORS[0],
    [activeId],
  );
  const activeOutcome = useMemo(
    () => OUTCOMES.find((entry) => entry.id === outcome) ?? OUTCOMES[0],
    [outcome],
  );
  const headlineNeedsAuthorWrap = active.cardTitle.length >= 7;
  const displayedAuthor =
    (requestContext?.author
      ? AUTHORS.find((author) => author.id === requestContext.author)
      : latestRun.author
        ? AUTHORS.find((author) => author.id === latestRun.author)
        : null) ?? active;
  const displayedMood = requestContext?.mood ?? latestRun.mood ?? mood;
  const displayedSource = requestContext?.source ?? latestRun.source;
  const displayedMode = requestContext?.mode ?? latestRun.mode ?? rewriteMode;
  const displayedOutcomeLabel =
    requestContext?.outcomeLabel || latestRun.outcomeLabel || outcomeLabelFor(outcome);
  const displayedMoodLabel =
    requestContext?.moodLabel || latestRun.moodLabel || moodLabelFor(active.id, mood);
  const rewriteUnavailableMessage =
    features.rewriteUnavailableReason ?? "Rewrite is temporarily unavailable.";
  const canRewrite = features.rewriteEnabled && input.trim().length > 0 && !loading;
  const rewriteCta =
    rewriteMode === "outcome"
      ? `Rewrite to ${activeOutcome.label.toLowerCase()}`
      : `Rewrite as ${active.cardTitle}`;

  function scrollToRewriteStudio() {
    window.requestAnimationFrame(() => {
      const studio = studioRef.current;

      if (!studio) {
        return;
      }

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      studio.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
        inline: "nearest",
      });
    });
  }

  async function handleRewrite(overrides?: {
    author?: AuthorId;
    mode?: RewriteMode;
    mood?: number;
    outcome?: OutcomeId;
    text?: string;
  }) {
    const nextMode = overrides?.mode ?? rewriteMode;
    const authorId = overrides?.author ?? active.id;
    const nextMood = overrides?.mood ?? mood;
    const nextOutcome = overrides?.outcome ?? outcome;
    const source = (overrides?.text ?? input).trim();

    if (!source) {
      setError({
        message: "Paste a line first.",
        requestId: null,
      });
      return;
    }

    if (!features.rewriteEnabled) {
      setError({
        message: rewriteUnavailableMessage,
        requestId: null,
      });
      return;
    }

    const nextMoodLabel =
      nextMode === "outcome" ? outcomeLabelFor(nextOutcome) : moodLabelFor(authorId, nextMood);
    const attempt: RewriteAttempt = {
      author: authorId,
      mode: nextMode,
      mood: nextMood,
      outcome: nextOutcome,
      text: source,
    };

    setError(null);
    setLastAttempt(attempt);
    setLoading(true);
    setRequestContext({
      author: authorId,
      mode: nextMode,
      mood: nextMood,
      outcome: nextOutcome,
      outcomeLabel: outcomeLabelFor(nextOutcome),
      source,
      moodLabel: nextMoodLabel,
    });

    const abortController = new AbortController();
    const idempotencyKey = crypto.randomUUID();
    const timeoutId = window.setTimeout(() => abortController.abort(), REWRITE_CLIENT_TIMEOUT_MS);

    try {
      let csrfToken = readGhostwriterCsrfToken();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (!csrfToken) {
            throw new Error("Protection cookies are missing. Refresh the page and try again.");
          }

          const challenge = await issueGhostwriterChallenge(csrfToken, {
            signal: abortController.signal,
          });

          const rewriteResponse = await fetch("/api/ghostwriter", {
            body: JSON.stringify({
              author: authorId,
              challengeNonce: challenge.challengeNonce,
              challengeToken: challenge.challengeToken,
              mode: nextMode,
              mood: nextMood,
              outcome: nextOutcome,
              share: false,
              text: source,
            }),
            headers: {
              "content-type": "application/json",
              "idempotency-key": idempotencyKey,
              "x-ghostwriter-csrf": csrfToken,
            },
            method: "POST",
            signal: abortController.signal,
          });

          const payload = (await rewriteResponse.json().catch(() => ({}))) as {
            artifactToken?: string | null;
            error?: string | null;
            moodLabel?: string | null;
            rewrite?: string;
          };

          if (!rewriteResponse.ok || payload.error || !payload.rewrite || !payload.artifactToken) {
            throw new GhostwriterRequestError(
              payload.error || "The rewrite came back empty. Try again.",
              requestIdFrom(rewriteResponse),
            );
          }

          const rewrite = payload.rewrite;

          setLatestRun((previous) => ({
            artifactToken: payload.artifactToken ?? null,
            author: authorId,
            mode: nextMode,
            moodLabel: payload.moodLabel || nextMoodLabel,
            mood: nextMood,
            outcome: nextMode === "outcome" ? nextOutcome : null,
            outcomeLabel: nextMode === "outcome" ? outcomeLabelFor(nextOutcome) : null,
            provenance: null,
            rewrite,
            runId: previous.runId + 1,
            source,
          }));

          return;
        } catch (attemptError) {
          const message =
            attemptError instanceof Error
              ? attemptError.message
              : "The rewrite could not be completed.";

          if (attempt === 0 && isRecoverableSessionError(message)) {
            csrfToken = await refreshGhostwriterShieldSession({
              signal: abortController.signal,
            });

            if (csrfToken) {
              continue;
            }
          }

          throw attemptError;
        }
      }
    } catch (caughtError) {
      setError(toRewriteErrorState(caughtError));
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
      window.dispatchEvent(new Event("ghostwriter-allowance-changed"));
    }
  }

  function retryLastRewrite() {
    if (!lastAttempt || loading || !features.rewriteEnabled) {
      return;
    }

    setActiveId(lastAttempt.author);
    setRewriteMode(lastAttempt.mode);
    setMood(lastAttempt.mood);
    setOutcome(lastAttempt.outcome);
    setInput(lastAttempt.text);
    void handleRewrite(lastAttempt);
    scrollToRewriteStudio();
  }

  function applyLabWinner(selection: RewriteLabWinnerSelection) {
    const nextRewrite = selection.rewrite.trim();

    if (!nextRewrite) {
      return;
    }

    setError(null);
    setLatestRun((previous) => {
      if (!previous.rewrite || !previous.source) {
        return previous;
      }

      return {
        ...previous,
        artifactToken: selection.artifactToken,
        provenance: {
          label: selection.label,
          overall: selection.overall,
          reason: selection.reason,
          source: "rewrite-lab",
        },
        rewrite: nextRewrite,
        runId: previous.runId + 1,
      };
    });
  }

  async function shareCurrentRewrite(): Promise<RewriteShareLink> {
    if (
      !latestRun.artifactToken ||
      !latestRun.author ||
      latestRun.mood === null ||
      !latestRun.source ||
      !latestRun.rewrite
    ) {
      throw new Error("Run a rewrite before creating a public link.");
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), SHARE_CLIENT_TIMEOUT_MS);

    try {
      let csrfToken = readGhostwriterCsrfToken();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (!csrfToken) {
            throw new Error("Protection cookies are missing. Refresh the page and try again.");
          }

          const challenge = await issueGhostwriterChallenge(csrfToken, {
            signal: abortController.signal,
          });
          const shareResponse = await fetch("/api/ghostwriter/share", {
            body: JSON.stringify({
              author: latestRun.author,
              artifactToken: latestRun.artifactToken,
              challengeNonce: challenge.challengeNonce,
              challengeToken: challenge.challengeToken,
              mode: latestRun.mode,
              mood: latestRun.mood,
              outcome: latestRun.outcome ?? DEFAULT_OUTCOME_ID,
              rewrite: latestRun.rewrite,
              shareConsent: PUBLIC_REWRITE_SHARE_CONSENT,
              text: latestRun.source,
            }),
            headers: {
              "content-type": "application/json",
              "x-ghostwriter-csrf": csrfToken,
            },
            method: "POST",
            signal: abortController.signal,
          });
          const payload = (await shareResponse.json().catch(() => ({}))) as {
            error?: string | null;
            shortId?: string | null;
          };

          if (!shareResponse.ok || payload.error || !payload.shortId) {
            throw new GhostwriterRequestError(
              payload.error || "The public link could not be created.",
              requestIdFrom(shareResponse),
            );
          }

          return {
            href: `/g/${payload.shortId}`,
            shortId: payload.shortId,
          };
        } catch (attemptError) {
          const message =
            attemptError instanceof Error
              ? attemptError.message
              : "The public link could not be created.";

          if (attempt === 0 && isRecoverableSessionError(message)) {
            csrfToken = await refreshGhostwriterShieldSession({
              signal: abortController.signal,
            });

            if (csrfToken) {
              continue;
            }
          }

          throw attemptError;
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
    }

    throw new Error("The public link could not be created.");
  }

  async function submitRewriteFeedback(submission: RewriteFeedbackSubmission): Promise<void> {
    if (
      !latestRun.artifactToken ||
      !latestRun.author ||
      latestRun.mood === null ||
      !latestRun.source ||
      !latestRun.rewrite
    ) {
      throw new Error("Run a rewrite before leaving feedback.");
    }

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), FEEDBACK_CLIENT_TIMEOUT_MS);

    try {
      let csrfToken = readGhostwriterCsrfToken();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (!csrfToken) {
            throw new Error("Protection cookies are missing. Refresh the page and try again.");
          }

          const challenge = await issueGhostwriterChallenge(csrfToken, {
            signal: abortController.signal,
          });
          const feedbackResponse = await fetch("/api/ghostwriter/feedback", {
            body: JSON.stringify({
              author: latestRun.author,
              artifactToken: latestRun.artifactToken,
              challengeNonce: challenge.challengeNonce,
              challengeToken: challenge.challengeToken,
              mode: latestRun.mode,
              mood: latestRun.mood,
              outcome: latestRun.outcome ?? DEFAULT_OUTCOME_ID,
              rating: submission.rating,
              reason: submission.reason,
              rewrite: latestRun.rewrite,
            }),
            headers: {
              "content-type": "application/json",
              "x-ghostwriter-csrf": csrfToken,
            },
            method: "POST",
            signal: abortController.signal,
          });
          const payload = (await feedbackResponse.json().catch(() => ({}))) as {
            error?: string | null;
          };

          if (!feedbackResponse.ok || payload.error) {
            throw new GhostwriterRequestError(
              payload.error || "Feedback could not be saved.",
              requestIdFrom(feedbackResponse),
            );
          }

          return;
        } catch (attemptError) {
          const message =
            attemptError instanceof Error
              ? attemptError.message
              : "Feedback could not be saved.";

          if (attempt === 0 && isRecoverableSessionError(message)) {
            csrfToken = await refreshGhostwriterShieldSession({
              signal: abortController.signal,
            });

            if (csrfToken) {
              continue;
            }
          }

          throw attemptError;
        }
      }
    } finally {
      window.clearTimeout(timeoutId);
    }

    throw new Error("Feedback could not be saved.");
  }

  function handleSurpriseMe() {
    if (loading) {
      return;
    }

    if (!features.rewriteEnabled) {
      setError({
        message: rewriteUnavailableMessage,
        requestId: null,
      });
      scrollToRewriteStudio();
      return;
    }

    const userSource = input.trim();
    const presetsWithNewMood = DEMO_PRESETS.filter((preset) => preset.mood !== mood);
    const presetPool = presetsWithNewMood.length > 0 ? presetsWithNewMood : DEMO_PRESETS;
    const preset = presetPool[Math.floor(Math.random() * presetPool.length)];
    const source = userSource || preset.text;

    if (rewriteMode === "outcome") {
      const outcomes = OUTCOMES.filter((entry) => entry.id !== outcome);
      const outcomePool = outcomes.length > 0 ? outcomes : OUTCOMES;
      const nextOutcome = outcomePool[Math.floor(Math.random() * outcomePool.length)]?.id ?? DEFAULT_OUTCOME_ID;

      setOutcome(nextOutcome);

      if (!userSource) {
        setInput(preset.text);
      }

      void handleRewrite({
        author: active.id,
        mode: "outcome",
        mood,
        outcome: nextOutcome,
        text: source,
      });
      scrollToRewriteStudio();
      return;
    }

    setActiveId(preset.author);
    setMood(preset.mood);

    if (!userSource) {
      setInput(preset.text);
    }

    void handleRewrite({
      author: preset.author,
      mode: "author",
      mood: preset.mood,
      outcome,
      text: source,
    });
    scrollToRewriteStudio();
  }

  return (
    <div
      className="ghostwriter gw-overflow-guard relative min-h-dvh overflow-x-clip"
      data-app-ready={preferencesReady ? "true" : "false"}
      data-voice={active.id}
    >
      <div className="gw-overflow-guard relative z-10 mx-auto w-full max-w-[1460px] px-4 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-12 lg:px-10 xl:px-12">
        <section className="hero" data-headline-length={headlineNeedsAuthorWrap ? "long" : "short"}>
          <div className="hero-text">
            <h1
              className={[
                "hero-headline max-w-[min(100%,24ch)] font-serif text-[clamp(2.65rem,13vw,6.15rem)] font-medium leading-[0.98] tracking-[-0.035em] text-[var(--ghost)] lg:max-w-[15ch] lg:text-[clamp(3rem,6.8vw,6.35rem)] lg:leading-[1.01] lg:tracking-[-0.025em]",
                headlineNeedsAuthorWrap
                  ? "lg:max-w-[13.8ch] lg:text-[clamp(3rem,5.8vw,5.2rem)] xl:max-w-[13.6ch] xl:text-[clamp(3rem,4.6vw,5.05rem)]"
                  : "xl:text-[clamp(3rem,5.45vw,5.95rem)]",
              ].join(" ")}
            >
              <span className="hero-rewrite-line">Rewrite</span>
              {" "}
              <span className="hero-anything-line whitespace-nowrap">anything with</span>
              {" "}
              <span className="hero-author-line">
                <span className="gw-voice-text italic font-normal">
                  {active.cardTitle}
                </span>
                {" "}
                <span className="hero-author-tail">as author.</span>
              </span>
            </h1>
            <p className="hero-copy mt-7 max-w-[38rem] text-[0.99rem] leading-[1.62] text-[var(--mist)] sm:mt-8 sm:text-[1.02rem] lg:max-w-[29rem] lg:text-[1rem]">
              Pick a writer, drag the mood dial, and watch your words come back from that author.
            </p>

            <div className="hero-actions mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSurpriseMe}
                className="gw-primary-cta gw-hero-primary-cta inline-flex items-center gap-2 disabled:cursor-not-allowed"
                disabled={loading || !features.rewriteEnabled}
              >
                {loading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-5 w-5" aria-hidden />
                )}
                {loading ? "Rewriting..." : "Surprise me"}
              </button>
              <button
                ref={howItWorksTriggerRef}
                type="button"
                className="gw-hero-link gw-how-trigger inline-flex items-center gap-2 border bg-transparent font-medium transition-colors"
                aria-haspopup="dialog"
                aria-expanded={howItWorksOpen}
                aria-controls="gw-how-drawer"
                onClick={() => setHowItWorksOpen(true)}
              >
                How it works
              </button>
              <Link
                href="/second-voice/case-study"
                className="gw-hero-link inline-flex items-center gap-2 border bg-transparent font-medium transition-colors"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Read the case study
              </Link>
            </div>
          </div>

          <HeroArtwork />
        </section>

        <section className="gw-voice-console" aria-labelledby="gw-voice-title">
          <header className="gw-voice-console-header">
            <div>
              <p className="gw-voice-kicker">Rewrite controls</p>
              <h2 id="gw-voice-title" className="gw-voice-title">
                {rewriteMode === "author" ? "Choose a writer" : "Choose an outcome"}
              </h2>
              <p className="gw-voice-instruction">
                {rewriteMode === "author"
                  ? "Pick one of the cards. Then tune the mood."
                  : "Pick what the rewrite should accomplish."}
              </p>
            </div>
            <div className="gw-mode-toggle" role="group" aria-label="Rewrite mode">
              <button
                type="button"
                aria-pressed={rewriteMode === "author"}
                className="gw-mode-toggle-button"
                data-selected={rewriteMode === "author"}
                disabled={loading}
                onClick={() => setRewriteMode("author")}
              >
                Authors
              </button>
              <button
                type="button"
                aria-pressed={rewriteMode === "outcome"}
                className="gw-mode-toggle-button"
                data-selected={rewriteMode === "outcome"}
                disabled={loading}
                onClick={() => setRewriteMode("outcome")}
              >
                Outcomes
              </button>
            </div>
          </header>

          {rewriteMode === "author" ? (
            <>
              <AuthorOrbital active={active.id} disabled={loading} onSelect={setActiveId} />

              <div className="gw-voice-divider" aria-hidden />

              <MoodDial
                author={active.id}
                disabled={loading}
                value={mood}
                onChange={setMood}
              />
            </>
          ) : (
            <OutcomeOptions
              disabled={loading}
              onChange={setOutcome}
              value={outcome}
            />
          )}
        </section>

        <section
          id="ghostwriter-studio"
          ref={studioRef}
          className="gw-overflow-grid mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]"
        >
          <div className="gw-card-strong p-6 sm:p-7 lg:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-playfair text-[1.08rem] font-medium tracking-[-0.015em] text-[var(--ghost)] sm:text-[1.14rem]">Your sentence</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--mist)] sm:text-[13px]">
                  Paste a line, a paragraph, or something fragile enough to rewrite.
                </p>
              </div>
              <span className="text-[10px] tracking-[0.03em] text-[var(--whisper)] sm:text-[11px]">{input.length} / 2000</span>
            </div>

            <div className="gw-input-panel mt-5">
              <label htmlFor="second-voice-input" className="gw-input-label">
                Write or paste here
              </label>
              <textarea
                id="second-voice-input"
                ref={composerRef}
                value={input}
                onChange={(event) => {
                  resizeComposer(event.currentTarget);
                  setInput(event.target.value.slice(0, 2000));
                }}
                rows={8}
                maxLength={2000}
                placeholder="Paste your sentence, paragraph, or messy draft here."
                className="gw-input-textarea min-h-[240px] w-full resize-none overflow-hidden p-4 text-[1.05rem] leading-relaxed text-[var(--ghost)] outline-none sm:p-5"
              />
            </div>

            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--whisper)]">
                Quick starts
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {SAMPLES.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setInput(sample.text)}
                    className="gw-chip"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="gw-composer-actions">
              <div className="gw-composer-action-row">
                <button
                  type="button"
                  disabled={!canRewrite}
                  onClick={() => void handleRewrite()}
                  className="gw-primary-cta gw-composer-primary-cta inline-flex items-center gap-2 disabled:cursor-not-allowed"
                >
                  {loading && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />}
                  {loading ? "Rewriting..." : rewriteCta}
                </button>
                <button
                  type="button"
                  onClick={handleSurpriseMe}
                  className="gw-chip gw-surprise-cta"
                  disabled={loading || !features.rewriteEnabled}
                >
                  {loading ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-5 w-5" aria-hidden />
                  )}
                  {loading ? "Rewriting..." : "Surprise me"}
                </button>
              </div>

              {!features.rewriteEnabled ? (
                <p className="gw-composer-status" role="status">
                  {rewriteUnavailableMessage}
                </p>
              ) : null}
            </div>
          </div>

          <RewritePlayback
            author={displayedAuthor}
            error={error?.message ?? null}
            errorRequestId={error?.requestId ?? null}
            loading={loading}
            loadingLabel={displayedMode === "outcome" ? "Optimizing for" : "Working with"}
            mode={displayedMode}
            mood={displayedMood}
            moodLabel={displayedMoodLabel}
            onApplyRewrite={
              features.rewriteLabEnabled && displayedMode === "author" ? applyLabWinner : undefined
            }
            onRetry={lastAttempt && !loading && features.rewriteEnabled ? retryLastRewrite : undefined}
            onShareRewrite={features.publicSharingEnabled ? shareCurrentRewrite : undefined}
            onSubmitFeedback={features.feedbackEnabled ? submitRewriteFeedback : undefined}
            outcomeLabel={displayedOutcomeLabel}
            provenance={latestRun.provenance}
            result={latestRun.rewrite}
            runId={latestRun.runId}
            source={displayedSource}
          />
        </section>

        <section className="mt-9 flex flex-col gap-4 border-t border-[var(--gw-border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-end">
          <Link href="/second-voice/case-study" className="gw-chip">
            Read the case study
          </Link>
        </section>
      </div>

      <HowItWorksDrawer
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        returnFocusRef={howItWorksTriggerRef}
      />
    </div>
  );
}
