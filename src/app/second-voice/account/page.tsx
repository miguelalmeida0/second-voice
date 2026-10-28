import { headers } from "next/headers";
import AccountSettings from "@/components/ghostwriter/AccountSettings";
import { readAnonymousVisitor } from "@/server/anonymous-visitor";

export default async function AccountPage() {
  let supportReference: string | null = null;
  if (process.env.GHOSTWRITER_RELEASE_PROFILE === "portfolio-free") {
    try {
      supportReference = readAnonymousVisitor(new Request("https://local.invalid/", { headers: await headers() }));
    } catch { /* Account deletion remains available if diagnostics are unavailable. */ }
  }
  return <AccountSettings supportReference={supportReference} />;
}
