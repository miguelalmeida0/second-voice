export type AuthorId = "hemingway" | "tolkien" | "tolstoy" | "stephenking";
export type RewriteMode = "author" | "outcome";
export type OutcomeId = "clarity" | "reply" | "confident" | "concise" | "persuasive";
export type StoredAuthorId =
  | AuthorId
  | "didion"
  | "graham"
  | "naval";

export type AuthorMeta = {
  byline: string;
  cardTitle: string;
  id: AuthorId;
  name: string;
  first: string;
  trait: string;
  era: string;
  tint: "lime" | "lilac" | "peach" | "sky";
};

export type Sample = {
  label: string;
  text: string;
};

export type DemoPreset = {
  author: AuthorId;
  id: string;
  label: string;
  mood: number;
  text: string;
};

export type OutcomeMeta = {
  id: OutcomeId;
  instruction: string;
  label: string;
  trait: string;
};

export const DEFAULT_REWRITE_MODE: RewriteMode = "author";
export const DEFAULT_OUTCOME_ID: OutcomeId = "clarity";

export const OUTCOMES: OutcomeMeta[] = [
  {
    id: "clarity",
    instruction: "improve clarity and readability",
    label: "Improve clarity",
    trait: "Clearer, smoother, easier to understand.",
  },
  {
    id: "reply",
    instruction: "increase likelihood of getting a response",
    label: "Get a reply",
    trait: "Warm, direct, easy to answer.",
  },
  {
    id: "confident",
    instruction: "sound confident but not aggressive",
    label: "Sound confident",
    trait: "Assured, grounded, never pushy.",
  },
  {
    id: "concise",
    instruction: "be concise and to the point",
    label: "Be concise",
    trait: "Shorter, sharper, still natural.",
  },
  {
    id: "persuasive",
    instruction: "be more persuasive while staying natural",
    label: "Be persuasive",
    trait: "Stronger case, human tone.",
  },
];

export const AUTHORS: AuthorMeta[] = [
  {
    byline: "J.R.R.",
    cardTitle: "Tolkien",
    id: "tolkien",
    name: "J.R.R. Tolkien",
    first: "Tolkien",
    trait: "Mythic, lyrical, old-world cadence.",
    era: "1892 — 1973",
    tint: "sky",
  },
  {
    byline: "Stephen",
    cardTitle: "King",
    id: "stephenking",
    name: "Stephen King",
    first: "King",
    trait: "Immediate, vivid, unsettling, sharply human.",
    era: "b. 1947",
    tint: "lilac",
  },
  {
    byline: "Leo",
    cardTitle: "Tolstoy",
    id: "tolstoy",
    name: "Leo Tolstoy",
    first: "Tolstoy",
    trait: "Moral depth, human detail, emotional force.",
    era: "1828 — 1910",
    tint: "lime",
  },
  {
    byline: "Ernest",
    cardTitle: "Hemingway",
    id: "hemingway",
    name: "Ernest Hemingway",
    first: "Hemingway",
    trait: "Short, declarative, no flourish.",
    era: "1899 — 1961",
    tint: "peach",
  },
];

export const SAMPLES: Sample[] = [
  {
    label: "A rainy day thought",
    text: "The rain started before lunch and suddenly the whole day felt softer, like the world had decided nobody needed to rush anywhere.",
  },
  {
    label: "A note to future me",
    text: "If you are reading this on a hard day, please remember that being tired is not the same thing as failing.",
  },
  {
    label: "A tiny comfort spell",
    text: "May your tea stay warm, your socks stay dry, and the part of your brain that invents disasters take the evening off.",
  },
  {
    label: "A moonlit thought",
    text: "Maybe the moon only looks that gentle because everybody who is awake this late needs a little company.",
  },
  {
    label: "A cat observation",
    text: "He acts like he owns the apartment, but every night he waits outside the bathroom door like a tiny anxious bodyguard.",
  },
  {
    label: "A soft end-of-day note",
    text: "Today was not dramatic or impressive, but I made it through, and I think that should count for something.",
  },
];

