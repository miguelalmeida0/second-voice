import "../lib/server-only.ts";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../integrations/supabase/client.server.ts";

export function authCookieName(kind: "access" | "refresh" | "pkce") {
  return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}gw-${kind}`;
}
export function readAuthCookie(request: Request, kind: "access" | "refresh" | "pkce"): string | null {
  const name = authCookieName(kind);
  const values = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(name + "="));
  if (values.length !== 1) return null;
  const value = values[0].slice(name.length + 1);
  return value.length > 0 && value.length <= 8192 ? value : null;
}
export function createAuthClient(storage?: {getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Authentication unavailable.");
  const allowedOrigin=new URL(url).origin;
  return createClient(url, key, { auth: { persistSession: Boolean(storage), storage, flowType:"pkce", autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, options) => {
    const target=new URL(typeof input==="string" ? input : input instanceof URL ? input.href : input.url);
    if(target.origin!==allowedOrigin || !target.pathname.startsWith("/auth/v1/")) throw new Error("Unexpected authentication destination");
    return fetch(input, {...options, redirect:"error", cache:"no-store", signal: AbortSignal.timeout(10000)});
  } } });
}

export function authRedirectOrigin() {
  const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if(origin.username || origin.password || origin.pathname!=="/" || origin.search || origin.hash || (process.env.NODE_ENV==="production" && origin.protocol!=="https:")) throw new Error("Invalid configured auth origin");
  return origin.origin;
}

export async function freeTrial(accountId:string,sessionId:string,claim=false) {
  if(process.env.GHOSTWRITER_RELEASE_PROFILE!=="portfolio-free") return null;
  const client=getSupabaseAdmin();
  if(!client) throw new Error("Trial service unavailable");
  const rpc=client as unknown as {rpc:(n:string,a:Record<string,string>)=>Promise<{data:unknown,error:unknown}>};
  const args={p_account_id:accountId,p_session_id:sessionId};
  if(claim){const result=await rpc.rpc("ghostwriter_free_entitle",args);if(result.error)throw new Error("Trial service unavailable");}
  const result=await rpc.rpc("ghostwriter_free_allowance",args);
  if(result.error)throw new Error("Trial service unavailable");
  return result.data;
}
export async function sessionRpc(name: "ghostwriter_ai_session_active" | "ghostwriter_ai_revoke_session", accountId: string, sessionId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Session verification unavailable.");
  const {data,error} = await (admin as unknown as {rpc: (n:string,a:Record<string,string>)=>Promise<{data:unknown,error:unknown}>}).rpc(name,{p_account_id:accountId,p_session_id:sessionId});
  if (error) throw new Error("Session verification unavailable.");
  return data === true;
}
