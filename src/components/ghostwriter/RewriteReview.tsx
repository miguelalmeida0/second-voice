"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  LockKeyhole,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { writeClipboardText } from "./clipboard";
import {
  buildReviewParts,
  buildReviewText,
  createReviewState,
  reviewReducer,
  type ReviewPart,
} from "./rewrite-review";
import styles from "./RewriteReview.module.css";

type View = "duet" | "inline" | "focus";
type Change = Extract<ReviewPart, { kind: "change" }>;
const decisionLabel = {
  pending: "pending",
  accept: "accepted",
  keep: "original kept",
};
const layouts = [
  ["duet", "Duet", "Side by side"],
  ["inline", "Inline", "Changes in context"],
  ["focus", "Focus", "One at a time"],
] as const;
const contextSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

function truncateContext(text: string, side: "before" | "after") {
  const graphemes = Array.from(
    contextSegmenter.segment(text),
    ({ segment }) => segment,
  );
  if (graphemes.length <= 110) return text;
  return side === "before"
    ? `…${graphemes.slice(-110).join("")}`
    : `${graphemes.slice(0, 110).join("")}…`;
}

export function RewriteReview({
  source,
  result,
  hidden,
  onClose,
  backLabel = "Back to rewrite",
}: {
  source: string;
  result: string;
  hidden: boolean;
  onClose: () => void;
  backLabel?: string;
}) {
  const parts = useMemo(
    () => buildReviewParts(source, result),
    [source, result],
  );
  const changes = useMemo(
    () => parts.filter((part): part is Change => part.kind === "change"),
    [parts],
  );
  const [state, dispatch] = useReducer(reviewReducer, parts, createReviewState);
  const [view, setView] = useState<View>("duet");
  const [selected, setSelected] = useState(0);
  const [copyState, setCopyState] = useState<{
    text: string;
    preview: boolean;
    error?: string;
  } | null>(null);
  const [copying, setCopying] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const manualRevisionRef = useRef<HTMLTextAreaElement>(null);
  const revision = buildReviewText(parts, state);
  const reviewed = state.decisions.filter(
    (decision) => decision !== "pending",
  ).length;
  const pending = reviewed < changes.length;
  const edit = changes[selected];
  const copied =
    copyState?.text === revision &&
    copyState.preview === pending &&
    !copyState.error;
  const copyError =
    copyState?.text === revision && copyState.preview === pending
      ? copyState.error
      : null;

  useLayoutEffect(() => {
    if (!hidden) workspaceRef.current?.focus({ preventScroll: true });
  }, [hidden]);

  function decide(decision: "accept" | "keep") {
    if (!edit) return;
    dispatch({ type: "decide", id: edit.id, decision });
    const next =
      changes.find(
        (change) =>
          change.id > selected && state.decisions[change.id] === "pending",
      ) ??
      changes.find(
        (change) =>
          change.id !== selected && state.decisions[change.id] === "pending",
      );
    if (next) setSelected(next.id);
  }

  async function copyRevision() {
    if (copying) return;
    const text = revision;
    const preview = pending;
    setCopying(true);
    setCopyState(null);
    try {
      await writeClipboardText(text);
      setCopyState({ text, preview });
    } catch {
      setCopyState({
        text,
        preview,
        error: "Copy failed. Select the rewrite and copy it manually.",
      });
    } finally {
      setCopying(false);
    }
  }

  useLayoutEffect(() => {
    const element = manualRevisionRef.current;
    if (!element || hidden) return;
    let previousWidth = -1;
    const resize = () => {
      const width = element.getBoundingClientRect().width;
      if (!width || width === previousWidth) return;
      previousWidth = width;
      element.style.height = "auto";
      const borderHeight = element.offsetHeight - element.clientHeight;
      element.style.height = `${element.scrollHeight + borderHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [copyError, hidden, revision]);

  function selectRevisionText() {
    const element = manualRevisionRef.current;
    if (!element) return;
    element.focus({ preventScroll: true });
    element.select();
  }

  function prose(side: "source" | "revision" | "inline") {
    return parts.map((part, index) => {
      if (part.kind === "equal")
        return <span key={`equal-${index}`}>{part.text}</span>;
      const decision = state.decisions[part.id];
      const tracked = side === "inline" && decision === "pending";
      const text =
        side === "source" || decision === "keep"
          ? part.original
          : part.suggestion;
      return (
        <span
          key={part.id}
          role="button"
          tabIndex={0}
          aria-pressed={selected === part.id}
          aria-label={`Change ${part.id + 1}: ${part.original || "insertion"} → ${part.suggestion || "deletion"}; ${decisionLabel[decision]}`}
          className={styles.edit}
          data-selected={selected === part.id}
          data-decision={decision}
          onClick={() => setSelected(part.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelected(part.id);
            }
          }}
        >
          {tracked ? (
            <>
              {part.original && <del>{part.original}</del>}
              {part.suggestion && <ins>{part.suggestion}</ins>}
            </>
          ) : (
            text || (
              <span aria-hidden="true" className={styles.empty}>
                ∅
              </span>
            )
          )}
        </span>
      );
    });
  }

  const partIndex = edit ? parts.indexOf(edit) : -1;
  const originalSlice = (slice: ReviewPart[]) =>
    slice
      .map((part) => (part.kind === "equal" ? part.text : part.original))
      .join("");
  const before = originalSlice(parts.slice(0, partIndex));
  const after = originalSlice(parts.slice(partIndex + 1));
  const context = edit
    ? `${truncateContext(before, "before")}${edit.original}${truncateContext(after, "after")}`
    : "";

  return (
    <section
      ref={workspaceRef}
      tabIndex={-1}
      className={styles.workspace}
      aria-label="Review your rewrite"
      hidden={hidden}
      data-view={view}
    >
      <section className={styles.left} aria-labelledby="review-source-title">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>
            {view === "inline"
              ? "01 / Your draft. Every change."
              : "01 / Your draft"}
          </p>
          <h2 id="review-source-title">
            {view === "inline" ? "Your words. Refined." : "Your words."}
          </h2>
        </div>
        <div className={styles.documentMeta}>
          <span>Your original draft</span>
          <button type="button" onClick={onClose}>
            <ArrowLeft aria-hidden="true" />
            {backLabel}
          </button>
        </div>
        <div className={styles.sourcePaper} data-testid="review-source-paper">
          {view === "focus" && edit ? (
            <>
              <p className={styles.kicker}>Your original phrase</p>
              <p className={styles.phrase}>
                {edit.original || "Insert new text"}
              </p>
              <p className={styles.context}>{context}</p>
            </>
          ) : (
            <div className={styles.prose} data-testid="review-original">
              {prose(view === "inline" ? "inline" : "source")}
            </div>
          )}
        </div>
        <div className={styles.belowPaper}>
          <p className={styles.proof}>
            <LockKeyhole aria-hidden="true" />
            Your original stays untouched.
          </p>
          {view === "focus" && (
            <details className={styles.fullDraft}>
              <summary>Read the full original</summary>
              <p className={styles.prose} data-testid="full-original">
                {source}
              </p>
            </details>
          )}
          <div className={styles.sourceBottom}>
            <p>
              Review edits are local to this session. Public links and feedback
              use the original rewrite.
            </p>
          </div>
        </div>
      </section>
      <section className={styles.right} aria-labelledby="review-result-title">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>02 / Their voice. Your choice.</p>
          <h2 id="review-result-title">
            {view === "inline" ? "Your final say." : "Another voice."}
          </h2>
        </div>
        <div className={styles.documentTools}>
          <div className={styles.layouts} role="group" aria-label="Review layout">
            {layouts.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                title={description}
                aria-pressed={view === value}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className={styles.acceptAll}
            type="button"
            disabled={!changes.length || state.decisions.every((decision) => decision === "accept")}
            onClick={() => dispatch({ type: "accept-all" })}
          >
            <Check aria-hidden="true" />
            Accept all changes
          </button>
        </div>
        <div
          className={`${styles.reviewPaper} ${view === "inline" ? styles.inspector : ""}`}
          data-testid="review-result-paper"
        >
          {view === "inline" && changes.length ? (
            <>
              <div className={styles.changeList}>
                {changes.map((change) => (
                  <button
                    key={change.id}
                    type="button"
                    aria-label={`Select change ${change.id + 1}`}
                    aria-pressed={selected === change.id}
                    onClick={() => setSelected(change.id)}
                  >
                    <span className={styles.changeIndex}>
                      {String(change.id + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.changeSummary}>
                      {change.suggestion || `Remove “${change.original}”`}
                    </span>
                    <span className={styles.decision}>
                      {decisionLabel[state.decisions[change.id]]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : view === "focus" && edit ? (
            <>
              <p className={styles.kicker}>Suggested phrase</p>
              <p className={styles.phrase}>
                {edit.suggestion || "Remove this text"}
              </p>
              <p className={styles.context}>
                Read this suggestion alongside your original, then choose the
                wording you want to keep.
              </p>
            </>
          ) : (
            <div className={styles.prose} data-testid="review-revision">
              {prose("revision")}
            </div>
          )}
        </div>
        <div className={styles.belowPaper}>
          <div className={styles.progress}>
            <p role="status" aria-live="polite" aria-atomic="true">
              {reviewed} of {changes.length} reviewed
              {copied
                ? pending
                  ? " · Preview copied, including pending suggestions"
                  : " · Revision copied"
                : ""}
            </p>
            <div
              className={styles.progressDots}
              role="group"
              aria-label="Select a change"
            >
              {changes
                .filter(
                  (change) =>
                    changes.length <= 7 || Math.abs(change.id - selected) <= 2,
                )
                .map((change) => (
                  <button
                    key={change.id}
                    type="button"
                    aria-label={`Change ${change.id + 1}, ${decisionLabel[state.decisions[change.id]]}`}
                    aria-current={selected === change.id ? "true" : undefined}
                    data-done={state.decisions[change.id] !== "pending"}
                    onClick={() => setSelected(change.id)}
                  >
                    {state.decisions[change.id] === "accept"
                      ? "✓"
                      : state.decisions[change.id] === "keep"
                        ? "−"
                        : change.id + 1}
                  </button>
                ))}
            </div>
          </div>
          <div className={styles.controls}>
            {edit ? (
              <>
                <div className={styles.changeNav}>
                  <p>
                    Change {selected + 1} of {changes.length} ·{" "}
                    {decisionLabel[state.decisions[selected]]}
                  </p>
                  <div>
                    <button
                      type="button"
                      aria-label="Previous change"
                      disabled={selected === 0}
                      onClick={() => setSelected(selected - 1)}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next change"
                      disabled={selected === changes.length - 1}
                      onClick={() => setSelected(selected + 1)}
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {view !== "focus" && (
                  <div className={styles.comparison} aria-label="Selected change">
                    <del>{edit.original || "No text"}</del>
                    <ArrowRight aria-hidden="true" />
                    <span>{edit.suggestion || "Remove this text"}</span>
                  </div>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    aria-pressed={state.decisions[selected] === "keep"}
                    onClick={() => decide("keep")}
                  >
                    Keep original
                  </button>
                  <button
                    className={styles.accept}
                    type="button"
                    aria-pressed={state.decisions[selected] === "accept"}
                    onClick={() => decide("accept")}
                  >
                    Accept change
                    <Check aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : null}
            {!pending && (
              <div className={styles.completion}>
                <p>
                  {changes.length
                    ? `${state.decisions.filter((decision) => decision === "accept").length} accepted · ${state.decisions.filter((decision) => decision === "keep").length} kept original. Your revision is ready to copy.`
                    : "Both versions are identical. There is nothing to review."}
                </p>
              </div>
            )}
          </div>
          <footer className={styles.footer}>
            <div>
              <button
                type="button"
                disabled={!state.history.length}
                onClick={() => {
                  setSelected(state.history.at(-1)?.[0]?.id ?? 0);
                  dispatch({ type: "undo" });
                }}
              >
                <Undo2 aria-hidden="true" />
                Undo
              </button>
              <button
                type="button"
                disabled={!reviewed}
                onClick={() => {
                  dispatch({ type: "reset" });
                  setSelected(0);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Reset
              </button>
            </div>
            <button
              type="button"
              className={styles.copy}
              aria-disabled={copying}
              onClick={() => void copyRevision()}
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copying
                ? "Copying…"
                : copied
                  ? pending
                    ? "Preview copied"
                    : "Revision copied"
                  : pending
                    ? "Copy preview"
                    : "Copy revision"}
            </button>
          </footer>
          {view === "focus" && (
            <details className={styles.fullDraft}>
              <summary>Read the full revision</summary>
              <p className={styles.prose}>{revision}</p>
            </details>
          )}
          {copyError && (
            <div className={styles.manualRecovery}>
              <p className={styles.copyError} role="alert">
                {copyError}
              </p>
              <p>Select this revision, then use your browser’s Copy command.</p>
              <textarea
                ref={manualRevisionRef}
                id="review-manual-revision"
                aria-label="Revision for manual copying"
                aria-readonly="true"
                aria-multiline="true"
                readOnly
                rows={1}
                value={revision}
                className={`${styles.prose} ${styles.manualRevision}`}
              />
              <button
                type="button"
                aria-controls="review-manual-revision"
                onClick={selectRevisionText}
              >
                Select revision text
              </button>
            </div>
          )}
          {pending && (
            <p className={styles.previewNote}>
              Your preview includes suggestions you haven’t reviewed yet.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}
