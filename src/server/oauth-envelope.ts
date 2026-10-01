import "../lib/server-only.ts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { signingKey, rejectAmbiguousSecrets } from "./signing-purpose.ts";
import { hasStrongSecuritySecret } from "../lib/security-env.ts";
function key() {
  rejectAmbiguousSecrets();
  const root=process.env.GHOSTWRITER_SECURITY_SECRET;
  if (!hasStrongSecuritySecret(root)) throw new Error("OAuth signing unavailable");
  return signingKey(root!,"gw.oauth");
}
export function sealOAuthVerifier(verifier:string, now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({verifier,expires:now+600_000})).toString("base64url");
  return payload+"."+createHmac("sha256",key()).update(payload).digest("hex");
}
export function openOAuthVerifier(envelope:string|null, now=Date.now()):string|null {
  if (!envelope || envelope.length>2048) return null;
  const parts=envelope.split(".");
  if (parts.length!==2 || !/^[a-f0-9]{64}$/.test(parts[1])) return null;
  const expected=createHmac("sha256",key()).update(parts[0]).digest();
  if (!timingSafeEqual(expected,Buffer.from(parts[1],"hex"))) return null;
  try {
    const data=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));
    if (typeof data.verifier!=="string" || data.verifier.length<32 || data.verifier.length>512 ||
      !Number.isSafeInteger(data.expires) || data.expires<=now || data.expires>now+600_000) return null;
    return data.verifier;
  } catch { return null; }
}
