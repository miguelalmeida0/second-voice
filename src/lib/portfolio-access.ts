export type PortfolioAllowance = { remaining: number; todayRemaining?: number; available: boolean };
export type PortfolioSession =
  | { status: "checking" | "anonymous" | "unavailable" }
  | { status: "authenticated"; allowance: PortfolioAllowance | null };

export function parsePortfolioAllowance(value: unknown): PortfolioAllowance | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!Number.isInteger(data.remaining) || Number(data.remaining) < 0 || Number(data.remaining) > 10 || typeof data.available !== "boolean") return null;
  if (data.todayRemaining !== undefined && (!Number.isInteger(data.todayRemaining) || Number(data.todayRemaining) < 0 || Number(data.todayRemaining) > 3)) return null;
  return { remaining: Number(data.remaining), available: data.available, ...(data.todayRemaining !== undefined ? { todayRemaining: Number(data.todayRemaining) } : {}) };
}

// Presentation only. Every dispatch still requires server identity and atomic admission.
export function portfolioAccessView(session: PortfolioSession, githubEnabled: boolean, rewriteEnabled: boolean) {
  const signIn = githubEnabled && (session.status === "anonymous" || session.status === "checking");
  if (session.status !== "authenticated") return {
    signIn, canGenerate: false,
    message: signIn ? "Sign in with GitHub to claim an available Free portfolio trial." : "AI demo is temporarily unavailable. Your text stays here.",
  };
  const allowance = session.allowance;
  if (allowance && allowance.remaining === 0) return {
    signIn: false, canGenerate: false, message: "Your Free portfolio trial has reached its limit. Your text stays here.",
  };
  if (!rewriteEnabled || !allowance?.available || allowance.todayRemaining === 0) return {
    signIn: false, canGenerate: false, message: "AI demo is temporarily unavailable. Your text stays here.",
  };
  return { signIn: false, canGenerate: true, message: `${allowance.remaining} trial rewrites remaining.` };
}
