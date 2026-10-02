import { buildOutcomePrompt, buildPrompt } from "../src/server/ghostwriter.ts";

const authorIds = new Set(["hemingway", "tolkien", "tolstoy", "stephenking"]);
const outcomeIds = new Set(["clarity", "reply", "confident", "concise", "persuasive"]);

function stringVar(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export default class SecondVoicePromptContractProvider {
  id() {
    return "second-voice:prompt-contract";
  }

  async callApi(
    _prompt: string,
    context?: { vars?: Record<string, unknown> },
  ) {
    const vars = context?.vars ?? {};
    const mode = stringVar(vars.mode, "author");

    if (mode === "outcome") {
      const outcome = stringVar(vars.outcome, "clarity");

      if (!outcomeIds.has(outcome)) {
        return { error: `Unsupported outcome: ${outcome}` };
      }

      const result = buildOutcomePrompt(
        outcome as Parameters<typeof buildOutcomePrompt>[0],
      );

      return {
        output: result.system,
        prompt: result.system,
        metadata: {
          mode,
          outcome,
          outcomeLabel: result.outcomeLabel,
        },
      };
    }

    const author = stringVar(vars.author, "tolkien");
    const mood = Number(vars.mood ?? 50);

    if (!authorIds.has(author)) {
      return { error: `Unsupported author: ${author}` };
    }

    if (!Number.isInteger(mood) || mood < 0 || mood > 100) {
      return { error: `Unsupported mood: ${String(vars.mood)}` };
    }

    const result = buildPrompt(
      author as Parameters<typeof buildPrompt>[0],
      mood,
    );

    return {
      output: result.system,
      prompt: result.system,
      metadata: {
        author,
        mode: "author",
        mood,
        moodLabel: result.moodLabel,
      },
    };
  }
}
