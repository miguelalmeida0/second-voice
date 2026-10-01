import type { AuthorId } from "@/lib/ghostwriter-shared";

export type PortfolioFilmRewriteFixture = {
  provenance: {
    capturedAt: string;
    mode: "author";
    note: string;
    author: AuthorId;
    mood: number;
    moodLabel: string;
    providerPath: "/api/ghostwriter";
  };
  request: {
    mode: "author";
    author: AuthorId;
    mood: number;
    text: string;
  };
  response: {
    rewrite: string;
  };
};

export const PORTFOLIO_FILM_FIXTURE = {
  provenance: {
    capturedAt: "2026-07-29",
    mode: "author",
    note:
      "Replay-only fixture captured from one successful local provider-backed rewrite. The short-lived signed artifact token was intentionally not retained.",
    author: "tolkien",
    mood: 52,
    moodLabel: "starlit",
    providerPath: "/api/ghostwriter",
  },
  request: {
    mode: "author",
    author: "tolkien",
    mood: 52,
    text:
      "Every winter, the lamps along the harbor went dark one by one. Elias kept the last one burning, though no ship had returned in twenty years.",
  },
  response: {
    rewrite:
      "Each winter the iron lamps that lined the harbor guttered out, one after another, until only darkness lay upon the water's edge. Yet in that cold, starlit hush Elias kept the last lantern burning, though no ship had returned to dock in twenty years.",
  },
} satisfies PortfolioFilmRewriteFixture;
