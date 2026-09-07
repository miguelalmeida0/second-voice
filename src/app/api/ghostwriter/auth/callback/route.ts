import {NextResponse} from "next/server";
import {createAuthClient,authCookieName,readAuthCookie,authRedirectOrigin,freeTrial} from "@/server/auth-session";
import {authenticateAiRequest} from "@/server/ai-auth";
export const runtime="nodejs";
export async function GET(request:Request){
 const unavailable=()=>new Response("Sign-in could not be completed. Return to the app and try again.",{status:401,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 try{
  if(process.env.GHOSTWRITER_GITHUB_LOGIN_ENABLED!=="true")return unavailable();
  const url=new URL(request.url),origin=authRedirectOrigin();
  if(url.origin!==origin)return unavailable();
  const code=url.searchParams.get("code"),verifier=readAuthCookie(request,"pkce");
  if(!code || code.length>1024 || !verifier)return unavailable();
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
  for(const [kind,value,maxAge] of [["access",session.access_token,session.expires_in],["refresh",session.refresh_token,604800]] as const)
   response.cookies.set(authCookieName(kind),value,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge});
  return response;
 }catch{return unavailable();}
}