export const DEMO_PRESETS: DemoPreset[] = [
  {
    author: "tolkien",
    id: "rainy-starlit",
    label: "Rainy day to Tolkien",
    mood: 76,
    text: "The rain started before lunch and suddenly the whole day felt softer, like the world had decided nobody needed to rush anywhere.",
  },
  {
    author: "stephenking",
    id: "moon-dread",
    label: "Moonlit thought to King",
    mood: 54,
    text: "Maybe the moon only looks that gentle because everybody who is awake this late needs a little company.",
  },
  {
    author: "tolstoy",
    id: "future-grace",
    label: "Future me to Tolstoy",
    mood: 67,
    text: "If you are reading this on a hard day, please remember that being tired is not the same thing as failing.",
  },
  {
    author: "hemingway",
    id: "comfort-clean",
    label: "Comfort spell to Hemingway",
    mood: 28,
    text: "May your tea stay warm, your socks stay dry, and the part of your brain that invents disasters take the evening off.",
  },
  {
    author: "tolkien",
    id: "cat-lantern",
    label: "Cat observation to Tolkien",
    mood: 63,
    text: "He acts like he owns the apartment, but every night he waits outside the bathroom door like a tiny anxious bodyguard.",
  },
  {
    author: "stephenking",
    id: "day-whisper",
    label: "End-of-day note to King",
    mood: 44,
    text: "Today was not dramatic or impressive, but I made it through, and I think that should count for something.",
  },
  {
    author: "tolstoy",
    id: "comfort-ritual",
    label: "Comfort spell to Tolstoy",
    mood: 72,
    text: "May your tea stay warm, your socks stay dry, and the part of your brain that invents disasters take the evening off.",
  },
  {
    author: "hemingway",
    id: "future-steady",
    label: "Future me to Hemingway",
    mood: 34,
    text: "If you are reading this on a hard day, please remember that being tired is not the same thing as failing.",
  },
];

export const TINT_HEX: Record<AuthorId, string> = {
  hemingway: "#f5c89a",
  tolkien: "#aacfe8",
  tolstoy: "#d8f08a",
  stephenking: "#cdb6e6",
};

export const FIRST: Record<AuthorId, string> = {
  hemingway: "Hemingway",
  tolkien: "Tolkien",
  tolstoy: "Tolstoy",
  stephenking: "King",
};

export const MOOD_NAME: Record<AuthorId, string> = {
  hemingway: "drunk",
  tolkien: "mythic",
  tolstoy: "philosophical",
  stephenking: "dread",
};

export const MOOD_LABELS: Record<AuthorId, [string, string, string, string, string]> = {
  hemingway: [
    "stone sober",
    "one whisky in",
    "warmly buzzed",
    "two thirds drunk",
    "fully sloshed",
  ],
  tolkien: [
    "fireside",
    "road-worn",
    "starlit",
    "battle-song",
    "full legendarium",
  ],
  tolstoy: ["domestic", "observant", "searching", "conscience-struck", "full Russian soul"],
  stephenking: [
    "clear daylight",
    "something off",
    "bad feeling",
    "lights out",
    "full nightmare",
  ],
};

export function normalizeAuthorId(author: StoredAuthorId | string): AuthorId {
  switch (author) {
    case "tolkien":
    case "didion":
      return "tolkien";
    case "tolstoy":
    case "graham":
      return "tolstoy";
    case "stephenking":
    case "naval":
      return "stephenking";
    case "hemingway":
    default:
      return "hemingway";
  }
}

export function moodBandIndex(mood: number): 0 | 1 | 2 | 3 | 4 {
  const clamped = Math.max(0, Math.min(100, Math.floor(mood)));
  return Math.min(4, Math.floor(clamped / 20)) as 0 | 1 | 2 | 3 | 4;
}

export function moodLabelFor(author: AuthorId, mood: number): string {
  return MOOD_LABELS[author][moodBandIndex(mood)];
}

export function outcomeLabelFor(outcome: OutcomeId): string {
  return OUTCOMES.find((entry) => entry.id === outcome)?.label ?? OUTCOMES[0].label;
}

export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
}
