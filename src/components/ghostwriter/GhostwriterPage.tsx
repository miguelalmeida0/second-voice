"use client";

import dynamic from "next/dynamic";

import Image from "next/image";
import { Feather } from "lucide-react";
import { QuickStartsPanel } from "@/components/ghostwriter/QuickStartsPanel";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { AUTHORS, AuthorOrbital } from "@/components/ghostwriter/AuthorOrbital";
import { MoodDial } from "@/components/ghostwriter/MoodDial";
import { OutcomeOptions } from "@/components/ghostwriter/OutcomeOptions";
import {
  openPortfolioSignIn,
  usePortfolioAccess,
} from "@/components/ghostwriter/PortfolioAccess";
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
import { portfolioAccessView } from "@/lib/portfolio-access";
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
  {
    loading: () => null,
  },
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
  reasonCode?: string | null;
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
      reasonCode: error.reasonCode,
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      message:
        "AI demo is temporarily unavailable. Your text stays here. The request may already have started; it will not be retried automatically.",
      requestId: null,
    };
  }

  return {
    message:
      error instanceof Error
        ? error.message
        : "The rewrite could not be completed.",
    requestId: null,
  };
}

function resizeComposer(node: HTMLTextAreaElement) {
  const minHeight =
    Number.parseFloat(window.getComputedStyle(node).minHeight) || 0;

  node.style.height = "auto";

  node.style.height = `${Math.max(node.scrollHeight, minHeight)}px`;
}

