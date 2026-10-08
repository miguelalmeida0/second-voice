"use client";

import { useState } from "react";
import Link from "next/link";

import {
  issueGhostwriterChallenge,
  readGhostwriterCsrfToken,
  refreshGhostwriterShieldSession,
} from "@/lib/ghostwriter-client-guard";

export function SecondVoiceSignInPage({
  githubEnabled,
}: {
  githubEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGitHub() {
    if (!githubEnabled || busy) return;

    setBusy(true);
    setError("");

    try {
      const csrf =
        readGhostwriterCsrfToken() || (await refreshGhostwriterShieldSession());

      if (!csrf) {
        throw new Error("Refresh the page and try again.");
      }

      const challenge = await issueGhostwriterChallenge(csrf);

      const response = await fetch("/api/ghostwriter/auth", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-ghostwriter-csrf": csrf,
        },
        body: JSON.stringify({
          action: "github",
          ...challenge,
        }),
      });

      const data = await response.json();

      if (!response.ok || typeof data.url !== "string") {
        throw new Error(data.message || "GitHub sign-in is unavailable.");
      }

      window.location.assign(data.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Sign-in is temporarily unavailable.",
      );

      setBusy(false);
    }
  }

  return (
    <main data-session-state="anonymous" className="duet-signin relative min-h-[100svh] overflow-x-clip">
      <section>
        <Link href="/second-voice">Second Voice</Link>
        <h1>Come in.<br />Your next draft is waiting.</h1>
        <p>Sign in with GitHub to get 10 free rewrites and start exploring new ways to say what you mean.</p>
        <button type="button" onClick={() => void signInWithGitHub()} disabled={!githubEnabled || busy}>{busy ? "Opening GitHub…" : "Continue with GitHub"}</button>
        <p>Before signing in, read <Link href="/second-voice/privacy">Privacy &amp; contact</Link>.</p>
        {error ? <p role="alert">{error}</p> : null}
        <p>OAuth with GitHub. No credit card. Usage is capped.</p>
        <Link href="/second-voice">Continue as a guest</Link>
      </section>
    </main>
  );
}
