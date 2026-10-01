import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAiRequest } from "@/server/ai-auth";
import { authCookieName } from "@/server/auth-session";
import { validateGhostwriterHeaders, validateGhostwriterAuthPost } from "@/server/abuse-protection";
import { readGhostwriterJsonBody } from "@/server/ghostwriter-request";
import { continueAccountDeletion, deletionReceiptHash, deletionRpc } from "@/server/account-deletion";
export const runtime="nodejs";
const schema=z.object({confirmation:z.literal("DELETE MY ACCOUNT")}).strict();
const receiptName=()=>`${process.env.NODE_ENV==="production"?"__Host-":""}gw-deletion`;
const reply=(status:number,message:string,state?:string)=>NextResponse.json({message,state},{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request) {
  const guard=await validateGhostwriterHeaders(request,"auth");
  if ("status" in guard) return reply(guard.status,guard.error);
  const protection=await validateGhostwriterAuthPost(guard,"logout");
  if ("status" in protection) return reply(protection.status,protection.error);
  const body=await readGhostwriterJsonBody(request);
  if (!body.ok) return reply(body.status,body.error);
  if (!schema.safeParse(body.data).success) return reply(400,"Explicit account deletion confirmation is required.");
  const receipts=(request.headers.get("cookie")??"").split(";").map(v=>v.trim()).filter(v=>v.startsWith(receiptName()+"="));
  let receipt=receipts.length===1?receipts[0].slice(receiptName().length+1):null;
  let committed=false;
  try {
    if (!receipt) {
      const identity=await authenticateAiRequest(request);
      if (!identity.ok) return reply(identity.status,identity.error);
      receipt=randomBytes(32).toString("hex");
      committed=await deletionRpc("ghostwriter_delete_begin",{p_account_id:identity.identity.accountId,p_session_id:identity.identity.sessionId!,p_receipt_hash:deletionReceiptHash(receipt)})===true;
      if (!committed) return reply(403,"Sign out and sign in again, then confirm deletion within ten minutes.");
    }
    let state:"complete"|"pending"|"invalid"="pending";
    try { state=await continueAccountDeletion(receipt); } catch { /* Durable job remains retryable. */ }
    if (state==="invalid") return reply(401,"Deletion recovery could not be verified.");
    const response=reply(state==="complete"?200:202,state==="complete"?"Your account has been deleted.":"Access is revoked. Account cleanup is pending; use Retry cleanup.",state);
    const cookie={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};
    response.cookies.set(receiptName(),state==="complete"?"":receipt,{...cookie,maxAge:state==="complete"?0:604800});
    for (const kind of ["access","refresh","pkce"] as const) response.cookies.set(authCookieName(kind),"",{...cookie,maxAge:0});
    return response;
  } catch {
    return reply(503,committed?"Access is revoked. Cleanup needs recovery; no trial allowance was reset.":"Deletion could not be confirmed. Retry; your account has not been reported deleted.");
  }
}