export function GhostwriterPage({
  features = DEFAULT_FEATURES,
}: {
  features?: GhostwriterFeatureAvailability;
}) {
  const portfolioAccess = usePortfolioAccess();

  const [activeId, setActiveId] = useState<AuthorId>(DEFAULT_AUTHOR_ID);

  const [rewriteMode, setRewriteMode] =
    useState<RewriteMode>(DEFAULT_REWRITE_MODE);

  const [outcome, setOutcome] = useState<OutcomeId>(DEFAULT_OUTCOME_ID);

  const [preferencesReady, setPreferencesReady] = useState(false);

  const [mood, setMood] = useState(52);

  const [input, setInput] = useState(SAMPLES[1]?.text ?? "");

  const [loading, setLoading] = useState(false);

  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    const tick = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    tick();
    if (!cooldownUntil) return;
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  function startCooldown(seconds: number) {
    setCooldownUntil(Date.now() + seconds * 1000);
    setCooldownSeconds(seconds);
  }

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
  const rewriteInFlightRef = useRef(false);

  const studioRef = useRef<HTMLElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading || !window.matchMedia("(max-width: 1100px)").matches) return;
    outputRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [loading]);

  useLayoutEffect(() => {
    if (composerRef.current) {
      resizeComposer(composerRef.current);
    }
  }, [input]);

  useEffect(() => {
    // Reflow existing drafts when a phone rotates or the window crosses a
    // breakpoint, without turning the composer into an internal scroller.
    let frame = 0;
    const reflow = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (composerRef.current) resizeComposer(composerRef.current);
      });
    };
    window.addEventListener("resize", reflow, { passive: true });
    return () => {
      window.removeEventListener("resize", reflow);
      window.cancelAnimationFrame(frame);
    };
  }, []);

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

  const displayedAuthor =
    (requestContext?.author
      ? AUTHORS.find((author) => author.id === requestContext.author)
      : latestRun.author
        ? AUTHORS.find((author) => author.id === latestRun.author)
        : null) ?? active;

  const displayedMood = requestContext?.mood ?? (latestRun.rewrite ? latestRun.mood ?? mood : mood);

  const displayedSource = requestContext?.source ?? latestRun.source;

  const displayedMode = requestContext?.mode ?? (latestRun.rewrite ? latestRun.mode : rewriteMode);

  const displayedOutcomeLabel =
    requestContext?.outcomeLabel ||
    latestRun.outcomeLabel ||
    outcomeLabelFor(outcome);

  const displayedMoodLabel =
    requestContext?.moodLabel ||
    latestRun.moodLabel ||
    moodLabelFor(active.id, mood);

  const accessView = portfolioAccess
    ? portfolioAccessView(
        portfolioAccess.session,
        portfolioAccess.githubEnabled,
        features.rewriteEnabled,
      )
    : null;

  const generationEnabled =
    features.rewriteEnabled && (!accessView || accessView.canGenerate) && cooldownSeconds === 0;

  const rewriteUnavailableMessage =
    accessView?.message ??
    features.rewriteUnavailableReason ??
    "AI demo is temporarily unavailable. Your text stays here.";

  const canRewrite =
    !loading &&
    (accessView?.signIn || (generationEnabled && input.trim().length > 0));

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

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

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
    if (rewriteInFlightRef.current) return;

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

    if (accessView?.signIn) {
      openPortfolioSignIn();
      return;
    }

    if (!generationEnabled) {
      setError({
        message: rewriteUnavailableMessage,
        requestId: null,
      });

      return;
    }

    rewriteInFlightRef.current = true;

    const nextMoodLabel =
      nextMode === "outcome"
        ? outcomeLabelFor(nextOutcome)
        : moodLabelFor(authorId, nextMood);

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

    const timeoutId = window.setTimeout(
      () => abortController.abort(),
      REWRITE_CLIENT_TIMEOUT_MS,
    );

    try {
      let csrfToken = readGhostwriterCsrfToken();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (!csrfToken) {
            throw new Error(
              "Protection cookies are missing. Refresh the page and try again.",
            );
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

            reasonCode?: string | null;

            moodLabel?: string | null;

            rewrite?: string;
          };

          if (
            !rewriteResponse.ok ||
            payload.error ||
            !payload.rewrite ||
            !payload.artifactToken
          ) {
            const retryAfter = Number(rewriteResponse.headers.get("Retry-After"));
            if (rewriteResponse.status === 429 && retryAfter > 0 && retryAfter <= 60) startCooldown(Math.ceil(retryAfter));
            throw new GhostwriterRequestError(
              payload.error ||
                (portfolioAccess && rewriteResponse.status >= 500
                  ? "AI demo is temporarily unavailable. Your text stays here. No automatic retry was made."
                  : "The rewrite could not be completed. Your text stays here."),
              requestIdFrom(rewriteResponse),
              {
                reasonCode: payload.reasonCode ?? null,
                retryAfterSeconds:
                  Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null,
              },
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

            outcomeLabel:
              nextMode === "outcome" ? outcomeLabelFor(nextOutcome) : null,

            provenance: null,

            rewrite,

            runId: previous.runId + 1,

            source,
          }));

          /*
           * A successful governed rewrite has already consumed exactly one
           * portfolio reservation. Reflect that authoritative mutation in the
           * visible allowance immediately instead of making the CTA depend on
           * a second client status request. The server remains the final
           * arbiter on every subsequent rewrite and a page reload rehydrates
           * the exact allowance from Postgres.
           */
          portfolioAccess?.setSession((current) => {
            if (
              (current.status !== "anonymous" &&
                current.status !== "authenticated") ||
              !current.allowance
            ) {
              return current;
            }

            const currentRemaining =
              current.allowance.todayRemaining ?? current.allowance.remaining;
            const nextRemaining = Math.max(0, currentRemaining - 1);

            return {
              ...current,
              allowance: {
                ...current.allowance,
                remaining: nextRemaining,
                todayRemaining: nextRemaining,
                available: current.allowance.available && nextRemaining > 0,
              },
            };
          });

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
      if (caughtError instanceof GhostwriterRequestError && caughtError.retryAfterSeconds) {
        startCooldown(Math.min(300, caughtError.retryAfterSeconds));
      }

      setError(
        portfolioAccess && !(caughtError instanceof GhostwriterRequestError)
          ? {
              message:
                "AI demo is temporarily unavailable. Your text stays here. The request may already have started; no automatic retry was made.",

              requestId: null,
            }
          : toRewriteErrorState(caughtError),
      );
    } finally {
      window.clearTimeout(timeoutId);

      setLoading(false);
      rewriteInFlightRef.current = false;

      window.dispatchEvent(new Event("ghostwriter-allowance-changed"));
    }
  }

  function retryLastRewrite() {
    if (!lastAttempt || loading || !generationEnabled) {
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

    const timeoutId = window.setTimeout(
      () => abortController.abort(),
      SHARE_CLIENT_TIMEOUT_MS,
    );

    try {
      let csrfToken = readGhostwriterCsrfToken();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (!csrfToken) {
            throw new Error(
              "Protection cookies are missing. Refresh the page and try again.",
            );
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

  async function submitRewriteFeedback(
    submission: RewriteFeedbackSubmission,
  ): Promise<void> {
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

    const timeoutId = window.setTimeout(
      () => abortController.abort(),
      FEEDBACK_CLIENT_TIMEOUT_MS,
    );

    try {
      let csrfToken = readGhostwriterCsrfToken();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (!csrfToken) {
            throw new Error(
              "Protection cookies are missing. Refresh the page and try again.",
            );
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

    if (!generationEnabled) {
      setError({
        message: rewriteUnavailableMessage,

        requestId: null,
      });

      scrollToRewriteStudio();

      return;
    }

    const userSource = input.trim();

    const presetsWithNewMood = DEMO_PRESETS.filter(
      (preset) => preset.mood !== mood,
    );

    const presetPool =
      presetsWithNewMood.length > 0 ? presetsWithNewMood : DEMO_PRESETS;

    const preset = presetPool[Math.floor(Math.random() * presetPool.length)];

    const source = userSource || preset.text;

    if (rewriteMode === "outcome") {
      const outcomes = OUTCOMES.filter((entry) => entry.id !== outcome);

      const outcomePool = outcomes.length > 0 ? outcomes : OUTCOMES;

      const nextOutcome =
        outcomePool[Math.floor(Math.random() * outcomePool.length)]?.id ??
        DEFAULT_OUTCOME_ID;

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
      className="ghostwriter gw-studio relative min-h-dvh overflow-x-clip bg-[#050505] text-[var(--ghost)]"
      data-app-ready={preferencesReady ? "true" : "false"}
      data-voice={active.id}
    >
      <div className="gw-studio-shell">
        {/* ====================================================
            TOP BRAND / HERO
           ==================================================== */}
        <header className="gw-studio-hero">
          <div className="gw-studio-intro">
            <div className="gw-studio-brand">
              <Feather aria-hidden="true" />
              <h1>Second Voice</h1>
            </div>

            <p>Your words, another voice.</p>
          </div>
          <Image
            src="/ghostwriter/second-voice-mascot.png"
            alt="The Second Voice writer, in his black beanie, thinking with a fountain pen"
            width={1248}
            height={1248}
            preload
            unoptimized
            className="gw-studio-mascot"
          />
        </header>

        {/* ====================================================
            MODE SWITCH
           ==================================================== */}
        <section className="gw-studio-mode">
          <button
            ref={howItWorksTriggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={howItWorksOpen}
            aria-controls="gw-how-drawer"
            onClick={() => setHowItWorksOpen(true)}
            className="gw-studio-help"
          >How it works</button>
          <div
            className="gw-studio-mode-switch"
            role="group"
            aria-label="Rewrite mode"
          >
            <button
              type="button"
              aria-pressed={rewriteMode === "author"}
              disabled={loading}
              onClick={() => setRewriteMode("author")}
              className={[
                "gw-studio-mode-button",
                rewriteMode === "author"
                  ? "border border-[#9bcaff]/75 bg-[#9bcaff]/12 text-[#cde5ff] shadow-[0_0_0_1px_rgba(155,202,255,0.12)]"
                  : "text-[var(--mist)] hover:bg-white/[0.025] hover:text-[var(--ghost)]",
              ].join(" ")}
            >
              Authors
            </button>

            <button
              type="button"
              aria-pressed={rewriteMode === "outcome"}
              disabled={loading}
              onClick={() => setRewriteMode("outcome")}
              className={[
                "gw-studio-mode-button",
                rewriteMode === "outcome"
                  ? "border border-[#9bcaff]/75 bg-[#9bcaff]/12 text-[#cde5ff] shadow-[0_0_0_1px_rgba(155,202,255,0.12)]"
                  : "text-[var(--mist)] hover:bg-white/[0.025] hover:text-[var(--ghost)]",
              ].join(" ")}
            >
              Outcomes
            </button>
          </div>
        </section>

        {/* ====================================================
            AUTHOR / OUTCOME CONTROL
           ==================================================== */}
        <section className="gw-studio-controls" aria-label={rewriteMode === "author" ? "Author and mood" : "Writing outcome"}>
          {rewriteMode === "author" ? (
            <div className="gw-studio-author-controls">
              <AuthorOrbital
                active={active.id}
                disabled={loading}
                onSelect={setActiveId}
              />

              <MoodDial
                author={active.id}
                disabled={loading}
                value={mood}
                onChange={setMood}
              />
            </div>
          ) : (
            <div className="gw-studio-outcome-controls">
              <OutcomeOptions
                disabled={loading}
                onChange={setOutcome}
                value={outcome}
              />
            </div>
          )}
        </section>

        {/* ====================================================
            MAIN WORKSPACE
           ==================================================== */}
        <section
          id="ghostwriter-studio"
          ref={studioRef}
          className="gw-studio-workspace"
        >
          {/* INPUT */}
          <div className="gw-studio-input">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="gw-studio-panel-title">Your text</h2>
                <p className="gw-studio-panel-note">Paste or write up to 2,000 characters.</p>
              </div>

              <span className="text-[10px] tracking-[0.04em] text-[var(--whisper)] sm:text-[11px]">
                {input.length} / 2000
              </span>
            </div>

            <div className="gw-composer-field mt-4 rounded-[13px] border border-white/10 bg-black/20">
              <label
                htmlFor="second-voice-input"
                className="sr-only"
              >
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
                rows={4}
                maxLength={2000}
                placeholder="Paste your sentence, paragraph, or messy draft here."
                className="min-h-[120px] w-full resize-none overflow-hidden bg-transparent px-4 py-4 font-playfair text-[1.05rem] leading-[1.65] text-[var(--ghost)] outline-none placeholder:text-[var(--whisper)]"
              />
            </div>


          </div>

          <QuickStartsPanel
            input={input}
            mode={rewriteMode}
            onSelect={setInput}
            onSurprise={handleSurpriseMe}
            onRewrite={() => accessView?.signIn ? openPortfolioSignIn() : void handleRewrite()}
            loading={loading}
            canRewrite={canRewrite}
            surpriseDisabled={loading || !generationEnabled}
            label={accessView?.signIn ? "Sign in with GitHub" : rewriteCta}
            status={accessView || !features.rewriteEnabled
              ? cooldownSeconds > 0
                ? "Next rewrite in " + cooldownSeconds + "s. Your free-rewrite allowance is unchanged."
                : rewriteUnavailableMessage
              : null}
          />

          {/* OUTPUT */}
          <div ref={outputRef} className="gw-studio-output">
            <RewritePlayback
              author={displayedAuthor}
              error={error?.message ?? null}
              errorRequestId={error?.requestId ?? null}
              loading={loading}
              loadingLabel={
                displayedMode === "outcome" ? "Optimizing for" : "Working with"
              }
              mode={displayedMode}
              mood={displayedMood}
              moodLabel={displayedMoodLabel}
              onApplyRewrite={
                features.rewriteLabEnabled && displayedMode === "author"
                  ? applyLabWinner
                  : undefined
              }
              onRetry={
                lastAttempt && !loading && generationEnabled && !portfolioAccess
                  ? retryLastRewrite
                  : undefined
              }
              onShareRewrite={
                features.publicSharingEnabled ? shareCurrentRewrite : undefined
              }
              onSubmitFeedback={
                features.feedbackEnabled ? submitRewriteFeedback : undefined
              }
              outcomeLabel={displayedOutcomeLabel}
              provenance={latestRun.provenance}
              result={latestRun.rewrite}
              runId={latestRun.runId}
              source={displayedSource}
            />
          </div>
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
