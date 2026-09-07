"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { PortfolioSession } from "@/lib/portfolio-access";

const PortfolioAccessContext = createContext<{
  session: PortfolioSession;
  setSession: Dispatch<SetStateAction<PortfolioSession>>;
  githubEnabled: boolean;
} | null>(null);

export function PortfolioAccess({ enabled, githubEnabled, children }: { enabled: boolean; githubEnabled: boolean; children: ReactNode }) {
  const [session, setSession] = useState<PortfolioSession>({ status: "checking" });
  const value = useMemo(() => enabled ? { session, setSession, githubEnabled } : null, [enabled, session, githubEnabled]);
  return <PortfolioAccessContext.Provider value={value}>{children}</PortfolioAccessContext.Provider>;
}

export function usePortfolioAccess() { return useContext(PortfolioAccessContext); }

export function openPortfolioSignIn() {
  window.dispatchEvent(new Event("ghostwriter-sign-in"));
}
