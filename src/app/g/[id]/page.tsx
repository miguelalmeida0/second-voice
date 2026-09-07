import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, ArrowUpRight, FlaskConical } from "lucide-react";
import { BlurOrbs } from "@/components/ghostwriter/BlurOrbs";
import { diffWords } from "@/components/ghostwriter/diff";
import { fetchRewriteById } from "@/server/ghostwriter-fetch";
import {
  AUTHORS,
  MOOD_NAME,
  moodLabelFor,
  outcomeLabelFor,
  siteOrigin,
} from "@/lib/ghostwriter-shared";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

const getRewriteById = cache(fetchRewriteById);
const PUBLIC_PERMALINK_DIFF_MAX_TOKENS = 600;

function publicDiffTokenCount(value: string): number {
  return value.match(/\s+|[\w'']+|[^\s\w]/g)?.length ?? 0;
}

function canRenderPublicDiff(inputText: string, outputText: string): boolean {
  return (
    publicDiffTokenCount(inputText) <= PUBLIC_PERMALINK_DIFF_MAX_TOKENS &&
    publicDiffTokenCount(outputText) <= PUBLIC_PERMALINK_DIFF_MAX_TOKENS
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const row = await getRewriteById(id);

  if (!row) {
    return {
      title: "Lost in the draft. · Second Voice AI",
      description: "This Second Voice AI permalink could not be found.",
      robots: {
        index: false,
        follow: false,
        noarchive: true,
      },
    };
  }

  const author = row.author;
  const first = AUTHORS.find((entry) => entry.id === author)?.first ?? "Ernest";
  const moodLabel = moodLabelFor(author, row.mood);
  const isOutcomeRewrite = row.rewrite_mode === "outcome" && row.outcome !== null;
  const outcomeLabel = row.outcome ? outcomeLabelFor(row.outcome) : "Improve clarity";
  const title = isOutcomeRewrite
    ? `${outcomeLabel} rewrite`
    : `${first}'s rewrite — ${row.mood}% ${MOOD_NAME[author]} (${moodLabel})`;
  const description = row.output_text.slice(0, 180);
  const ogImage = new URL(`/api/og/${id}`, siteOrigin()).toString();

  return {
    title: `${title} · Second Voice AI`,
    description,
    metadataBase: new URL(siteOrigin()),
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: false,
      follow: false,
      noarchive: true,
    },
  };
}

