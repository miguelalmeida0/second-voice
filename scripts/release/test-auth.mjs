import {spawn,spawnSync,execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {createHash,createHmac} from "node:crypto";
import {mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,copyFileSync,symlinkSync,existsSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {createClient} from "@supabase/supabase-js";
import {chromium} from "@playwright/test";
import assert from "node:assert/strict";
const prefix="gw-auth-proof-"+process.pid;
const network=prefix+"-net",pg=prefix+"-pg",auth=prefix+"-auth",rest=prefix+"-rest";
const jwt="isolated-auth-test-secret-never-a-real-credential-2026";
const tmp=".tmp/"+prefix;mkdirSync(tmp,{recursive:true});
// Separate Next's dev lock/cache from the owner's running development server.
// Only source inventory is copied; ignored local credentials never enter fixtures.
const appDirectory=resolve(tmp,"app");mkdirSync(appDirectory,{recursive:true});
const inventory=execFileSync("git",["ls-files","-z","--cached","--others","--exclude-standard"],{encoding:"utf8"}).split("\0");
for(const file of new Set(inventory)){
 if(!file||file.startsWith(".tmp/")||/(^|\/)\.env(\.|$)/.test(file)||!existsSync(file))continue;
 const destination=resolve(appDirectory,file);mkdirSync(dirname(destination),{recursive:true});copyFileSync(file,destination);
}
symlinkSync(resolve("node_modules"),appDirectory+"/node_modules","dir");
const docker=(args)=>execFileSync("docker",args,{encoding:"utf8",timeout:120000,stdio:["ignore","pipe","pipe"]}).trim();
const sql=s=>{const r=spawnSync("docker",["exec","-i",pg,"psql","-U","postgres","-Atq","-v","ON_ERROR_STOP=1"],{input:s,encoding:"utf8",timeout:30000});if(r.status!==0)throw new Error("Isolated SQL error: "+(r.stderr??r.error?.code??"unavailable").slice(0,900));return r.stdout.trim();};
const nativeFetch=globalThis.fetch;
globalThis.fetch=(input,options={})=>nativeFetch(input,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
const envFile=(name,values)=>{const path=tmp+"/"+name;writeFileSync(path,Object.entries(values).map(([k,v])=>k+"="+v).join("\n"),{mode:0o600});return path;};
const token=role=>{const h=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url");const p=Buffer.from(JSON.stringify({role,iss:"supabase",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url");return h+"."+p+"."+createHmac("sha256",jwt).update(h+"."+p).digest("base64url");};
const anon=token("anon"),service=token("service_role");
let authPort,restPort,app,browser;
let appLog="";
let cleanupPromise;
function cleanup(){
 return cleanupPromise??=(async()=>{
  await browser?.close();
  if(app?.pid){try{process.kill(-app.pid,"SIGTERM");}catch{app.kill();}}
  proxy.closeAllConnections();if(proxy.listening)await new Promise(r=>proxy.close(r));
  for(const name of [rest,auth,pg])spawnSync("docker",["stop",name],{stdio:"ignore",timeout:30000});
  spawnSync("docker",["network","rm",network],{stdio:"ignore",timeout:30000});rmSync(tmp,{recursive:true,force:true});
 })();
}
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>{void cleanup().finally(()=>process.exit(2));});
const proxy=createServer(async(req,res)=>{
 const authPath=req.url.startsWith("/auth/v1/");
 const base=authPath?authPort:restPort;
 if(!base){res.writeHead(503).end();return;}
 try{
  const chunks=[];for await(const c of req)chunks.push(c);
  const body=Buffer.concat(chunks);
  const headers={...req.headers};delete headers.host;delete headers.connection;
  const upstream=await fetch("http://127.0.0.1:"+base+req.url.replace(authPath?"/auth/v1":"/rest/v1",""),{method:req.method,headers,body:body.length?body:undefined,redirect:"manual"});
  res.writeHead(upstream.status,Object.fromEntries([...upstream.headers].filter(([k])=>!["content-encoding","transfer-encoding"].includes(k))));
  res.end(Buffer.from(await upstream.arrayBuffer()));
 }catch{res.writeHead(503).end();}
});
await new Promise(r=>proxy.listen(0,"127.0.0.1",r));
const base="http://127.0.0.1:"+proxy.address().port;
async function wait(check,label){for(let i=0;i<90;i++){try{if(await check()){console.log("auth-proof: "+label+" ready");return;}}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error(label+" unavailable");}
function port(name,number){return docker(["port",name,number+"/tcp"]).split(":").pop();}
try{
 docker(["network","create",network]);
 docker(["run","--rm","-d","--network",network,"--name",pg,"-e","POSTGRES_PASSWORD=isolated-only","postgres:16@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94"]);
 await wait(()=>spawnSync("docker",["exec",pg,"pg_isready","-h","127.0.0.1","-U","postgres"]).status===0,"PostgreSQL");
 sql("create role anon; create role authenticated; create role service_role; create role authenticator login password 'isolated-only' noinherit; grant anon,authenticated,service_role to authenticator; create schema auth; alter role postgres set search_path=auth,public;");
 const authEnv=envFile("auth.env",{GOTRUE_API_HOST:"0.0.0.0",GOTRUE_API_PORT:9999,API_EXTERNAL_URL:base+"/auth/v1",GOTRUE_DB_DRIVER:"postgres",GOTRUE_DB_DATABASE_URL:"postgres://postgres:isolated-only@"+pg+":5432/postgres",GOTRUE_DB_NAMESPACE:"auth",GOTRUE_SITE_URL:"http://127.0.0.1:3219/second-voice",GOTRUE_DISABLE_SIGNUP:"true",GOTRUE_JWT_ADMIN_ROLES:"service_role",GOTRUE_JWT_AUD:"authenticated",GOTRUE_JWT_DEFAULT_GROUP_NAME:"authenticated",GOTRUE_JWT_EXP:3600,GOTRUE_JWT_SECRET:jwt,GOTRUE_JWT_ISSUER:base+"/auth/v1",GOTRUE_EXTERNAL_EMAIL_ENABLED:"true",GOTRUE_MAILER_AUTOCONFIRM:"false",GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:"false"});
 docker(["run","--rm","-d","--network",network,"--name",auth,"-p","127.0.0.1::9999","--env-file",authEnv,"supabase/gotrue:v2.189.0@sha256:385184459f57569c54c25209f51f3b2be99ddd7c4ce9e3555b5d3eea8447b7cf"]);
 authPort=port(auth,9999);
 await wait(async()=> (await fetch(base+"/auth/v1/health")).ok,"GoTrue");
 for(const f of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort())sql(readFileSync("supabase/migrations/"+f,"utf8"));
 const restEnv=envFile("rest.env",{PGRST_DB_URI:"postgres://authenticator:isolated-only@"+pg+":5432/postgres",PGRST_DB_SCHEMAS:"public",PGRST_DB_ANON_ROLE:"anon",PGRST_JWT_SECRET:jwt,PGRST_DB_MAX_ROWS:100});
 docker(["run","--rm","-d","--network",network,"--name",rest,"-p","127.0.0.1::3000","--env-file",restEnv,"postgrest/postgrest:v14.12@sha256:54000f24847d01a2c2302e0041cf0618b875c57fb48507d743cfa9aaa50bf43c"]);
 restPort=port(rest,3000);
 const admin=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
 await wait(async()=> (await fetch(base+"/rest/v1/",{headers:{authorization:"Bearer "+service,apikey:service}})).ok,"PostgREST");
 const email="owner@isolated.test";
 const created=await admin.auth.admin.createUser({email,email_confirm:true});
 assert.equal(created.error,null);const account=created.data.user.id;
 sql("insert into public.ghostwriter_beta_entitlements(account_id,approved_slot) values('"+account+"',1);");
 const generated=await admin.auth.admin.generateLink({type:"magiclink",email});assert.equal(generated.error,null);
 const otp=generated.data.properties.email_otp;
 const directSignup=await fetch(base+"/auth/v1/signup",{method:"POST",headers:{"content-type":"application/json",apikey:anon},body:JSON.stringify({email:"outsider@isolated.test",password:"synthetic-password-123!"})});
 assert.ok(directSignup.status>=400,"Direct public signup unexpectedly enabled");
 const childEnv={...process.env,WATCHPACK_POLLING:"true",AI_ENABLED:"false",SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,GROQ_API_KEY:"synthetic-never-live",GHOSTWRITER_ABUSE_STORE_MODE:"supabase",GHOSTWRITER_E2E_FIXTURE_MODE:"false",GHOSTWRITER_SECURITY_SECRET:"isolated-auth-shield-secret-".repeat(3),NEXT_PUBLIC_SITE_URL:"http://127.0.0.1:3219",NEXT_TELEMETRY_DISABLED:"1"};
 childEnv.GHOSTWRITER_EMAIL_LOGIN_ENABLED="true";
 app=spawn("node",[resolve("node_modules/next/dist/bin/next"),"dev","--webpack","-H","127.0.0.1","-p","3219"],{cwd:appDirectory,env:childEnv,stdio:["ignore","pipe","pipe"],detached:true});
 app.stdout.on("data",c=>{appLog=(appLog+c).slice(-8000);});
 app.stderr.on("data",c=>{appLog=(appLog+c).slice(-8000);});
 await wait(async()=> (await fetch("http://127.0.0.1:3219/second-voice")).ok,"Next authentication UI");

 // Exercise actual Next HTTP handlers with real GoTrue/PostgREST before browser launch.
 const appOrigin="http://127.0.0.1:3219";
 const jar=new Map();
 const ua="Mozilla/5.0 GhostwriterReleaseVerification";
 function acceptCookies(response){for(const value of response.headers.getSetCookie()){const first=value.split(";")[0],i=first.indexOf("=");const key=first.slice(0,i),v=first.slice(i+1);if(v)jar.set(key,v);else jar.delete(key);}}
 const initial=await fetch(appOrigin+"/second-voice",{headers:{"user-agent":ua}});acceptCookies(initial);
 async function action(body,path="/api/ghostwriter/auth",expectedStatus=200){
  const csrf=jar.get("gw_csrf");assert.ok(csrf);
  const headers={"user-agent":ua,origin:appOrigin,"x-ghostwriter-csrf":csrf,cookie:[...jar].map(([k,v])=>k+"="+v).join("; ")};
  let proof={};
  if(body.action!=="logout"){
   const challenge=await fetch(appOrigin+"/api/ghostwriter/challenge",{headers});
   const c=await challenge.json();assert.equal(challenge.status,200,"Challenge rejected");
   let nonce=0;while(!createHash("sha256").update(c.challengeToken+"."+nonce).digest("hex").startsWith("0".repeat(c.difficulty)))nonce++;
   proof={challengeToken:c.challengeToken,challengeNonce:String(nonce)};
  }
  const response=await fetch(appOrigin+path,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({...body,...proof})});
  acceptCookies(response);const data=await response.json();
  assert.equal(response.status,expectedStatus,"HTTP action "+(body.action??"rewrite")+": "+(data.message??data.error));
  return response;
 }
 const verified=await action({action:"verify",email,token:otp});
 assert.ok(verified.headers.getSetCookie().some(c=>c.includes("HttpOnly")),"Missing HTTP-only auth cookie");
 const capturedHttp=jar.get("gw-access");assert.ok(capturedHttp);
 Object.assign(process.env,{SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service});
 const {authenticateAiRequest:checkIdentity}=await import("../../src/server/ai-auth.ts");
 const capturedRequest=()=>new Request(appOrigin+"/api/ghostwriter",{headers:{authorization:"Bearer "+capturedHttp}});
 const identity=await checkIdentity(capturedRequest());assert.equal(identity.ok,true);
 const sessionId=identity.identity.sessionId;
 // The real Auth session and the durable spending admission must both reject a
 // suspended account, independently of UI state or a still-valid captured JWT.
 const reserve=key=>admin.rpc("ghostwriter_ai_reserve",{
  p_account_id:account,p_session_id:sessionId,p_idempotency_key:key,p_request_fingerprint:"a".repeat(64),
  p_pricing_version:"groq-openai-gpt-oss-20b-2026-09-07",p_reservation_micro_usd:750,
  p_max_approved_accounts:25,p_account_lifetime_limit:10,p_account_day_limit:5,p_account_minute_limit:3,
  p_account_concurrency_limit:1,p_global_minute_limit:10,p_global_concurrency_limit:2,
  p_hour_budget_micro_usd:500000,p_day_budget_micro_usd:2000000,p_beta_lifetime_budget_micro_usd:10000000,
 });
 sql("update public.ghostwriter_ai_control set paused=false,valid_until=now()+interval '1 hour';");
 const suspended=await admin.auth.admin.updateUserById(account,{ban_duration:"1h"});assert.equal(suspended.error,null);
 assert.equal((await checkIdentity(capturedRequest())).ok,false);
 const bannedAdmission=await reserve("suspended-proof-0001");assert.equal(bannedAdmission.error,null);assert.equal(bannedAdmission.data.reason,"session_revoked");
 const restored=await admin.auth.admin.updateUserById(account,{ban_duration:"none"});assert.equal(restored.error,null);
 assert.equal((await checkIdentity(capturedRequest())).ok,true);
 sql("update public.ghostwriter_beta_entitlements set revoked_at=now() where account_id='"+account+"';");
 const revokedAdmission=await reserve("entitlement-proof-0001");assert.equal(revokedAdmission.error,null);assert.equal(revokedAdmission.data.reason,"not_entitled");
 sql("update public.ghostwriter_beta_entitlements set revoked_at=null where account_id='"+account+"';");
 const forged=capturedHttp.slice(0,-5)+"AAAAA";
 assert.equal((await checkIdentity(new Request(appOrigin+"/api/ghostwriter",{headers:{authorization:"Bearer "+forged}}))).ok,false);
 const approvalAttempt=await fetch(base+"/rest/v1/ghostwriter_beta_entitlements",{method:"POST",headers:{apikey:anon,authorization:"Bearer "+capturedHttp,"content-type":"application/json"},body:JSON.stringify({account_id:account,approved_slot:2})});
 assert.ok(approvalAttempt.status>=400,"Authenticated user wrote entitlement");
 const runtimeAttempt=await fetch(base+"/rest/v1/ghostwriter_beta_entitlements",{method:"POST",headers:{apikey:service,authorization:"Bearer "+service,"content-type":"application/json"},body:JSON.stringify({account_id:account,approved_slot:2})});
 assert.ok(runtimeAttempt.status>=400,"Runtime wrote entitlement directly");

 await action({action:"refresh"});
 // Both requests leave with the same refresh cookie; either valid response must
 // retain the same durable session, so later logout fences both race winners.
 const refreshCookie=jar.get("gw-refresh");
 const refreshes=await Promise.all([0,1].map(async()=>{
  const client=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  return client.auth.refreshSession({refresh_token:refreshCookie});
 }));
 const raceTokens=refreshes.filter(r=>!r.error&&r.data.session).map(r=>r.data.session.access_token);
 assert.ok(raceTokens.length>0,"Refresh race returned no valid session");
 for(const access of raceTokens){
  const checked=await checkIdentity(new Request(appOrigin,{headers:{authorization:"Bearer "+access}}));
  assert.equal(checked.ok,true);assert.equal(checked.identity.sessionId,sessionId);
 }
 for(let i=0;i<3;i++) await action({text:"A lamp remained lit.",author:"tolkien",mood:50},"/api/ghostwriter",503);
 jar.delete("gw-access"); // Real expired-access / retained-refresh logout regression.
 await action({action:"logout"});
 assert.equal((await checkIdentity(capturedRequest())).ok,false,"Captured token survived committed logout");
 for(const access of raceTokens)assert.equal((await checkIdentity(new Request(appOrigin,{headers:{authorization:"Bearer "+access}}))).ok,false,"Refresh-race token survived committed logout");
 const loggedOutAdmission=await reserve("logged-out-proof-0001");assert.equal(loggedOutAdmission.error,null);assert.equal(loggedOutAdmission.data.reason,"session_revoked");
 assert.equal(jar.has("gw-refresh"),false);
 const replayHttp=await admin.auth.verifyOtp({email,token:otp,type:"email"});assert.ok(replayHttp.error);
 console.log(JSON.stringify({scope:"Real Next HTTP + GoTrue + PostgREST + PostgreSQL",status:"PASS",checks:["direct-signup-denied","email-otp","account-suspension","entitlement-revocation","refresh","refresh-race-session-identity","logout-after-rewrite-quota-exhausted","logout-with-expired-access","captured-and-racing-refresh-tokens-rejected","logout-blocks-durable-admission","otp-replay-denied"]}));
 // A fresh single-use code is needed for the separate actual-browser proof.
 const browserCode=await admin.auth.admin.generateLink({type:"magiclink",email});
 assert.equal(browserCode.error,null);
 browser=await chromium.launch();
 const context=await browser.newContext();const page=await context.newPage();
 // No traces/videos/screenshots: even synthetic auth tokens stay out of artifacts.
 await page.goto("http://127.0.0.1:3219/second-voice");
 await page.getByText("Invited beta access",{exact:true}).click();
 await page.getByLabel("Email",{exact:true}).fill(email);
 await page.getByLabel("Email code",{exact:true}).fill(browserCode.data.properties.email_otp);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await wait(async()=> (await context.cookies()).some(c=>c.name==="gw-access"),"Verified auth cookie");
 const captured=(await context.cookies()).find(c=>c.name==="gw-access");
 assert.ok(captured.httpOnly);assert.equal(captured.sameSite,"Strict");
 Object.assign(process.env,{SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service});
 const {authenticateAiRequest}=await import("../../src/server/ai-auth.ts");
 const request=()=>new Request("http://127.0.0.1:3219/api/ghostwriter",{headers:{authorization:"Bearer "+captured.value}});
 assert.equal((await authenticateAiRequest(request())).ok,true,"Real Auth identity failed");
 await page.reload();await page.getByText("Invited beta access",{exact:true}).click();
 await page.getByRole("button",{name:"Sign out",exact:true}).click();
 await wait(async()=>!(await context.cookies()).some(c=>c.name==="gw-access"),"Logout");
 assert.equal((await authenticateAiRequest(request())).ok,false,"Captured access token still authorized after committed logout");
 const replay=await admin.auth.verifyOtp({email,token:otp,type:"email"});
 assert.ok(replay.error,"OTP replay accepted");
 console.log(JSON.stringify({status:"PASS",scope:"Real GoTrue + PostgREST + PostgreSQL, actual Next browser OTP verification/logout; no paid provider",checks:["direct-signup-denied","email-code-browser-signin","httpOnly-cookie","server-identity-verification","durable-logout","captured-token-rejected","otp-replay-denied"],limitations:["SMTP delivery not tested: operator generateLink supplied isolated code","No paid gateway dispatch; live billing contract remains blocked"]},null,2));
}catch(error){
 writeFileSync(".tmp/release/auth-app.log",appLog.replaceAll(jwt,"[synthetic]").replaceAll(service,"[synthetic]").replaceAll(anon,"[synthetic]"));
 if(/bootstrap_check_in|MachPortRendezvous|Permission denied|operation not permitted|EPERM/.test(String(error))){console.error("BROWSER_BLOCKED: native browser bootstrap permission denied; HTTP authentication proof completed separately");process.exitCode=2;}else throw error;
}finally{
 await cleanup();
}
