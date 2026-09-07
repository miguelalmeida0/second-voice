import "../lib/server-only.ts";
import { hkdfSync } from "node:crypto";
export function signingKey(root: string, purpose: string): Buffer {
  if (!/^(gw\.session|gw\.csrf|gw\.challenge|gw\.artifact)$/.test(purpose)) throw new Error("Unknown signing purpose");
  return Buffer.from(hkdfSync("sha256",root,"ghostwriter-signing-v2",purpose,32));
}
export function rejectAmbiguousSecrets(environment: Record<string, string | undefined> = process.env) {
  if (environment.GHOSTWRITTER_SECURITY_SECRET !== undefined) throw new Error("Unsupported GHOSTWRITTER_SECURITY_SECRET spelling");
  const root=environment.GHOSTWRITER_SECURITY_SECRET?.trim();
  if(root && [environment.GROQ_API_KEY?.trim(),environment.SUPABASE_SERVICE_ROLE_KEY?.trim()].includes(root)) throw new Error("Signing and service credentials must differ");
}
