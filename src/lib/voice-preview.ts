import type { AuthorId, OutcomeId } from "./ghostwriter-shared.ts";

// Prepared examples, never generated from the user's draft or sent to a provider.
export const PREVIEW_SOURCE = "The build broke last night, so the launch moves to Thursday.";
export const QUICK_DRAFTS = [
  { label: "Team update", text: "The build broke last night, so the launch moves to Thursday. We need one more day to fix it properly. Sorry for the short notice, everyone." },
  { label: "Birthday card", text: "Happy birthday! I hope this year brings you more time for the things you love, good company, and plenty of reasons to laugh." },
  { label: "Apology", text: "I’m sorry I missed our call. I should have let you know sooner. Your time matters to me. Can we find another time this week?" },
];

const PREVIEWS: Record<AuthorId, readonly [string, string, string]> = {
  tolkien: [
    "Last night the build faltered, and our launch must wait until Thursday.",
    "In the dark of last night the build was broken, and the launch must now wait for Thursday’s sun.",
    "Beneath the gathering shadows of night, the build was sundered; and so our company must await Thursday’s dawn before the journey can begin.",
  ],
  stephenking: [
    "The build broke last night. We’re moving the launch to Thursday.",
    "The build died last night. Just like that. Now the launch is Thursday, and nobody’s sleeping easy.",
    "Last night the build went dead. The cursor kept blinking, patient as a thing waiting in the dark. Thursday, we said. We’d launch on Thursday.",
  ],
  tolstoy: [
    "The build failed last night, and we have moved the launch to Thursday.",
    "When the build failed last night, the launch was moved to Thursday, and each of us felt the delay in a different way.",
    "The build had failed in the night, and by morning everyone understood that the launch must wait until Thursday; yet beneath that simple agreement lay all the private burdens of those who had hoped to finish sooner.",
  ],
  hemingway: [
    "The build broke last night. The launch will be Thursday.",
    "The build broke in the night. We would launch on Thursday. There was work to do.",
    "The build was broken. It had broken in the night. Thursday was the launch now. We went back to work.",
  ],
};

export function voicePreview(author: AuthorId, mood: number) {
  return PREVIEWS[author][mood < 25 ? 0 : mood < 75 ? 1 : 2];
}

export const OUTCOME_PREVIEWS: Record<OutcomeId, string> = {
  clarity: "Last night’s build failed, so we’ve moved the launch to Thursday.",
  reply: "Last night’s build failed, so we’re moving the launch to Thursday. Does that timing work for you?",
  confident: "The build failed last night. We’ve moved the launch to Thursday to resolve it properly.",
  concise: "Build failed last night. Launch moved to Thursday.",
  persuasive: "Last night’s build failed. Moving the launch to Thursday gives us time to fix it properly.",
};

export function surpriseVoice(current: AuthorId, random = Math.random) {
  const choices: AuthorId[] = ["tolkien", "stephenking", "tolstoy", "hemingway"];
  const alternatives = choices.filter(author => author !== current);
  return { author: alternatives[Math.floor(random() * alternatives.length)], mood: Math.floor(random() * 3) * 50 };
}
