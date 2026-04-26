import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchRewriteById, sanitizePublicRewriteRow } from "../src/server/ghostwriter-fetch.ts";

const GHOSTWRITER_ROUTE_PATH = new URL("../src/app/api/ghostwriter/route.ts", import.meta.url);
const GHOSTWRITER_SHARE_ROUTE_PATH = new URL(
  "../src/app/api/ghostwriter/share/route.ts",
  import.meta.url,
);
const GHOSTWRITER_PAGE_PATH = new URL(
  "../src/components/ghostwriter/GhostwriterPage.tsx",
  import.meta.url,
);
const REWRITE_PLAYBACK_PATH = new URL(
  "../src/components/ghostwriter/RewritePlayback.tsx",
  import.meta.url,
);
const GHOSTWRITER_SERVER_PATH = new URL("../src/server/ghostwriter.ts", import.meta.url);
const SHARE_PAGE_PATH = new URL("../src/app/g/[id]/page.tsx", import.meta.url);

test("public share rows hide source text unless explicitly allowed", () => {
  const row = sanitizePublicRewriteRow({
    author: "tolkien",
    created_at: "2026-04-23T10:00:00.000Z",
    generation_source: "single_rewrite",
    input_text: "keep this secret",
    lab_selection_reason: null,
    lab_winner_label: null,
    lab_winner_score: null,
    mood: 62,
    output_text: "The road goes ever on and on.",
    short_id: "abcd2345",
    source_visible: false,
  });

  assert.equal(row.input_text, "");
  assert.equal(row.generation_source, "single_rewrite");
  assert.equal(row.lab_winner_label, null);
  assert.equal(row.lab_winner_score, null);
  assert.equal(row.lab_selection_reason, null);
  assert.equal(row.source_visible, false);
});

test("public share rows keep source text only when the row explicitly allows it", () => {
  const row = sanitizePublicRewriteRow({
    author: "stephenking",
    created_at: "2026-04-23T10:00:00.000Z",
    generation_source: "single_rewrite",
    input_text: "sometimes dead is better",
    lab_selection_reason: null,
    lab_winner_label: null,
    lab_winner_score: null,
    mood: 72,
    output_text: "Sometimes dead is better.",
    short_id: "bcde3456",
    source_visible: true,
  });

  assert.equal(row.input_text, "sometimes dead is better");
  assert.equal(row.source_visible, true);
});

test("public share rows preserve only safe Rewrite Lab provenance metadata", () => {
  const row = sanitizePublicRewriteRow({
    author: "tolkien",
    created_at: "2026-04-23T10:00:00.000Z",
    generation_source: "rewrite_lab",
    input_text: "keep this source private",
    lab_selection_reason: "The expressive version keeps the meaning while adding rhythm.",
    lab_winner_label: "Add more feeling",
    lab_winner_score: 92,
    mood: 62,
    output_text: "The road remembered him under old stars.",
    short_id: "cdef4567",
    source_visible: false,
  });

  assert.equal(row.input_text, "");
  assert.equal(row.generation_source, "rewrite_lab");
  assert.equal(row.lab_winner_label, "Add more feeling");
  assert.equal(row.lab_winner_score, 92);
  assert.equal(row.lab_selection_reason, "The expressive version keeps the meaning while adding rhythm.");
});

test("rewrite generation stays private while explicit sharing requires consent and challenge", () => {
  const route = readFileSync(GHOSTWRITER_ROUTE_PATH, "utf8");
  const shareRoute = readFileSync(GHOSTWRITER_SHARE_ROUTE_PATH, "utf8");
  const page = readFileSync(GHOSTWRITER_PAGE_PATH, "utf8");
  const playback = readFileSync(REWRITE_PLAYBACK_PATH, "utf8");
  const server = readFileSync(GHOSTWRITER_SERVER_PATH, "utf8");

  assert.match(route, /PUBLIC_REWRITE_SHARE_CONSENT/);
  assert.match(route, /artifactProvenance: RewriteArtifactProvenanceSchema\.optional\(\)/);
  assert.match(route, /shareConsent: z\.literal\(PUBLIC_REWRITE_SHARE_CONSENT\)\.optional\(\)/);
  assert.match(
    route,
    /sharePublicly:\s*parsed\.data\.share && parsed\.data\.shareConsent === PUBLIC_REWRITE_SHARE_CONSENT/,
  );
  assert.match(shareRoute, /shareConsent: z\.literal\(PUBLIC_REWRITE_SHARE_CONSENT\)/);
  assert.match(shareRoute, /validateGhostwriterPost\(/);
  assert.match(shareRoute, /createPublicRewriteArtifact\(/);
  assert.doesNotMatch(shareRoute, /rewriteText\(/);
  assert.match(route, /artifactProvenance:\s*parsed\.data\.artifactProvenance/);
  assert.match(server, /export const RewriteArtifactProvenanceSchema = z\.discriminatedUnion\("source"/);
  assert.match(server, /createPublicRewriteArtifact/);
  assert.match(server, /is_public:\s*true/);
  assert.match(server, /source_visible:\s*shareSourceText/);
  assert.match(server, /\{ shareSourceText: false \}/);
  assert.match(server, /generation_source: "rewrite_lab"/);
  assert.match(server, /generation_source: "single_rewrite"/);
  assert.match(page, /share:\s*false/);
  assert.match(page, /shareConsent:\s*PUBLIC_REWRITE_SHARE_CONSENT/);
  assert.match(playback, /Create public link/);
  assert.match(playback, /The original text stays hidden/);
});

test("public permalink page renders Rewrite Lab provenance when present", () => {
  const sharePage = readFileSync(SHARE_PAGE_PATH, "utf8");

  assert.match(sharePage, /row\.generation_source === "rewrite_lab"/);
  assert.match(sharePage, /Rewrite Lab selected this version/);
  assert.match(sharePage, /row\.lab_winner_label/);
  assert.match(sharePage, /row\.lab_winner_score/);
  assert.match(sharePage, /row\.lab_selection_reason/);
});

test("public rewrite lookups reject non-short-id route parameters", async () => {
  assert.equal(await fetchRewriteById("../secret"), null);
  assert.equal(await fetchRewriteById("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), null);
});
