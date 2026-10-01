"use client";

import { useEffect, useRef, useState } from "react";

import { usePortfolioAccess } from "@/components/ghostwriter/PortfolioAccess";
import {
  parsePortfolioAllowance,
  type PortfolioAllowance,
} from "@/lib/portfolio-access";
import {
  issueGhostwriterChallenge,
  readGhostwriterCsrfToken,
  refreshGhostwriterShieldSession,
} from "@/lib/ghostwriter-client-guard";

export function BetaSignIn({
  emailEnabled = false,
  githubEnabled = false,
  portfolio = false,
  headless = false,
}: {
  emailEnabled?: boolean;
  githubEnabled?: boolean;
  portfolio?: boolean;
  headless?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowance, setAllowance] = useState<PortfolioAllowance | null>(null);

  const access = usePortfolioAccess();
  const setSession = access?.setSession;
  const sessionStatus = access?.session.status ?? "checking";
  const sessionStatusRef = useRef(sessionStatus);

  useEffect(() => {
    sessionStatusRef.current = sessionStatus;
  }, [sessionStatus]);

  const detailsRef = useRef<HTMLDetailsElement>(null);
  const githubRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const open = () => {
      if (headless) { githubRef.current?.click(); return; }
      if (!detailsRef.current) return;

      detailsRef.current.open = true;
      detailsRef.current.scrollIntoView({
        block: "center",
        behavior: "auto",
      });

      githubRef.current?.focus({
        preventScroll: true,
      });
    };

    window.addEventListener("ghostwriter-sign-in", open);

    return () => {
      window.removeEventListener("ghostwriter-sign-in", open);
    };
  }, [headless]);

  useEffect(() => {
    const channel = new BroadcastChannel("ghostwriter-identity");

    channel.onmessage = () => {
      window.location.reload();
    };

    if (
      new URLSearchParams(window.location.search).get("auth") === "complete"
    ) {
      window.history.replaceState(null, "", "/second-voice");

      channel.postMessage("changed");
    }

    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener("pageshow", restored);

    return () => {
      channel.close();

      window.removeEventListener("pageshow", restored);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let queued = false;
    let controller: AbortController | null = null;
    let retryTimer = 0;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        retryTimer = window.setTimeout(resolve, ms);
      });

    const requestStatus = async (attempt: number) => {
      const csrf =
        (attempt === 0 ? readGhostwriterCsrfToken() : null) ||
        (await refreshGhostwriterShieldSession({
          signal: controller?.signal,
        }));

      if (!csrf) {
        throw new Error("Session unavailable");
      }

      const response = await fetch("/api/ghostwriter/auth", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        signal: controller?.signal,
        headers: {
          "content-type": "application/json",
          "x-ghostwriter-csrf": csrf,
        },
        body: JSON.stringify({
          action: "status",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        allowance?: unknown;
        message?: unknown;
        mode?: unknown;
      };

      if (!response.ok && attempt < 2) {
        // A status request is read-only. Recover once from a stale shield pair
        // and once from a transient datastore/rate-limit edge without ever
        // enabling generation before the authoritative allowance is known.
        if (response.status === 403 || response.status === 503) {
          await wait(250 * (attempt + 1));
          return requestStatus(attempt + 1);
        }

        if (response.status === 429) {
          const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "1", 10);
          await wait(Math.min(5_000, Math.max(500, Number.isFinite(retryAfter) ? retryAfter * 1_000 : 1_000)));
          return requestStatus(attempt + 1);
        }
      }

      return { data, response };
    };

    const update = async () => {
      if (inFlight) {
        queued = true;
        return;
      }

      inFlight = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 12_000);

      try {
        const { data, response } = await requestStatus(0);

        if (active) {
          const next = response.ok
            ? parsePortfolioAllowance(data.allowance)
            : null;

          setAllowance(next);

          const mode =
            data.mode === "anonymous"
              ? "anonymous"
              : data.mode === "authenticated"
                ? "authenticated"
                : null;

          setSession?.(
            response.ok && mode && next
              ? { status: mode, allowance: next }
              : { status: "unavailable" },
          );
        }
      } catch {
        if (active) {
          setAllowance(null);
          const currentStatus = sessionStatusRef.current;
          if (currentStatus !== "anonymous" && currentStatus !== "authenticated") {
            setSession?.({ status: "unavailable" });
          }
        }
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        controller = null;

        if (active && queued) {
          queued = false;
          void update();
        }
      }
    };

    if (
      sessionStatusRef.current === "checking" ||
      sessionStatusRef.current === "unavailable"
    ) {
      void update();
    }

    const retry = () => {
      setSession?.({ status: "checking" });
      void update();
    };

    const allowanceChanged = () => {
      void update();
    };

    window.addEventListener("ghostwriter-session-retry", retry);
    window.addEventListener("ghostwriter-allowance-changed", allowanceChanged);

    return () => {
      active = false;
      queued = false;
      controller?.abort();
      window.clearTimeout(retryTimer);

      window.removeEventListener("ghostwriter-allowance-changed", allowanceChanged);
      window.removeEventListener("ghostwriter-session-retry", retry);
    };
  }, [setSession]);

  async function act(action: string) {
    setBusy(true);

    try {
      const csrf =
        readGhostwriterCsrfToken() || (await refreshGhostwriterShieldSession());

      if (!csrf) {
        throw new Error("Refresh the page to sign in.");
      }

      const challenge =
        action === "logout" ? {} : await issueGhostwriterChallenge(csrf);

      const response = await fetch("/api/ghostwriter/auth", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-ghostwriter-csrf": csrf,
        },
        body: JSON.stringify({
          action,
          ...(action === "send-code" || action === "verify" ? { email } : {}),
          ...(action === "verify" ? { token } : {}),
          ...challenge,
        }),
      });

      const data = await response.json();

      if (response.ok && action === "github" && typeof data.url === "string") {
        window.location.assign(data.url);

        return;
      }

      setToken("");
      setMessage(data.message ?? "Authentication unavailable.");

      if (
        (response.ok && ["verify", "refresh", "logout"].includes(action)) ||
        (action === "logout" && response.status === 401)
      ) {
        const channel = new BroadcastChannel("ghostwriter-identity");

        channel.postMessage("changed");

        channel.close();

        window.location.reload();
      }
    } catch {
      setMessage("Authentication unavailable. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const logout = () => {
      void act("logout");
    };

    window.addEventListener("ghostwriter-sign-out", logout);

    return () => {
      window.removeEventListener("ghostwriter-sign-out", logout);
    };
  });

  if (headless) { return <>{githubEnabled?<button ref={githubRef} type="button" className="sr-only" disabled={busy} onClick={()=>void act("github")}>Sign in with GitHub</button>:null}{message?<p role="status" className="mx-auto max-w-3xl px-6 py-3 text-sm text-[#eeeae3]">{message}</p>:null}</>; }

  return (
    <details
      ref={detailsRef}
      className="mx-auto w-full max-w-3xl px-6 py-4 text-sm"
    >
      <summary>
        {portfolio
          ? access?.session.status === "authenticated"
            ? "Free portfolio trial · Account"
            : "Free portfolio trial · Sign in"
          : "Invited beta access"}
      </summary>

      {githubEnabled && access?.session.status !== "authenticated" && (
        <button
          ref={githubRef}
          type="button"
          className="mt-4 rounded border border-current px-4 py-2"
          disabled={busy}
          onClick={() => void act("github")}
        >
          Sign in with GitHub
        </button>
      )}

      {!githubEnabled && !emailEnabled && (
        <p className="mt-3">
          Visitor sign-in is not configured yet. Live rewriting is unavailable.
        </p>
      )}

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();

          void act("verify");
        }}
      >
        {emailEnabled && (
          <>
            <label>
              Email
              <input
                className="block rounded border border-current bg-transparent p-2"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <button
              type="button"
              disabled={busy || !email}
              onClick={() => void act("send-code")}
            >
              Send code
            </button>

            <label>
              Email code
              <input
                className="block rounded border border-current bg-transparent p-2"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                maxLength={8}
              />
            </label>

            <button disabled={busy || !token}>Sign in</button>
          </>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void act("refresh")}
        >
          Refresh session
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void act("logout")}
        >
          Sign out
        </button>
      </form>

      {portfolio && allowance && (
        <p className="mt-3">
          {allowance.remaining} trial rewrites remaining.
          {allowance.remaining === 0
            ? " Your portfolio trial has reached its limit."
            : !allowance.available || allowance.todayRemaining === 0
              ? " AI demo is temporarily unavailable."
              : " Shared Free-tier availability applies."}
        </p>
      )}

      <p role="status" className="mt-3">
        {message}
      </p>
    </details>
  );
}
