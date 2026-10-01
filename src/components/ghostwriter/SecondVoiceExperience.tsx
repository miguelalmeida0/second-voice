"use client";

import type { ComponentProps, ReactNode } from "react";

import { BetaSignIn } from "@/components/ghostwriter/BetaSignIn";
import { GhostwriterPage } from "@/components/ghostwriter/GhostwriterPage";
import {
  openPortfolioSignIn,
  usePortfolioAccess,
} from "@/components/ghostwriter/PortfolioAccess";

type Features = ComponentProps<typeof GhostwriterPage>["features"];

export function SecondVoiceExperience({
  emailEnabled,
  features,
  githubEnabled,
  portfolio,
}: {
  emailEnabled: boolean;
  features: Features;
  githubEnabled: boolean;
  portfolio: boolean;
}) {
  const access = usePortfolioAccess();
  const sessionStatus = access?.session.status ?? "checking";

  /*
   * Never hide the entire studio behind an identity/allowance request.
   * The CTA itself remains fail-closed through portfolioAccessView(), but the
   * product stays rendered while status refreshes. This avoids a recruiter
   * being trapped on a blocking loader if a datastore/auth status request is
   * slow, aborted, or temporarily unavailable.
   */
  return (
    <>
      <BetaSignIn
        headless={portfolio}
        emailEnabled={emailEnabled}
        githubEnabled={githubEnabled}
        portfolio={portfolio}
      />

      <div className="relative" data-session-status={sessionStatus}>
        {portfolio && sessionStatus === "authenticated" ? <LogoutButton /> : null}
        {portfolio && sessionStatus === "anonymous" && githubEnabled ? (
          <SignInButton />
        ) : null}
        <GhostwriterPage features={features} />
      </div>
    </>
  );
}

function IdentityButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute right-5 top-5 z-10 flex h-11 items-center justify-center rounded-full border border-white/10 bg-[#0b0b0b]/90 px-4 text-xs font-semibold tracking-[0.02em] text-[#9bcaff] transition duration-200 hover:border-[#9bcaff]/40 hover:bg-[#111] hover:text-[#b8dcff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9bcaff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
    >
      {children}
    </button>
  );
}

function SignInButton() {
  return (
    <IdentityButton label="Sign in with GitHub" onClick={openPortfolioSignIn}>
      Sign in
    </IdentityButton>
  );
}

function LogoutButton() {
  return (
    <IdentityButton
      label="Sign out"
      onClick={() => window.dispatchEvent(new Event("ghostwriter-sign-out"))}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </svg>
    </IdentityButton>
  );
}