export default async function GhostwriterPermalinkPage({ params }: PageProps) {
  const { id } = await params;
  const row = await getRewriteById(id);

  if (!row) {
    notFound();
  }

  const author = row.author;
  const moodLabel = moodLabelFor(author, row.mood);
  const isOutcomeRewrite = row.rewrite_mode === "outcome" && row.outcome !== null;
  const outcomeLabel = row.outcome ? outcomeLabelFor(row.outcome) : "Improve clarity";
  const hasSourceText = row.source_visible && row.input_text.trim().length > 0;
  const shouldRenderDiff =
    hasSourceText && canRenderPublicDiff(row.input_text, row.output_text);
  const ops = shouldRenderDiff ? diffWords(row.input_text, row.output_text) : [];
  const createdAt = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(row.created_at),
  );
  const authorMeta = AUTHORS.find((entry) => entry.id === author);
  const first = authorMeta?.first ?? "Ernest";
  const deleteCount = shouldRenderDiff ? ops.filter((op) => op.kind === "delete").length : 0;
  const insertCount = shouldRenderDiff ? ops.filter((op) => op.kind === "insert").length : 0;
  const hasLabProvenance =
    row.generation_source === "rewrite_lab" &&
    Boolean(row.lab_winner_label) &&
    row.lab_winner_score !== null &&
    Boolean(row.lab_selection_reason);

  return (
    <div className="ghostwriter relative min-h-dvh overflow-x-clip" data-voice={author}>
      <BlurOrbs />

      <div className="relative z-10 mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8">
        <div className="flex flex-wrap gap-2">
          <div className="gw-chip gw-voice-text">
            Shared rewrite · {row.short_id}
          </div>
          <Link href="/second-voice" className="gw-chip">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Second Voice AI
          </Link>
          <Link href="/second-voice/case-study" className="gw-chip">
            Read the case study
          </Link>
        </div>

        <section className="mt-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--whisper)]">
            Permalink
          </p>
          <h1 className="mt-4 text-[42px] font-medium leading-[1.03] tracking-tight text-[var(--ghost)] sm:text-[62px]">
            {isOutcomeRewrite ? (
              <>
                <span className="gw-voice-text font-playfair italic">
                  Second Voice
                </span>{" "}
                optimized this line.
              </>
            ) : (
              <>
                <span className="gw-voice-text font-playfair italic">
                  {first}
                </span>{" "}
                took a pass at this line.
              </>
            )}
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--mist)] sm:text-[18px]">
            {isOutcomeRewrite
              ? `${outcomeLabel} · Created ${createdAt}`
              : `${row.mood}% ${MOOD_NAME[author]} · ${moodLabel} · Created ${createdAt}`}
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="gw-card p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--whisper)]">
              Edit profile
            </p>
            <p className="mt-3 text-[15px] text-[var(--ghost)]">
              {isOutcomeRewrite
                ? "Outcome optimization"
                : hasLabProvenance
                ? "Rewrite Lab winner"
                : shouldRenderDiff
                  ? `${deleteCount} cuts · ${insertCount} additions`
                  : hasSourceText
                    ? "Source visible"
                  : "Rewrite only"}
            </p>
          </div>
          <div className="gw-card p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--whisper)]">
              {isOutcomeRewrite ? "Outcome" : "Author"}
            </p>
            <p className="mt-3 text-[15px] text-[var(--ghost)]">
              {isOutcomeRewrite ? outcomeLabel : authorMeta?.name ?? first}
            </p>
          </div>
          <div className="gw-card p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--whisper)]">
              {isOutcomeRewrite ? "Mode" : "Mood band"}
            </p>
            <p className="mt-3 text-[15px] text-[var(--ghost)]">
              {isOutcomeRewrite ? "Outcome" : moodLabel}
            </p>
          </div>
        </section>

        {hasLabProvenance ? (
          <section className="mt-6">
            <div className="gw-card gw-share-provenance p-5 sm:p-6">
              <div className="gw-share-provenance-heading">
                <FlaskConical className="h-4 w-4" aria-hidden />
                <p>Rewrite Lab selected this version</p>
              </div>
              <div className="gw-share-provenance-grid">
                <div>
                  <span>Winning direction</span>
                  <strong>{row.lab_winner_label}</strong>
                </div>
                <div>
                  <span>Overall score</span>
                  <strong>{row.lab_winner_score}/100</strong>
                </div>
              </div>
              <p className="gw-share-provenance-reason">{row.lab_selection_reason}</p>
            </div>
          </section>
        ) : null}

        <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {hasSourceText ? (
            <div className="gw-card p-6 sm:p-8">
              <h2 className="font-playfair text-xl italic text-[var(--ghost)]">Original</h2>
              <div className="gw-embedded-panel mt-4 rounded-2xl border bg-black/20 p-4 text-[18px] leading-relaxed text-[var(--ghost)]">
                {row.input_text}
              </div>
            </div>
          ) : (
            <div className="gw-card p-6 sm:p-8">
              <h2 className="font-playfair text-xl italic text-[var(--ghost)]">Source text</h2>
              <div className="gw-embedded-panel mt-4 rounded-2xl border bg-black/20 p-4 text-[16px] leading-relaxed text-[var(--mist)]">
                Hidden for privacy. This public link stores the rewritten passage only.
              </div>
            </div>
          )}

          <div className="gw-card-strong p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="gw-voice-text font-playfair text-xl italic">
                {isOutcomeRewrite ? "Outcome rewrite" : `${first}'s rewrite`}
              </h2>
              <span className="text-[11px] text-[var(--whisper)]">
                final passage
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--mist)]">
              This version is stored as the clean finished edit, not the intermediate redline.
            </p>
            <div className="gw-embedded-panel mt-4 rounded-2xl border bg-black/20 p-4 text-[18px] leading-relaxed text-[var(--ghost)]">
              {row.output_text}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="gw-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] leading-relaxed text-[var(--mist)]">
                Open the main app to try a different author, outcome, mood, or sentence.
              </p>
              <Link href="/second-voice" className="gw-chip">
                Open Second Voice AI
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
