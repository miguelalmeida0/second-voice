const CSRF_COOKIE = "gw_csrf";
const MAX_NONCE_ATTEMPTS = 2_000_000;
const YIELD_INTERVAL = 300;

const encoder = new TextEncoder();

export const RECOVERABLE_SESSION_ERRORS = [
  "Protection cookies are missing. Refresh the page and try again.",
  "Request verification failed.",
  "Security session expired. Refresh and try again.",
] as const;

export function readGhostwriterCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function digestToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function isRecoverableSessionError(message: string) {
  return RECOVERABLE_SESSION_ERRORS.includes(
    message as (typeof RECOVERABLE_SESSION_ERRORS)[number],
  );
}

export async function solveGhostwriterChallenge(
  challengeToken: string,
  difficulty: number,
): Promise<string> {
  const prefix = "0".repeat(difficulty);

  for (let nonce = 0; nonce < MAX_NONCE_ATTEMPTS; nonce += 1) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${challengeToken}.${nonce}`),
    );

    if (digestToHex(digest).startsWith(prefix)) {
      return String(nonce);
    }

    if (nonce % YIELD_INTERVAL === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  throw new Error("The rewrite proof took too long. Try again.");
}

export async function refreshGhostwriterShieldSession(): Promise<string | null> {
  const response = await fetch("/second-voice?shield=refresh", {
    cache: "no-store",
    credentials: "same-origin",
    method: "GET",
  });

  if (!response.ok) {
    return null;
  }

  return readGhostwriterCookie(CSRF_COOKIE);
}

export async function issueGhostwriterChallenge(csrfToken: string): Promise<{
  challengeNonce: string;
  challengeToken: string;
}> {
  const challengeResponse = await fetch("/api/ghostwriter/challenge", {
    headers: {
      "x-ghostwriter-csrf": csrfToken,
    },
    method: "GET",
  });
  const challenge = (await challengeResponse.json()) as {
    challengeToken?: string;
    difficulty?: number | null;
    error?: string | null;
  };

  if (
    !challengeResponse.ok ||
    challenge.error ||
    !challenge.challengeToken ||
    typeof challenge.difficulty !== "number"
  ) {
    throw new Error(challenge.error || "The rewrite challenge could not be issued.");
  }

  return {
    challengeNonce: await solveGhostwriterChallenge(challenge.challengeToken, challenge.difficulty),
    challengeToken: challenge.challengeToken,
  };
}

export function readGhostwriterCsrfToken() {
  return readGhostwriterCookie(CSRF_COOKIE);
}
