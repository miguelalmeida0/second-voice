import {
  AUTHORS,
  FIRST,
  MOOD_NAME,
  TINT_HEX,
  moodLabelFor,
  outcomeLabelFor,
} from "@/lib/ghostwriter-shared";
import { buildNoStoreHeaders } from "@/lib/security-http";
import { fetchRewriteById } from "@/server/ghostwriter-fetch";

type SvgSpan = {
  text: string;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function buildLines(text: string, maxChars: number, maxLines: number): SvgSpan[][] {
  const exploded: SvgSpan[] = (text.match(/\s+|[^\s]+/g) ?? []).map((token) => ({ text: token }));

  const lines: SvgSpan[][] = [[]];
  let currentLength = 0;

  for (const token of exploded) {
    const tokenLength = token.text.length;
    const isWhitespace = /^\s+$/.test(token.text);
    const currentLine = lines[lines.length - 1];

    if (!isWhitespace && currentLength + tokenLength > maxChars && currentLine.length > 0) {
      if (lines.length === maxLines) {
        break;
      }
      lines.push([]);
      currentLength = 0;
    }

    lines[lines.length - 1].push(token);
    currentLength += tokenLength;
  }

  return lines.map((line) => {
    const next = [...line];
    if (next[0]) {
      next[0] = { ...next[0], text: next[0].text.replace(/^\s+/, "") };
    }
    return next;
  });
}

function svgTextForLine(line: SvgSpan[], tint: string) {
  return line
    .map((span) => {
      const text = escapeXml(span.text);
      return `<tspan fill="${tint}" font-family="'Playfair Display', Georgia, serif" font-style="italic">${text}</tspan>`;
    })
    .join("");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const row = await fetchRewriteById(id);
  if (!row) return new Response(null, { status: 404, headers: buildNoStoreHeaders() });

  const author = row?.author ?? "hemingway";
  const tint = TINT_HEX[author];
  const first = FIRST[author];
  const mood = row?.mood ?? 50;
  const moodLabel = moodLabelFor(author, mood);
  const isOutcomeRewrite = row ? row.rewrite_mode === "outcome" && row.outcome !== null : false;
  const outcomeLabel = row?.outcome ? outcomeLabelFor(row.outcome) : "Improve clarity";
  const lines = buildLines(row?.output_text || "Second Voice AI", 50, 7);
  const subtitle = isOutcomeRewrite
    ? `Outcome rewrite · ${outcomeLabel}`
    : `${first}'s rewrite · ${mood}% ${MOOD_NAME[author]} · ${moodLabel}`;
  const authorName = AUTHORS.find((entry) => entry.id === author)?.name ?? "Ernest Hemingway";
  const headline = isOutcomeRewrite ? "Outcome rewrite" : `${first}'s rewrite`;
  const byline = isOutcomeRewrite ? outcomeLabel : authorName;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
          <stop stop-color="#15141a" />
          <stop offset="1" stop-color="#1f1b25" />
        </linearGradient>
        <radialGradient id="glowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(975 60) rotate(126.027) scale(374.396 327.469)">
          <stop stop-color="${tint}" stop-opacity="0.24" />
          <stop offset="1" stop-color="${tint}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(150 560) rotate(-13.807) scale(340.627 278.216)">
          <stop stop-color="#d8f08a" stop-opacity="0.18" />
          <stop offset="1" stop-color="#d8f08a" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)" rx="36" />
      <rect width="1200" height="630" fill="url(#glowA)" rx="36" />
      <rect width="1200" height="630" fill="url(#glowB)" rx="36" />

      <text x="84" y="76" fill="${tint}" font-family="Inter, Arial, sans-serif" font-size="22" letter-spacing="-0.02em">
        SECOND VOICE AI · ${escapeXml(subtitle)}
      </text>
      <text x="84" y="145" fill="#f5f0e6" font-family="'Playfair Display', Georgia, serif" font-size="56" font-style="italic">
        ${escapeXml(headline)}
      </text>
      <text x="84" y="182" fill="#9b93a8" font-family="Inter, Arial, sans-serif" font-size="22">
        ${escapeXml(byline)}
      </text>

      ${lines
        .map(
          (line, index) => `
        <text x="84" y="${240 + index * 47}" font-family="Inter, Arial, sans-serif" font-size="31" letter-spacing="-0.02em">
          ${svgTextForLine(line, tint)}
        </text>`,
        )
        .join("")}

      <line x1="84" y1="558" x2="1116" y2="558" stroke="rgba(255,255,255,0.12)" />
      <text x="84" y="595" fill="#9b93a8" font-family="Inter, Arial, sans-serif" font-size="22">
        Private source hidden · try Second Voice AI → /second-voice
      </text>
    </svg>
  `.trim();

  return new Response(svg, {
    status: 200,
    headers: new Headers({
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...Object.fromEntries(buildNoStoreHeaders().entries()),
    }),
  });
}
