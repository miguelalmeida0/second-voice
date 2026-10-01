"use client";

import { useState, type ReactNode } from "react";
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
    <main data-session-state="anonymous" className="relative min-h-[100svh] overflow-x-clip bg-[#050505] text-[#f4f0e8]">
      {/* ======================================================
          FULL-VIEWPORT ARTWORK
          Native img avoids the sizing issue we just hit.
         ====================================================== */}
      <img
        src="/ghostwriter/signin-art.png"
        alt=""
        aria-hidden="true"
        className="
          absolute inset-0
          h-full w-full max-w-none
          object-cover
          object-[62%_center]
          pointer-events-none select-none
        "
      />

      {/* ======================================================
          DESKTOP EDITORIAL MASK

          Left side stays properly black.
          Right side artwork remains bright and untouched.
          Transition happens only around the middle.
         ====================================================== */}
      <div
        aria-hidden="true"
        className="
          absolute inset-0 hidden lg:block
          bg-[linear-gradient(90deg,#050505_0%,#050505_31%,rgba(5,5,5,0.98)_36%,rgba(5,5,5,0.86)_41%,rgba(5,5,5,0.48)_48%,rgba(5,5,5,0.14)_56%,rgba(5,5,5,0)_64%)]
        "
      />

      {/* Tiny global vignette only */}
      <div
        aria-hidden="true"
        className="
          absolute inset-0 hidden lg:block
          bg-[radial-gradient(circle_at_78%_50%,transparent_0%,transparent_58%,rgba(0,0,0,0.16)_100%)]
        "
      />

      {/* ======================================================
          MOBILE MASK
         ====================================================== */}
      <div
        aria-hidden="true"
        className="
          absolute inset-0 lg:hidden
          bg-[linear-gradient(180deg,rgba(5,5,5,0.92)_0%,rgba(5,5,5,0.84)_40%,rgba(5,5,5,0.30)_68%,rgba(5,5,5,0.62)_100%)]
        "
      />

      {/* ======================================================
          REAL CONTENT
         ====================================================== */}
      <div
        className="
          relative z-10
          mx-auto flex min-h-[100svh]
          w-full max-w-[1600px]
          flex-col
          px-7 py-8
          sm:px-10
          lg:px-[4.5rem] lg:py-10
        "
      >
        {/* BRAND */}
        <header className="flex items-center gap-3">
          <SecondVoiceFeather />

          <div>
            <p
              className="
                font-playfair
                text-[1.55rem]
                leading-none
                tracking-[-0.025em]
                text-[#f2eee6]
              "
            >
              Second Voice
            </p>

            <p className="mt-1 text-[11px] tracking-[0.01em] text-[#aaa69f]">
              by Ghostwritter
            </p>
          </div>
        </header>

        {/* ====================================================
            MAIN COPY
           ==================================================== */}
        <section
          className="
            my-auto
            w-full
            max-w-[545px]
            py-12
            lg:py-10
          "
        >
          <h1
            className="
              font-playfair
              text-[clamp(3.8rem,5.6vw,5.9rem)]
              font-medium
              leading-[0.91]
              tracking-[-0.048em]
            "
          >
            Come in.
            <br />
            Your next draft
            <br />
            is waiting.
          </h1>

          <p
            className="
              mt-8
              max-w-[465px]
              text-[1.02rem]
              leading-[1.62]
              text-[#c5c0b8]
              sm:text-[1.07rem]
            "
          >
            Sign in with GitHub to get 10 free rewrites and start exploring new
            ways to say what you mean.
          </p>

          {/* GITHUB CTA */}
          <button
            type="button"
            onClick={() => void signInWithGitHub()}
            disabled={!githubEnabled || busy}
            className="
              mt-9
              flex min-h-[68px]
              w-full max-w-[505px]
              items-center justify-center
              gap-4
              rounded-[13px]
              bg-[#9bcaff]
              px-6
              text-[1.04rem]
              font-semibold
              text-[#07101a]
              transition
              duration-200
              hover:bg-[#acd3ff]
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#d5e9ff]
              focus-visible:ring-offset-4
              focus-visible:ring-offset-[#050505]
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            <GitHubMark />

            <span>{busy ? "Opening GitHub…" : "Continue with GitHub"}</span>

            {!busy && <ArrowMark />}
          </button>
          <p className="mt-4 max-w-[505px] text-sm leading-relaxed text-[#c7c2b9]">
            Before signing in, read <Link href="/second-voice/privacy" className="underline underline-offset-4">Privacy &amp; contact</Link>.
          </p>

          {error ? (
            <p
              role="alert"
              className="
                mt-4
                max-w-[505px]
                text-sm
                leading-relaxed
                text-[#e3aaa0]
              "
            >
              {error}
            </p>
          ) : null}

          {/* ==================================================
              TRUST
             ================================================== */}
          <div
            className="
              mt-8
              grid max-w-[505px]
              grid-cols-3
              border-t border-white/10
              pt-7
            "
          >
            <TrustItem
              icon={<ShieldMark />}
              title="Secure & private"
              detail="OAuth with GitHub."
            />

            <TrustItem
              icon={<CardMark />}
              title="No credit card"
              detail="10 free rewrites."
              bordered
            />

            <TrustItem
              icon={<LockMark />}
              title="Hard limits"
              detail="Usage is capped."
              bordered
            />
          </div>
        </section>

        {/* FOOTER */}
        <footer
          className="
            pb-1
            text-[10px]
            uppercase
            tracking-[0.29em]
            text-[#747982]
            sm:text-[11px]
          "
        >
          Different voices. A brighter you.
        </footer>
      </div>
    </main>
  );
}

function TrustItem({
  icon,
  title,
  detail,
  bordered = false,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={[
        "min-w-0 px-4 first:pl-0",
        bordered ? "border-l border-white/10" : "",
      ].join(" ")}
    >
      <div className="mb-3 text-[#9bcaff]">{icon}</div>

      <p className="text-[12px] font-medium leading-tight text-[#eee9e0] sm:text-[13px]">
        {title}
      </p>

      <p className="mt-1 text-[10px] leading-[1.45] text-[#888781] sm:text-[11px]">
        {detail}
      </p>
    </div>
  );
}

function SecondVoiceFeather() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-9 w-9" fill="none">
      <path
        d="M26.5 4.5C20.7 4.8 15.7 7 12.1 10.6C8.3 14.4 7.1 19.2 7 24.4C11 24.2 14.7 22.9 17.7 20.4C22.1 16.7 24.8 11.4 26.5 4.5Z"
        fill="#9bcaff"
      />

      <path
        d="M6 28C9.4 22.1 14.3 16.7 21.5 11"
        stroke="#9bcaff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 fill-current"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.014-1.7-2.782.605-3.369-1.343-3.369-1.343-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.071 1.531 1.031 1.531 1.031.892 1.53 2.341 1.088 2.91.832.091-.647.349-1.088.635-1.338-2.221-.253-4.555-1.112-4.555-4.945 0-1.092.39-1.985 1.03-2.684-.103-.253-.446-1.27.098-2.647 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.295 2.748-1.025 2.748-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.684 0 3.842-2.337 4.689-4.566 4.937.359.31.678.923.678 1.861 0 1.344-.012 2.428-.012 2.758 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function ArrowMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}

function ShieldMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 5 6v5c0 4.8 2.7 8 7 10 4.3-2 7-5.2 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CardMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function LockMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}
