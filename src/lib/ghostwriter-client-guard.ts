const CSRF_COOKIE = "gw_csrf";
const MAX_NONCE_ATTEMPTS = 2_000_000;
const YIELD_INTERVAL = 300;
export const GHOSTWRITER_REQUEST_ID_HEADER = "x-request-id";

const encoder = new TextEncoder();

export const RECOVERABLE_SESSION_ERRORS = [
  "Protection cookies are missing. Refresh the page and try again.",
  "Request verification failed.",
  "Security session expired. Refresh and try again.",
] as const;

export class GhostwriterRequestError extends Error {
  requestId: string | null;

  constructor(message: string, requestId: string | null) {
    super(message);
    this.name = "GhostwriterRequestError";
    this.requestId = requestId;
  }
}

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

export function requestIdFrom(response: Response): string | null {
  return response.headers.get(GHOSTWRITER_REQUEST_ID_HEADER);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("The request was aborted.", "AbortError");
  }
}

export async function solveGhostwriterChallenge(
  challengeToken: string,
  difficulty: number,
  signal?: AbortSignal,
): Promise<string> {
  const prefix = "0".repeat(difficulty);

  for (let nonce = 0; nonce < MAX_NONCE_ATTEMPTS; nonce += 1) {
    throwIfAborted(signal);

    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${challengeToken}.${nonce}`),
    );

    if (digestToHex(digest).startsWith(prefix)) {
      return String(nonce);
    }

    if (nonce % YIELD_INTERVAL === 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      throwIfAborted(signal);
    }
  }

  throw new Error("The rewrite proof took too long. Try again.");
}

export async function refreshGhostwriterShieldSession(options: {
  signal?: AbortSignal;
} = {}): Promise<string | null> {
  const response = await fetch("/second-voice?shield=refresh", {
    cache: "no-store",
    credentials: "same-origin",
    method: "GET",
    signal: options.signal,
  });

  if (!response.ok) {
    return null;
  }

  return readGhostwriterCookie(CSRF_COOKIE);
}

export async function issueGhostwriterChallenge(
  csrfToken: string,
  options: {
    signal?: AbortSignal;
  } = {},
): Promise<{
  challengeNonce: string;
  challengeToken: string;
}> {
  const challengeResponse = await fetch("/api/ghostwriter/challenge", {
    headers: {
      "x-ghostwriter-csrf": csrfToken,
    },
    method: "GET",
    signal: options.signal,
  });
  const challenge = (await challengeResponse.json().catch(() => ({}))) as {
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
    throw new GhostwriterRequestError(
      challenge.error || "The rewrite challenge could not be issued.",
      requestIdFrom(challengeResponse),
    );
  }

  return {
    challengeNonce: await solveGhostwriterChallenge(
      challenge.challengeToken,
      challenge.difficulty,
      options.signal,
    ),
    challengeToken: challenge.challengeToken,
  };
}

export function readGhostwriterCsrfToken() {
  return readGhostwriterCookie(CSRF_COOKIE);
}
