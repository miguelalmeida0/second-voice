export type ReviewPart =
  | { kind: "equal"; text: string }
  | { kind: "change"; id: number; original: string; suggestion: string };

export type ReviewDecision = "pending" | "accept" | "keep";
type DecisionChange = { id: number; decision: ReviewDecision };
// History stores only the previous values of decisions changed by each action.
export type ReviewState = { decisions: ReviewDecision[]; history: DecisionChange[][] };
export type ReviewAction =
  | { type: "decide"; id: number; decision: "accept" | "keep" }
  | { type: "undo" }
  | { type: "reset" };

// At most 1,000,000 Uint32 cells (4 MB) and that many LCS comparisons.
// Above this budget, retain exact text in a single reviewable replacement.
const MAX_LCS_CELLS = 1_000_000;
const wordSegmenter = new Intl.Segmenter("en", { granularity: "word" });

function tokenize(text: string): string[] {
  // Unicode word boundaries preserve whitespace and punctuation slices, and do
  // not break surrogate pairs, combining sequences, or emoji grapheme clusters.
  return Array.from(wordSegmenter.segment(text), ({ segment }) => segment);
}

export function buildReviewParts(source: string, result: string): ReviewPart[] {
  if (source === result) return source ? [{ kind: "equal", text: source }] : [];
  const replacement: ReviewPart[] = [{ kind: "change", id: 0, original: source, suggestion: result }];
  if (!source || !result) return replacement;

  const original = tokenize(source);
  const suggestion = tokenize(result);
  const width = suggestion.length + 1;
  const cells = (original.length + 1) * width;
  if (cells > MAX_LCS_CELLS) return replacement;

  const lengths = new Uint32Array(cells);
  for (let i = original.length - 1; i >= 0; i--) {
    for (let j = suggestion.length - 1; j >= 0; j--) {
      lengths[i * width + j] = original[i] === suggestion[j]
        ? lengths[(i + 1) * width + j + 1] + 1
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
  }

  const parts: ReviewPart[] = [];
  let nextId = 0;
  let removed: string[] = [];
  let inserted: string[] = [];
  function flushChange() {
    if (!removed.length && !inserted.length) return;
    parts.push({ kind: "change", id: nextId++, original: removed.join(""), suggestion: inserted.join("") });
    removed = [];
    inserted = [];
  }

  let i = 0;
  let j = 0;
  while (i < original.length || j < suggestion.length) {
    if (i < original.length && j < suggestion.length && original[i] === suggestion[j]) {
      flushChange();
      const previous = parts[parts.length - 1];
      if (previous?.kind === "equal") previous.text += original[i];
      else parts.push({ kind: "equal", text: original[i] });
      i++;
      j++;
    } else if (i < original.length && (j === suggestion.length || lengths[(i + 1) * width + j] >= lengths[i * width + j + 1])) {
      // Prefer deletion on ties so repeated words align deterministically.
      removed.push(original[i++]);
    } else {
      inserted.push(suggestion[j++]);
    }
  }
  flushChange();
  return parts;
}

export function createReviewState(parts: ReviewPart[]): ReviewState {
  return { decisions: parts.filter((part) => part.kind === "change").map(() => "pending"), history: [] };
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  if (action.type === "undo") {
    const previous = state.history[state.history.length - 1];
    if (!previous) return state;
    const decisions = [...state.decisions];
    for (const change of previous) decisions[change.id] = change.decision;
    return { decisions, history: state.history.slice(0, -1) };
  }

  if (action.type === "decide") {
    if (!Number.isInteger(action.id) || action.id < 0 || action.id >= state.decisions.length) return state;
    const previous = state.decisions[action.id];
    if (previous === action.decision) return state;
    const decisions = [...state.decisions];
    decisions[action.id] = action.decision;
    return { decisions, history: [...state.history, [{ id: action.id, decision: previous }]] };
  }

  const previous: DecisionChange[] = [];
  state.decisions.forEach((decision, id) => {
    if (decision !== "pending") previous.push({ id, decision });
  });
  if (!previous.length) return state;
  return { decisions: state.decisions.map(() => "pending"), history: [...state.history, previous] };
}

export function buildReviewText(parts: ReviewPart[], state: ReviewState): string {
  return parts.map((part) => part.kind === "equal"
    ? part.text
    : state.decisions[part.id] === "keep" ? part.original : part.suggestion).join("");
}
