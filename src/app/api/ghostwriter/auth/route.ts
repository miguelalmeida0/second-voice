import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthClient, authCookieName, readAuthCookie, sessionRpc, authRedirectOrigin, freeTrial } from "@/server/auth-session";
import { authenticateAiRequest } from "@/server/ai-auth";
import { validateGhostwriterHeaders, validateGhostwriterAuthPost } from "@/server/abuse-protection";
import { readGhostwriterJsonBody } from "@/server/ghostwriter-request";
export const runtime="nodejs";
const schema=z.object({
 action:z.enum(["send-code","verify","refresh","logout","status","github"]),
 email:z.string().email().max(254).optional(),
 token:z.string().regex(/^\d{6,8}$/).optional(),
 challengeToken:z.string().min(16).max(1024).optional(),
 challengeNonce:z.string().min(1).max(10).optional()
}).strict();
function reply(status:number,message:string) {
 return NextResponse.json({message},{status,headers:{"Cache-Control":"private, no-store","Pragma":"no-cache"}});
}
export async function POST(request:Request) {
 const headers=await validateGhostwriterHeaders(request,"auth");
 if("status" in headers) return reply(headers.status,headers.error);
 const body=await readGhostwriterJsonBody(request);
 if(!body.ok) return reply(body.status,body.error);
 const parsed=schema.safeParse(body.data);
 if(!parsed.success) return reply(400,"Invalid request.");
 const guard=await validateGhostwriterAuthPost(headers,parsed.data.action,parsed.data.challengeToken,parsed.data.challengeNonce);
 if("status" in guard) return reply(guard.status,guard.error);
 try {
  const input=parsed.data;
  const client=createAuthClient();
  if(input.action==="github"){
   if(process.env.GHOSTWRITER_GITHUB_LOGIN_ENABLED!=="true") return reply(503,"GitHub sign-in is not configured yet.");
   let verifier:string|null=null;
   const oauth=createAuthClient({getItem:()=>null,setItem:(key,value)=>{if(key.endsWith("code-verifier"))verifier=value;},removeItem:()=>{}});
   const {data,error}=await oauth.auth.signInWithOAuth({provider:"github",options:{scopes:"user:email",redirectTo:authRedirectOrigin()+"/api/ghostwriter/auth/callback",skipBrowserRedirect:true}});
   if(error || !data.url || !verifier) return reply(503,"Sign-in is unavailable.");
   const destination=new URL(data.url);
   if(destination.origin!==new URL(process.env.SUPABASE_URL!).origin || destination.pathname!=="/auth/v1/authorize") return reply(503,"Invalid sign-in destination.");
   const response=NextResponse.json({url:data.url},{headers:{"Cache-Control":"private, no-store"}});
   response.cookies.set(authCookieName("pkce"),verifier,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600});
   return response;
  }
  if(["send-code","verify"].includes(input.action) && process.env.GHOSTWRITER_EMAIL_LOGIN_ENABLED!=="true") return reply(503,"Email sign-in is not configured. Use GitHub.");
  if(input.action==="send-code"){
   if(!input.email) return reply(400,"Email required.");
   // No signup. Configure the Supabase email template to show the one-time code.
   await client.auth.signInWithOtp({email:input.email,options:{shouldCreateUser:process.env.GHOSTWRITER_RELEASE_PROFILE==="portfolio-free"}});
   return reply(200,"If this address can sign in, a code has been sent.");
  }
  if(input.action==="status" || input.action==="logout"){
   let identity=await authenticateAiRequest(request);
   let access=readAuthCookie(request,"access");
   if(!identity.ok && input.action==="logout"){
    const refreshed=await client.auth.refreshSession({refresh_token:readAuthCookie(request,"refresh") ?? ""});
    if(!refreshed.error && refreshed.data.session){
     access=refreshed.data.session.access_token;
     identity=await authenticateAiRequest(new Request(request.url,{headers:{authorization:"Bearer "+access}}));
    }
   }
   if(!identity.ok) {
    const response=reply(identity.status,identity.error);
    // A definitively invalid session cannot spend. Discard its stale cookies;
    // an unavailable revocation store is not treated as confirmed logout.
    if(input.action==="logout" && identity.status===401) {
     for(const kind of ["access","refresh"] as const) response.cookies.set(authCookieName(kind),"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
     return response;
    }
    return response;
   }
   if(input.action==="status") return NextResponse.json({message:"Signed in.",allowance:await freeTrial(identity.identity.accountId,identity.identity.sessionId!,true)},{headers:{"Cache-Control":"private, no-store"}});
   if(!identity.identity.sessionId || !await sessionRpc("ghostwriter_ai_revoke_session",identity.identity.accountId,identity.identity.sessionId)) return reply(503,"Logout could not be committed. Try again.");
   // Durable revocation is committed first; a late refresh cannot restore spending.
   if(access) {
    try { await client.auth.admin.signOut(access,"local"); } catch { /* Spending is already revoked durably. */ }
   }
   const response=reply(200,"Signed out.");
   for(const kind of ["access","refresh"] as const) response.cookies.set(authCookieName(kind),"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
   return response;
  }
  const result=input.action==="verify"
   ? (input.email && input.token ? await client.auth.verifyOtp({email:input.email,token:input.token,type:"email"}) : null)
   : await client.auth.refreshSession({refresh_token:readAuthCookie(request,"refresh") ?? ""});
  if(!result || result.error || !result.data.session) return reply(401,"Sign-in expired or invalid. Request a new code.");
  const session=result.data.session;
  const identity=await authenticateAiRequest(new Request(request.url,{headers:{authorization:"Bearer "+session.access_token}}));
  if(!identity.ok) return reply(identity.status,identity.error);
  await freeTrial(identity.identity.accountId,identity.identity.sessionId!,true);
  const response=reply(200,"Signed in.");
  for(const [kind,value,maxAge] of [["access",session.access_token,session.expires_in],["refresh",session.refresh_token,604800]] as const)
   response.cookies.set(authCookieName(kind),value,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge});
  return response;
 }catch{return reply(503,"Authentication is temporarily unavailable.");}
}
