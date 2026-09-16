import "../lib/server-only.ts";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { hasStrongSecuritySecret } from "../lib/security-env.ts";
import { getSupabaseAdmin } from "../integrations/supabase/client.server.ts";
import { rejectAmbiguousSecrets, signingKey } from "./signing-purpose.ts";

const ANONYMOUS_COOKIE_DAYS = 400;
const ANONYMOUS_COOKIE_MAX_AGE_SECONDS = ANONYMOUS_COOKIE_DAYS * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type AnonymousEnvelope = { exp:number; iat:number; id:string; v:1 };
export type AnonymousVisitor = { envelope:string; id:string; isNew:boolean };
export function anonymousVisitorCookieName(){ return `${process.env.NODE_ENV === "production" ? "__Host-" : ""}gw-anon`; }
export function anonymousVisitorCookieSettings(){ return {httpOnly:true,maxAge:ANONYMOUS_COOKIE_MAX_AGE_SECONDS,path:"/",sameSite:"lax" as const,secure:process.env.NODE_ENV === "production"}; }
function anonymousKey(){ rejectAmbiguousSecrets(); const root=process.env.GHOSTWRITER_SECURITY_SECRET; if(!hasStrongSecuritySecret(root))throw new Error("Anonymous portfolio identity unavailable"); return signingKey(root!,"gw.anonymous"); }
function seal(id:string,now=Date.now()){ const payload:AnonymousEnvelope={exp:now+ANONYMOUS_COOKIE_MAX_AGE_SECONDS*1000,iat:now,id,v:1}; const encoded=Buffer.from(JSON.stringify(payload)).toString("base64url"); const signature=createHmac("sha256",anonymousKey()).update(encoded).digest("hex"); return `${encoded}.${signature}`; }
export function openAnonymousVisitor(envelope:string|null,now=Date.now()):string|null{
 if(!envelope||envelope.length>1024)return null; const parts=envelope.split("."); if(parts.length!==2||!/^[a-f0-9]{64}$/.test(parts[1]))return null;
 const expected=createHmac("sha256",anonymousKey()).update(parts[0]).digest(),received=Buffer.from(parts[1],"hex"); if(received.length!==expected.length||!timingSafeEqual(expected,received))return null;
 try{const payload=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")) as Partial<AnonymousEnvelope>; if(payload.v!==1||typeof payload.id!=="string"||!UUID.test(payload.id)||!Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.exp)||payload.iat!>now+5*60_000||payload.exp!<=now||payload.exp!>payload.iat!+ANONYMOUS_COOKIE_MAX_AGE_SECONDS*1000)return null; return payload.id;}catch{return null;}
}
export function readAnonymousVisitor(request:Request):string|null{ const name=anonymousVisitorCookieName(); const values=(request.headers.get("cookie")??"").split(";").map(v=>v.trim()).filter(v=>v.startsWith(`${name}=`)); if(values.length!==1)return null; try{return openAnonymousVisitor(decodeURIComponent(values[0].slice(name.length+1)));}catch{return null;} }
export function ensureAnonymousVisitor(request:Request):AnonymousVisitor{const existing=readAnonymousVisitor(request);if(existing)return{envelope:"",id:existing,isNew:false};const id=randomUUID();return{envelope:seal(id),id,isNew:true};}
export async function anonymousPortfolioAllowance(visitorId:string){const admin=getSupabaseAdmin();if(!admin)throw new Error("Anonymous portfolio allowance unavailable");const{data,error}=await(admin as unknown as{rpc:(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>}).rpc("ghostwriter_anonymous_allowance",{p_visitor_id:visitorId});if(error)throw new Error("Anonymous portfolio allowance unavailable");return data;}
