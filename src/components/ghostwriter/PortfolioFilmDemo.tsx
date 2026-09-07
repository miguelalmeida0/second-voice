"use client";

import { MousePointer2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AUTHORS,
  AuthorOrbital,
} from "@/components/ghostwriter/AuthorOrbital";
import {
  RewritePlayback,
  type RewritePlaybackPhase,
} from "@/components/ghostwriter/RewritePlayback";
import { PORTFOLIO_FILM_FIXTURE } from "@/lib/ghostwriter-portfolio-film-fixture";
import { type AuthorId } from "@/lib/ghostwriter-shared";
import styles from "./PortfolioFilmDemo.module.css";

type CameraState = "review" | "source" | "wide";
type CursorState = {
  duration: number;
  pressed: boolean;
  visible: boolean;
  x: number;
  y: number;
};

const FILM_DURATION_MS = 9_400;
const FILM_AUTHOR = AUTHORS.find(
  (author) => author.id === PORTFOLIO_FILM_FIXTURE.request.author,
) ?? AUTHORS[0];

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
  );
}

export function PortfolioFilmDemo({
  captureMode,
  once,
}: {
  captureMode: boolean;
  once: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const completeResolverRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef(false);
  const [camera, setCamera] = useState<CameraState>("wide");
  const [copied, setCopied] = useState(false);
  const [cursor, setCursor] = useState<CursorState>({
    duration: 0,
    pressed: false,
    visible: false,
    x: -60,
    y: 760,
  });
  const [dimmed, setDimmed] = useState(false);
  const [fadeVisible, setFadeVisible] = useState(false);
  const [filmComplete, setFilmComplete] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
  const [authorId, setAuthorId] = useState<AuthorId | null>(null);
  const [playbackPhase, setPlaybackPhase] =
    useState<RewritePlaybackPhase>("idle");
  const [pressed, setPressed] = useState(false);
  const [result, setResult] = useState("");
  const [runId, setRunId] = useState(0);
  const [source, setSource] = useState(PORTFOLIO_FILM_FIXTURE.request.text);
  const playbackCompleteRef = useRef(false);

  const footerLabel =
    copied
      ? "Revision copied · user confirmed"
      : result && playbackPhase === "complete"
        ? "Revision ready · choose what to keep"
      : result
        ? "Reviewing the change"
        : authorId === "tolkien"
          ? "Author selected · Tolkien"
          : "Draft ready";

  function moveCursorTo(
    target: Element | null,
    {
      duration = 480,
      offsetX = 0,
      offsetY = 0,
    }: { duration?: number; offsetX?: number; offsetY?: number } = {},
  ) {
    const stage = stageRef.current;
    if (!stage || !target) {
      return;
    }

    const stageBox = stage.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();

    setCursor((current) => ({
      ...current,
      duration,
      visible: true,
      x: targetBox.left - stageBox.left + targetBox.width / 2 + offsetX,
      y: targetBox.top - stageBox.top + targetBox.height / 2 + offsetY,
    }));
  }

  async function pressCursor() {
    setCursor((current) => ({ ...current, pressed: true }));
    await delay(110);
    setCursor((current) => ({ ...current, pressed: false }));
  }

  function handlePlaybackPhase(phase: RewritePlaybackPhase) {
    setPlaybackPhase(phase);
    playbackCompleteRef.current = phase === "complete";
    if (phase === "complete") {
      completeResolverRef.current?.();
      completeResolverRef.current = null;
    }
  }

  useEffect(() => {
    cancelledRef.current = false;

    async function resetFilm() {
      setFadeVisible(true);
      await delay(280);
      setDimmed(true);
      setCamera("wide");
      setCopied(false);
      setCursor({
        duration: 0,
        pressed: false,
        visible: false,
        x: -60,
        y: 760,
      });
      setAuthorId(null);
      setPressed(false);
      setPlaybackPhase("idle");
      setResult("");
      setRunId(0);
      setSource(PORTFOLIO_FILM_FIXTURE.request.text);
      setFilmComplete(false);
      playbackCompleteRef.current = false;
      textareaRef.current?.blur();
      await nextFrame();
      setDimmed(false);
      setFadeVisible(false);
      await delay(340);
    }

    async function runFilm() {
      const startedAt = window.performance.now();
      const stage = stageRef.current;
      const textarea = textareaRef.current;
      if (!stage || !textarea || cancelledRef.current) {
        return;
      }

      setFilmComplete(false);
      playbackCompleteRef.current = false;

      await delay(620);
      moveCursorTo(textarea, { duration: 520, offsetX: -80, offsetY: -24 });
      setCamera("source");
      await delay(560);
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(0, textarea.value.length);
      await pressCursor();
      await delay(310);

      const tolkienButton = stage.querySelector('[data-author="tolkien"]');
      moveCursorTo(tolkienButton, { duration: 520, offsetX: 18, offsetY: 2 });
      await delay(560);
      await pressCursor();
      setAuthorId("tolkien");
      await delay(260);

      const rewriteButton = stage.querySelector('[data-film-action="rewrite"]');
      moveCursorTo(rewriteButton, { duration: 460, offsetX: 24, offsetY: 0 });
      await delay(500);
      setPressed(true);
      await pressCursor();
      setPressed(false);
      textarea.blur();
      setCamera("review");

      const playbackComplete = new Promise<void>((resolve) => {
        completeResolverRef.current = resolve;
      });

      setRunId(1);
      setResult(PORTFOLIO_FILM_FIXTURE.response.rewrite);

      await Promise.race([playbackComplete, delay(3_800)]);
      if (cancelledRef.current) {
        return;
      }

      await delay(380);
      const copyButton = stage.querySelector(".gw-copy-result");
      moveCursorTo(copyButton, { duration: 480, offsetX: -2, offsetY: 2 });
      await delay(520);
      await pressCursor();
      if (copyButton instanceof HTMLButtonElement) {
        copyButton.click();
        setCopied(true);
      }

      await delay(720);
      setCamera("wide");
      setCursor((current) => ({
        ...current,
        duration: 560,
        x: stage.clientWidth + 70,
        y: stage.clientHeight - 110,
      }));

      const elapsed = window.performance.now() - startedAt;
      await delay(Math.max(0, FILM_DURATION_MS - elapsed - 760));
      setFadeVisible(true);
      await delay(280);
      setDimmed(true);
      setCopied(false);
      setAuthorId(null);
      setPlaybackPhase("idle");
      setResult("");
      setRunId(0);
      setCamera("wide");
      playbackCompleteRef.current = false;
      textarea.blur();
      await nextFrame();
      setDimmed(false);
      setFadeVisible(false);
      setCursor((current) => ({ ...current, visible: false }));
      await delay(360);
      setFilmComplete(true);
    }

    async function start() {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
      await nextFrame();
      setFilmReady(true);

      if (captureMode) {
        await new Promise<void>((resolve) => {
          window.addEventListener("ghostwriter-film-start", () => resolve(), {
            once: true,
          });
        });
      }

      do {
        await runFilm();
        if (!once && !cancelledRef.current) {
          await delay(520);
          await resetFilm();
        }
      } while (!once && !cancelledRef.current);
    }

    void start();

    return () => {
      cancelledRef.current = true;
      completeResolverRef.current = null;
    };
  }, [captureMode, once]);

  const cursorStyle = {
    "--cursor-duration": `${cursor.duration}ms`,
    "--cursor-x": `${cursor.x}px`,
    "--cursor-y": `${cursor.y}px`,
  } as CSSProperties;

  return (
    <main className={`ghostwriter ${styles.page}`}>
      <div
        ref={stageRef}
        className={styles.stage}
        data-film-complete={filmComplete}
        data-film-duration={FILM_DURATION_MS}
        data-film-ready={filmReady}
        data-testid="ghostwriter-portfolio-film"
      >
        <div
          className={styles.scene}
          data-camera={camera}
          data-dimmed={dimmed}
        >
          <header className={styles.masthead}>
            <span className={styles.wordmark}>Second Voice</span>
            <span>Author edit · synthetic draft</span>
          </header>

          <div className={styles.workspace}>
            <section className={styles.editor} aria-labelledby="film-draft-title">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Working draft</p>
                  <h1 id="film-draft-title">The last harbor light</h1>
                </div>
                <span className={styles.draftState}>Local draft</span>
              </div>

              <div className={styles.authors}>
                <AuthorOrbital active={authorId} onSelect={setAuthorId} />
              </div>

              <div className={styles.writingSurface}>
                <label className={styles.writingLabel} htmlFor="film-source">
                  Selected passage
                </label>
                <textarea
                  ref={textareaRef}
                  id="film-source"
                  maxLength={2000}
                  onChange={(event) => setSource(event.target.value)}
                  rows={6}
                  value={source}
                />
              </div>

              <div className={styles.actionRow}>
                <span className={styles.actionHint}>
                  Meaning stays fixed. Wording can change.
                </span>
                <button
                  type="button"
                  className={styles.rewriteButton}
                  data-film-action="rewrite"
                  data-pressed={pressed}
                  onClick={() => {
                    setRunId((current) => current + 1);
                    setResult(PORTFOLIO_FILM_FIXTURE.response.rewrite);
                  }}
                >
                  {authorId ? `Rewrite as ${FILM_AUTHOR.cardTitle}` : "Choose a writer"}
                </button>
              </div>
            </section>

            <section className={styles.review} aria-label="Inspectable revision">
              <RewritePlayback
                author={authorId ? FILM_AUTHOR : null}
                error={null}
                loading={false}
                loadingLabel="Rewriting with"
                mode="author"
                mood={PORTFOLIO_FILM_FIXTURE.request.mood}
                moodLabel={PORTFOLIO_FILM_FIXTURE.provenance.moodLabel}
                onPhaseChange={handlePlaybackPhase}
                playbackRate={2}
                result={result}
                runId={runId}
                source={source}
              />
            </section>
          </div>

          <footer className={styles.footer}>
            <span className={styles.footerStatus}>{footerLabel}</span>
            <span>Private by default · no source stored</span>
          </footer>
        </div>

        <div
          className={styles.cursor}
          data-pressed={cursor.pressed}
          data-visible={cursor.visible}
          style={cursorStyle}
          aria-hidden
        >
          <MousePointer2 />
        </div>

        <div
          className={styles.fade}
          data-visible={fadeVisible}
          aria-hidden
        />
      </div>
    </main>
  );
}
