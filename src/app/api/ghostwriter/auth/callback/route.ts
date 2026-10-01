import {NextResponse} from "next/server";
import {createAuthClient,authCookieName,readAuthCookie,freeTrial} from "@/server/auth-session";
import {callbackOrigin} from "@/server/auth-origin";
import {authenticateAiRequest} from "@/server/ai-auth";
import {openOAuthVerifier} from "@/server/oauth-envelope";
import {consumeAbuseRateLimits,hashAbuseKey} from "@/server/abuse-store";
export const runtime="nodejs";
export async function GET(request:Request){
 const unavailable=()=>new Response("Sign-in could not be completed. Return to the app and try again.",{status:401,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 try{
  if(process.env.GHOSTWRITER_GITHUB_LOGIN_ENABLED!=="true")return unavailable();
  const url=new URL(request.url),origin=callbackOrigin(request);
  if (url.searchParams.getAll("code").length!==1 || url.searchParams.size>3) return unavailable();
  const code=url.searchParams.get("code"),verifier=openOAuthVerifier(readAuthCookie(request,"pkce"));
  if(!code || code.length>1024 || !verifier)return unavailable();
  const allowed=await consumeAbuseRateLimits([
   {keyHash:hashAbuseKey("oauth-callback-global","release"),limit:30,windowMs:60_000},
   {keyHash:hashAbuseKey("oauth-callback-verifier",verifier),limit:3,windowMs:600_000},
  ],[],Date.now());
  if(!allowed.allowed)return unavailable();
  // Supabase owns OAuth state and PKCE validation. The verifier is browser-bound
  // in a short-lived HttpOnly cookie, never a caller-provided redirect or token.
  const client=createAuthClient({getItem:key=>key.endsWith("code-verifier")?verifier:null,setItem:()=>{},removeItem:()=>{}});
  const {data,error}=await client.auth.exchangeCodeForSession(code);
  if(error || !data.session)return unavailable();
  const session=data.session;
  const identity=await authenticateAiRequest(new Request(origin,{headers:{authorization:"Bearer "+session.access_token}}));
  if(!identity.ok)return unavailable();
  await freeTrial(identity.identity.accountId,identity.identity.sessionId!,true);
  const response=NextResponse.redirect(origin+"/second-voice?auth=complete",303);
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  response.cookies.set(authCookieName("pkce"),"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  response.cookies.set(`${process.env.NODE_ENV==="production"?"__Host-":""}gw-deletion`,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  for(const [kind,value,maxAge] of [["access",session.access_token,session.expires_in],["refresh",session.refresh_token,604800]] as const)
   response.cookies.set(authCookieName(kind),value,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge});
  return response;
 }catch{return unavailable();}
}
