import {spawn,execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {createHash,randomBytes,createCipheriv,createDecipheriv} from "node:crypto";
import {mkdirSync,writeFileSync,chmodSync} from "node:fs";
import {resolve} from "node:path";
import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
import {createClient} from "@supabase/supabase-js";
import {portfolioTargetSql,portfolioTargetErrors} from "./target-policy.mjs";

export async function runProductionGate({sql,base,anon,service,admin,appDirectory,pg,setAuthUnavailable,setRestFailure}) {
 const evidence=[]; const processes=[]; let browser;
 const evidenceDir=resolve(".tmp/predeploy");mkdirSync(evidenceDir,{recursive:true,mode:0o700});chmodSync(evidenceDir,0o700);
 let calls=0,active=0,maxActive=0,mode="success",hold=false,releases=[];
 const provider=createServer(async(req,res)=>{
  let body="";for await(const c of req)body+=c;
  const request=JSON.parse(body);
  assert.equal(request.model,"openai/gpt-oss-20b");assert.equal(request.max_completion_tokens,2000);
  calls++;active++;maxActive=Math.max(maxActive,active);
  if(hold) await new Promise(r=>releases.push(r));
  if(mode==="slow")await new Promise(r=>setTimeout(r,31000));
  active--;
  if(mode==="disconnect"){req.socket.destroy();return;}
  if(mode==="429"||mode==="500"){res.writeHead(Number(mode)).end("{}");return;}
  const output={id:"isolated-operation-"+calls,choices:[{message:{content:mode==="malformed"?"":"The lamp remained lit beside the road."},finish_reason:"stop"}],usage:{prompt_tokens:100,completion_tokens:100}};
  if(mode==="missing-usage")delete output.usage;
  res.setHeader("Content-Type","application/json");res.end(JSON.stringify(output));
 });
 await new Promise(r=>provider.listen(0,"127.0.0.1",r));
 const origin="http://127.0.0.1:3221", ua="Mozilla/5.0 GhostwriterReleaseVerification";
 const env={...process.env,NODE_ENV:"production",AI_ENABLED:"true",GHOSTWRITER_RELEASE_PROFILE:"portfolio-free",GHOSTWRITER_PROVIDER:"groq",GROQ_MODEL:"openai/gpt-oss-20b",GHOSTWRITER_AI_PRICING_VERSION:"groq-openai-gpt-oss-20b-2026-09-07",GROQ_API_KEY:randomBytes(32).toString("hex"),GHOSTWRITER_FINGERPRINT_SECRET:randomBytes(32).toString("hex"),GHOSTWRITER_SECURITY_SECRET:randomBytes(32).toString("hex"),GROQ_FREE_ORGANIZATION_ID:"org-isolated",GROQ_FREE_PROJECT_ID:"project-isolated",SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,GHOSTWRITER_ABUSE_STORE_MODE:"supabase",GHOSTWRITER_TRUST_PROXY:"true",GHOSTWRITER_TRUSTED_IP_HEADER:"x-forwarded-for",GHOSTWRITER_E2E_FIXTURE_MODE:"false",GHOSTWRITER_GITHUB_LOGIN_ENABLED:"true",GHOSTWRITER_EMAIL_LOGIN_ENABLED:"false",GHOSTWRITER_ALLOW_PUBLIC_SHARING:"false",GHOSTWRITER_POW_DIFFICULTY:"1",CRON_SECRET:"synthetic-cron-secret-"+randomBytes(32).toString("hex"),NEXT_PUBLIC_SITE_URL:origin,NEXT_TELEMETRY_DISABLED:"1",ISOLATED_PROVIDER_URL:"http://127.0.0.1:"+provider.address().port};
 delete env.VERCEL_ENV;
 env.GHOSTWRITER_CLIENT_IP_HEADER="x-forwarded-for";
 async function child(args,extra={}) {
  const proc=spawn(process.execPath,args,{cwd:appDirectory,env:{...env,...extra},stdio:["ignore","pipe","pipe"]});processes.push(proc);
  let log="";proc.stdout.on("data",c=>{log=(log+c).slice(-10000);});proc.stderr.on("data",c=>{log=(log+c).slice(-10000);});
  proc.summary=()=>log.replaceAll(env.GROQ_API_KEY,"[redacted]").replaceAll(service,"[redacted]").replaceAll(anon,"[redacted]");return proc;
 }
 async function waitFor(test,label){for(let n=0;n<120;n++){if(await test().catch(()=>false))return;await new Promise(r=>setTimeout(r,250));}throw new Error(label+" timed out");}
 const jars=[];
 function cookies(response,jar){for(const value of response.headers.getSetCookie()){const pair=value.split(";")[0],i=pair.indexOf("=");pair.slice(i+1)?jar.set(pair.slice(0,i),pair.slice(i+1)):jar.delete(pair.slice(0,i));}}
 async function request(jar,path,body,port=3221,key){
  const headers={"user-agent":ua,origin,"x-forwarded-for":jar.ip,"x-ghostwriter-csrf":jar.get("gw_csrf"),cookie:[...jar].map(([k,v])=>k+"="+v).join("; ")};
  if(key)headers["idempotency-key"]=key;
  const response=await fetch("http://127.0.0.1:"+port+path,{method:body?"POST":"GET",headers:{...headers,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});
  cookies(response,jar);return response;
 }
 async function challenge(jar,port=3221){
  const response=await request(jar,"/api/ghostwriter/challenge",undefined,port);assert.equal(response.status,200,"challenge");const c=await response.json();
  let nonce=0;while(!createHash("sha256").update(c.challengeToken+"."+nonce).digest("hex").startsWith("0".repeat(c.difficulty)))nonce++;
  return {challengeToken:c.challengeToken,challengeNonce:String(nonce)};
 }
 async function rewrite(jar,key,port=3221,text="A lamp beside the road."){
  return request(jar,"/api/ghostwriter",{author:"tolkien",mood:50,text,...await challenge(jar,port)},port,key);
 }
 function clearAbuse(){sql("truncate public.ghostwriter_abuse_counters,public.ghostwriter_abuse_penalties,public.ghostwriter_used_challenges;");}
 // Dispatched operations are now identity-immutable once the combined
 // global-cap trigger stamps global_dispatch_authorized_at (rewriting
 // dispatched_at on them raises "AI dispatch identity is immutable" by
 // design). Reset rate-limit windows between scenarios by clearing the rows
 // outright instead of backdating them in place.
 function age(){sql("truncate public.ghostwriter_ai_operations;");clearAbuse();}
 try {
  const build=await child([resolve("node_modules/next/dist/bin/next"),"build","--webpack"],{AI_ENABLED:"false"});
  const code=await new Promise(r=>build.once("exit",r));assert.equal(code,0,"isolated production build: "+build.summary());
  const preload=resolve("tests/fixtures/production-egress.mjs");
  for(const port of [3221,3222])await child(["--import",preload,resolve("node_modules/next/dist/bin/next"),"start","-H","127.0.0.1","-p",String(port)]);
  // A brand-new portfolio-free visitor gets a one-time bootstrap redirect to
  // the same URL once the anonymous-visitor cookie is issued (src/proxy.ts).
  // A real browser resends that cookie automatically; a bare fetch() with no
  // cookie jar never does, so it loops until the redirect budget is exhausted.
  // Carry the cookie across one manual redirect, same as any real client.
  async function visit(url,jar,headers={}){
   for(let hop=0;hop<5;hop++){
    const response=await fetch(url,{redirect:"manual",headers:{...headers,cookie:[...jar].map(([k,v])=>k+"="+v).join("; ")}});
    cookies(response,jar);
    if(response.status<300||response.status>=400)return response;
    await response.arrayBuffer();
    url=new URL(response.headers.get("location"),url).toString();
   }
   throw new Error("Too many redirects for "+url);
  }
  async function readySecondVoice(port){
   return (await visit("http://127.0.0.1:"+port+"/second-voice",new Map())).ok;
  }
  for(const port of [3221,3222])await waitFor(()=>readySecondVoice(port),"production worker");
  for(const format of ["image/avif","image/webp"]){
   const portrait=await fetch(origin+"/_next/image?url=%2Fghostwriter%2Fportraits%2Ftolkien-color.png&w=128&q=75",{headers:{accept:format}});
   assert.equal(portrait.status,200,"local portrait optimizer");
   assert.equal(portrait.headers.get("content-type"),format);
   assert.ok((await portrait.arrayBuffer()).byteLength>0);
  }
  assert.equal((await fetch(origin+"/_next/image?url=https%3A%2F%2Fexample.com%2Funtrusted.avif&w=128&q=75")).status,400);
  evidence.push({test:"patched-image-optimizer-local-avif-webp-and-remote-source-denial",status:"PASS"});
  sql("create schema if not exists cron;create table if not exists cron.job(jobid bigint generated always as identity primary key,jobname text,schedule text,command text,active boolean not null default true);insert into cron.job(jobname,schedule,command,active) values('ghostwriter-retention','*/5 * * * *','select public.ghostwriter_retention_maintenance();',true);update public.ghostwriter_ai_control set release_profile='portfolio-free',paused=false,valid_until='infinity'::timestamptz,free_organization_id='org-isolated',free_project_id='project-isolated',free_verified_at=clock_timestamp(),free_verified_until=clock_timestamp()+interval '1 day',free_evidence_reference='synthetic-plan-fixture';select public.ghostwriter_retention_maintenance();");
  const target=JSON.parse(sql(portfolioTargetSql));
  assert.deepEqual(portfolioTargetErrors(target,{deploymentId:target.deploymentId,groqOrganizationId:'org-isolated',groqProjectId:'project-isolated'}),[]);
  sql("grant execute on function public.ghostwriter_free_reserve(uuid,uuid,text,text,text,text) to service_role;");
  assert.ok(portfolioTargetErrors(JSON.parse(sql(portfolioTargetSql)),{deploymentId:target.deploymentId,groqOrganizationId:'org-isolated',groqProjectId:'project-isolated'}).length);
  sql("revoke execute on function public.ghostwriter_free_reserve(uuid,uuid,text,text,text,text) from service_role;");
  evidence.push({test:'target-preflight-current-grants-and-legacy-grant-negative-control',status:'PASS'});
  for(let n=0;n<4;n++){
   const email="ordinary"+n+"@isolated.test";
   const created=await admin.auth.admin.createUser({email,email_confirm:true});assert.equal(created.error,null);
   const link=await admin.auth.admin.generateLink({type:"magiclink",email});assert.equal(link.error,null);
   // Keep user sessions out of the privileged fixture client: verifyOtp installs
   // its session even when persistence is disabled.
   const userClient=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
   const verified=await userClient.auth.verifyOtp({email,token:link.data.properties.email_otp,type:"email"});assert.equal(verified.error,null);
   const session=verified.data.session, claims=JSON.parse(Buffer.from(session.access_token.split(".")[1],"base64url"));
   const jar=new Map([["__Host-gw-access",session.access_token],["__Host-gw-refresh",session.refresh_token]]);jar.ip="198.51.100."+(n+1);jar.account=created.data.user.id;jar.session=claims.session_id;
   await visit(origin+"/second-voice",jar,{"user-agent":ua,"x-forwarded-for":jar.ip});
   assert.equal(sql(`select public.ghostwriter_free_entitle_bounded('${jar.account}','${jar.session}',25);`),"entitled");jars.push(jar);
  }
  clearAbuse();hold=true;
  const first=rewrite(jars[0],"production-storm-winner",3221);
  first.catch(()=>undefined);
  await waitFor(async()=>active===1,"held provider");
  // Every attempt traverses real Next routing, shield, identity and admission.
  // Reused consumed proof must be rejected before dispatch; this is not a SQL-only storm.
  const proofs=await Promise.all(jars.map(jar=>challenge(jar)));
  const storm=await Promise.all(Array.from({length:99},(_,n)=>request(jars[n%4],"/api/ghostwriter",{author:"tolkien",mood:50,text:"A lamp beside the road.",...proofs[n%4]},3221+n%2,"production-storm-"+String(n).padStart(4,"0"))));
  assert.ok(storm.every(r=>r.status>=400));assert.equal(calls,1);assert.equal(maxActive,1);
  hold=false;releases.splice(0).forEach(r=>r());assert.equal((await first).status,200);
  evidence.push({test:"two-production-Next-workers-100-concurrent-HTTP-attempts",status:"PASS",attempts:100,providerDispatches:1,maximumActive:1,note:"99 denials include shield/challenge and ledger denials; not 100 successful authenticated ledger reservations"});
  clearAbuse();assert.equal((await rewrite(jars[0],"production-storm-winner",3222)).status,200);assert.equal(calls,1);
  clearAbuse();assert.equal((await rewrite(jars[0],"production-storm-winner",3222,"Changed body")).status,409);assert.equal(calls,1);
  evidence.push({test:"cross-worker-same-operation-replay-and-conflict",status:"PASS"});
  for(const path of ["/api/ghostwriter/share","/api/ghostwriter/feedback","/api/ghostwriter/lab"]){assert.equal((await request(jars[0],path,{})).status,404);}
  const publicRead=await admin.rpc("ghostwriter_public_rewrite_lookup",{p_short_id:"abcdefghij"});assert.ok(publicRead.error);
  evidence.push({test:"optional-Free-routes-and-direct-public-lookup-denied",status:"PASS"});
  for(const rpc of ["ghostwriter_free_reserve_bounded","ghostwriter_ai_mark_dispatched"]){
   age();setRestFailure(rpc);const before=calls;
   assert.equal((await rewrite(jars[1],"ambiguous-commit-"+rpc)).status,503);assert.equal(calls,before);
   const state=sql("select state from public.ghostwriter_ai_operations order by created_at desc limit 1;");
   assert.equal(state,rpc.includes("reserve")?"reserved":"dispatched");
   // Isolated operator knows mock accepted nothing; preserve the dispatch
   // claim and row even when reconciling the synthetic zero provider cost.
   sql("update public.ghostwriter_ai_operations set state='settled',outcome='failed',actual_micro_usd=0,settled_at=clock_timestamp() where state in ('reserved','dispatched');");
   evidence.push({test:"ambiguous-commit-"+rpc,status:"PASS",providerDispatches:0,preservedState:state});
  }
  clearAbuse();setRestFailure("outage");const beforeOutage=calls;
  assert.equal((await request(jars[0],"/api/ghostwriter/challenge")).status,503);assert.equal(calls,beforeOutage);setRestFailure(null);
  sql("alter role authenticator connection limit 0; select pg_terminate_backend(pid) from pg_stat_activity where usename='authenticator' and pid<>pg_backend_pid();");
  assert.equal((await request(jars[0],"/api/ghostwriter/challenge")).status,503);assert.equal(calls,beforeOutage);
  sql("alter role authenticator connection limit -1;");
  await waitFor(async()=> (await fetch(base+"/rest/v1/",{headers:{apikey:service,authorization:"Bearer "+service}})).ok,"database pool recovery");
  clearAbuse();evidence.push({test:"database-outage-and-connection-exhaustion-deny-before-provider",status:"PASS"});
  for(const failure of ["429","500","disconnect","malformed","missing-usage","slow"]){
   age();sql("update public.ghostwriter_ai_control set paused=false;");mode=failure;
   const before=calls,started=Date.now();const response=await rewrite(jars[1],"production-failure-"+failure);assert.ok(response.status>=400);assert.equal(calls-before,1,"provider failure must exercise exactly one dispatch: "+failure);
   if(failure==="slow")assert.ok(Date.now()-started>=29000&&Date.now()-started<40000,"30-second provider deadline plus bounded ledger settlement");
   // Known, definite provider rejections (429/5xx) now settle immediately as
   // "failed" via ghostwriter_ai_settle_known_failure, releasing the user's
   // own allowance while the fleet dispatch stamp stays charged (see
   // 202609160002_secondvoice_provider_failure_accounting.sql). Only a truly
   // ambiguous outcome (disconnect, malformed body, missing usage, timeout)
   // is left "uncertain" for operator reconciliation.
   const knownRejection=failure==="429"||failure==="500";
   assert.equal(sql("select state from public.ghostwriter_ai_operations order by created_at desc limit 1;"),knownRejection?"failed":"uncertain");
   // Isolated operator reconciliation only. Never refund a dispatched start.
   sql("update public.ghostwriter_ai_operations set state='settled',outcome='failed',actual_micro_usd=750,settled_at=clock_timestamp() where state='uncertain';");
   evidence.push({test:"provider-"+failure,status:"PASS",dispatches:calls-before,elapsedMs:Date.now()-started});
  }
  mode="success";age();sql("update public.ghostwriter_ai_control set paused=false;");
  await waitFor(async()=>active===0,"timed-out mock provider completion");
  hold=true;const beforeCrash=calls;
  const crashed=rewrite(jars[0],"production-worker-crash").catch(()=>null);
  await waitFor(async()=>active===1,"crash checkpoint after dispatch");
  const worker=processes[1];
  const exited=new Promise(resolve=>worker.once("exit",resolve));worker.kill("SIGKILL");await exited;
  hold=false;releases.splice(0).forEach(r=>r());await crashed;
  clearAbuse();assert.equal((await rewrite(jars[0],"production-worker-crash",3222)).status,409);
  await child(["--import",preload,resolve("node_modules/next/dist/bin/next"),"start","-H","127.0.0.1","-p","3221"]);
  await waitFor(()=>readySecondVoice(3221),"restarted production worker");
  clearAbuse();assert.equal((await rewrite(jars[0],"production-worker-crash")).status,409);
  assert.equal(calls,beforeCrash+1);
  assert.equal(sql("select count(*) from public.ghostwriter_ai_operations where state='dispatched';"),"1");
  evidence.push({test:"worker-termination-after-dispatch-and-restart-retains-start-no-replay",status:"PASS",dispatches:1});
  // Isolated reconciliation after observing the mock's one completed call.
  sql("update public.ghostwriter_ai_operations set state='settled',outcome='failed',actual_micro_usd=750,settled_at=clock_timestamp() where state='dispatched';");
  age();
  const checkpoint={kind:"before-dispatch",reached:false,release:null};setRestFailure(checkpoint);
  const beforeUnsent=calls;
  const unsent=rewrite(jars[0],"production-before-dispatch-crash").catch(()=>null);
  await waitFor(async()=>checkpoint.reached,"before-dispatch checkpoint");
  const latestWorker=processes.at(-1);
  const stopped=new Promise(resolve=>latestWorker.once("exit",resolve));latestWorker.kill("SIGKILL");await stopped;await unsent;
  checkpoint.release();setRestFailure(null);
  assert.equal(calls,beforeUnsent);
  assert.equal(sql("select count(*) from public.ghostwriter_ai_operations where state='reserved' and dispatched_at is null;"),"1");
  clearAbuse();assert.equal((await rewrite(jars[0],"production-before-dispatch-crash",3222)).status,409);assert.equal(calls,beforeUnsent);
  await child(["--import",preload,resolve("node_modules/next/dist/bin/next"),"start","-H","127.0.0.1","-p","3221"]);
  await waitFor(()=>readySecondVoice(3221),"worker restarted before dispatch");
  clearAbuse();assert.equal((await rewrite(jars[0],"production-before-dispatch-crash")).status,409);assert.equal(calls,beforeUnsent);
  sql("update public.ghostwriter_ai_operations set state='failed',outcome='failed',actual_micro_usd=0,settled_at=clock_timestamp() where state='reserved' and dispatched_at is null;");
  evidence.push({test:"worker-termination-before-dispatch-restart-zero-calls",status:"PASS",dispatches:0});
  age();
  // ghostwriter_private hosts the combined-cap trigger function that public.ghostwriter_ai_operations
  // now depends on for every insert/update (202609160001); omitting it leaves the restored
  // database unable to accept any accounting row, not just missing an unrelated schema.
  const beforeDeletionDump=execFileSync("docker",["exec",pg,"pg_dump","-U","postgres","--no-owner","--schema=public","--schema=auth","--schema=ghostwriter_private"],{maxBuffer:16*1024*1024});
  hold=true;const pending=rewrite(jars[2],"production-deletion-race");await waitFor(async()=>active===1,"deletion race provider");
  const deleted=await request(jars[2],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT"});assert.equal(deleted.status,200);
  hold=false;releases.splice(0).forEach(r=>r());assert.equal((await pending).status,401);
  assert.equal(sql(`select count(*) from public.ghostwriter_ai_operations where account_id='${jars[2].account}' and result_json is not null;`),"0");
  assert.equal(sql(`select count(*) from public.ghostwriter_portfolio_entitlements where account_id='${jars[2].account}' and revoked_at is not null;`),"1");
  assert.equal(sql(`select count(*) from auth.users where id='${jars[2].account}';`),"0");
  evidence.push({test:"real-Auth-deletion-provider-race-redaction-and-nonrecycled-slot",status:"PASS"});
  clearAbuse();
  assert.equal((await request(jars[3],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT",accountId:jars[0].account})).status,400);
  const receipt=randomBytes(32).toString("hex"),receiptHash=createHash("sha256").update(receipt).digest("hex");
  sql(`update auth.sessions set created_at=clock_timestamp()-interval '1 hour' where id='${jars[3].session}';`);
  assert.equal(sql(`select public.ghostwriter_delete_begin('${jars[3].account}','${jars[3].session}','${receiptHash}');`),"f");
  sql(`update auth.sessions set created_at=clock_timestamp() where id='${jars[3].session}';`);
  assert.equal(sql(`select public.ghostwriter_delete_begin('${jars[3].account}','${jars[3].session}','${receiptHash}');`),"t");
  // Commit happened but the response/receipt never reached the browser.
  assert.equal((await request(jars[3],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT"})).status,401);
  sql(`update public.ghostwriter_deletions set receipt_expires_at=clock_timestamp()-interval '1 second' where account_id='${jars[3].account}';`);
  assert.equal(sql(`select public.ghostwriter_delete_job('${receiptHash}') is null;`),"t");
  const recovered=randomBytes(32).toString("hex"),recoveredHash=createHash("sha256").update(recovered).digest("hex");
  // Same exact conditional recovery update as the owner CLI; synthetic SQL
  // transport only, not a claim of management-account authorization proof.
  sql(`update public.ghostwriter_deletions set receipt_hash='${recoveredHash}',receipt_expires_at=clock_timestamp()+interval '7 days' where account_id='${jars[3].account}' and completed_at is null;`);
  assert.equal((await admin.storage.createBucket("isolated-erasure",{public:false})).error,null);
  for(const name of ["first.txt","second.txt"])assert.equal((await admin.storage.from("isolated-erasure").upload(name,Buffer.from("Synthetic deletion fixture"),{contentType:"text/plain"})).error,null);
  sql(`update storage.objects set owner_id='${jars[3].account}' where bucket_id='isolated-erasure';`);
  jars[3].set("__Host-gw-deletion",recovered);setRestFailure("storage-outage");
  assert.equal((await request(jars[3],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT"})).status,202);
  assert.equal(sql("select count(*) from storage.objects where bucket_id='isolated-erasure';"),"2");
  assert.equal(sql(`select count(*) from auth.users where id='${jars[3].account}';`),"1");
  setRestFailure("storage-lost-response");clearAbuse();
  assert.equal((await request(jars[3],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT"})).status,202);
  assert.equal(sql("select count(*) from storage.objects where bucket_id='isolated-erasure';"),"1");
  setRestFailure(null);setAuthUnavailable(true);clearAbuse();
  assert.equal((await request(jars[3],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT"})).status,202);
  assert.equal(sql("select count(*) from storage.objects where bucket_id='isolated-erasure';"),"0");
  setAuthUnavailable(false);clearAbuse();
  assert.equal((await request(jars[3],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT"})).status,200);
  jars[3].set("__Host-gw-deletion",recovered);clearAbuse();
  assert.equal((await request(jars[3],"/api/ghostwriter/account/delete",{confirmation:"DELETE MY ACCOUNT"})).status,200);
  assert.equal(sql("select count(*) from public.ghostwriter_portfolio_entitlements;"),"4");
  evidence.push({test:"deletion-recent-auth-mass-assignment-lost-expired-receipt-partial-Auth-recovery-idempotence",status:"PASS",scope:"real route/Auth plus isolated owner recovery SQL; no hosted operator transport"});
  for(const name of ["first.txt","second.txt"])assert.ok((await admin.storage.from("isolated-erasure").download(name)).error);
  evidence.push({test:"real-Storage-outage-lost-delete-response-resume-and-blob-erasure",status:"PASS",scope:"Pinned local Supabase Storage API/file backend; no hosted data"});
  // Synthetic encrypted export/restore; no hosted data, no public dump or key.
  const start=Date.now(),dump=beforeDeletionDump;
  const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv),encrypted=Buffer.concat([cipher.update(dump),cipher.final()]),tag=cipher.getAuthTag();
  writeFileSync(evidenceDir+"/synthetic-backup.enc",Buffer.concat([iv,tag,encrypted]),{mode:0o600});
  const decipher=createDecipheriv("aes-256-gcm",key,iv);decipher.setAuthTag(tag);const plain=Buffer.concat([decipher.update(encrypted),decipher.final()]);assert.deepEqual(plain,dump);
  sql("create database isolated_restore;");
  execFileSync("docker",["exec",pg,"psql","-U","postgres","-d","isolated_restore","-c","drop schema public;"],{stdio:"pipe"});
  execFileSync("docker",["exec","-i",pg,"psql","-U","postgres","-d","isolated_restore","-v","ON_ERROR_STOP=1"],{input:plain,stdio:["pipe","pipe","pipe"],maxBuffer:16*1024*1024});
  key.fill(0);plain.fill(0);dump.fill(0);
  const restoredSql=statement=>execFileSync("docker",["exec",pg,"psql","-U","postgres","-d","isolated_restore","-Atqc",statement],{encoding:"utf8"}).trim();
  // Negative control: a stale backup alone really does resurrect authorization.
  assert.equal(restoredSql(`select public.ghostwriter_ai_session_active('${jars[2].account}','${jars[2].session}');`),"t");
  restoredSql("update public.ghostwriter_ai_control set paused=true,valid_until=clock_timestamp()-interval '1 second';");
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  for(const table of ["ghostwriter_deletions","ghostwriter_ai_operations","ghostwriter_beta_entitlements","ghostwriter_portfolio_entitlements","ghostwriter_revoked_sessions"]){
   const current=sql(`select coalesce(jsonb_agg(t),'[]'::jsonb) from public.${table} t;`);
   // Reapplying already-accounted, already-dispatched historical rows verbatim
   // is a superuser-only recovery replay, not new application traffic; the
   // combined-cap trigger's insert/identity guards (202609160001) exist to
   // stop the app from fabricating pre-settled rows, not to block trusted
   // out-of-band reconciliation of facts the live database already recorded.
   const guarded=table==="ghostwriter_ai_operations";
   restoredSql(`begin; ${guarded?`alter table public.${table} disable trigger ghostwriter_00_combined_ai_cap;`:""} truncate public.${table}; insert into public.${table} select * from jsonb_populate_recordset(null::public.${table},${quote(current)}::jsonb); ${guarded?`alter table public.${table} enable trigger ghostwriter_00_combined_ai_cap;`:""} commit;`);
  }
  restoredSql("delete from auth.users where id in(select account_id from public.ghostwriter_deletions); update public.ghostwriter_ai_operations set result_json=null where account_id in(select account_id from public.ghostwriter_deletions);");
  assert.equal(restoredSql("select count(*) from public.ghostwriter_ai_operations where dispatched_at is not null;"),sql("select count(*) from public.ghostwriter_ai_operations where dispatched_at is not null;"));
  assert.equal(restoredSql("select has_table_privilege('authenticated','public.ghostwriter_ai_operations','select');"),"f");
  assert.equal(restoredSql(`select public.ghostwriter_ai_session_active('${jars[2].account}','${jars[2].session}');`),"f");
  // Restored application traffic remains disconnected: only SQL is exposed,
  // and pause is applied independently before any test of restored admission.
  restoredSql("update public.ghostwriter_ai_control set paused=true,valid_until=clock_timestamp()-interval '1 second';");
  assert.equal(restoredSql("select public.ghostwriter_free_control_valid();"),"f");
  // A stale dump predates retirement and purged totals. Never use it as the
  // authority for reopening a finite release, even after other rows reconcile.
  assert.equal(restoredSql("select retired_at is null and purged_starts=0 from public.ghostwriter_lifecycle;"),"t");
  const lifecycle=JSON.parse(sql("select row_to_json(t) from public.ghostwriter_lifecycle t;"));
  const retiredAt=new Date().toISOString();
  restoredSql(`update public.ghostwriter_lifecycle set retire_at=least(retire_at,${quote(retiredAt)}::timestamptz),retired_at=${quote(retiredAt)}::timestamptz,purged_starts=250,purged_micro_usd=187500,last_maintenance_at=null where singleton;`);
  assert.equal(restoredSql("select public.ghostwriter_release_active();"),"f");
  assert.equal(restoredSql("select purged_starts||':'||purged_micro_usd from public.ghostwriter_lifecycle;"),"250:187500");
  // These newer synthetic recovery facts are deliberately stricter than the
  // original lifecycle. Accounting and retirement cannot regress thereafter.
  assert.equal(lifecycle.retired_at,null);
  assert.throws(()=>restoredSql("update public.ghostwriter_lifecycle set retired_at=null,purged_starts=0;"));
  evidence.push({test:'stale-lifecycle-retirement-and-purged-totals-recovery',status:'PASS',scope:'isolated synthetic newer recovery record; missing trusted history remains paused'});
  evidence.push({test:"encrypted-synthetic-stale-export-restore",status:"PASS",elapsedMs:Date.now()-start,checks:["Auth/public schemas, functions, RLS and grants restored","negative control detects resurrected session in stale backup","newer trusted operation/deletion/revocation records reapplied before release","private ledger read denied","deleted session denied","dispatch counts equal latest trusted ledger","restore independently paused, no app or provider connection"],limitations:["Same-host recovery, key intentionally destroyed after rehearsal","Synthetic newer source remained available: missing-authoritative-history branch must remain paused","No Storage blob or external configuration backup; direct synthetic Auth deletion is not a production restore procedure"]});
  browser=await chromium.launch();const context=await browser.newContext({userAgent:ua,viewport:{width:1440,height:1000},extraHTTPHeaders:{"x-forwarded-for":jars[0].ip}});
  await context.addCookies([...jars[0]].map(([name,value])=>({name,value,url:name.startsWith("__Host-")?origin.replace("http:","https:"):origin,secure:name.startsWith("__Host-"),httpOnly:name.startsWith("__Host-")})));
  const page=await context.newPage();clearAbuse();await page.goto(origin+"/second-voice");await page.getByRole("button",{name:"Authors",exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.gw-author-portrait')).every(image=>image.complete&&image.naturalWidth>0));
  const editor=page.locator("textarea").first();await editor.fill("Synthetic draft preserved across a temporary session outage.");
  // BetaSignIn only re-checks session status on mount or on its own
  // "ghostwriter-session-retry"/"ghostwriter-allowance-changed" custom
  // events (no focus listener exists), and the live status div carries
  // data-session-status, not data-session-state (see SecondVoiceExperience.tsx).
  setAuthUnavailable(true);await page.evaluate(()=>window.dispatchEvent(new Event("ghostwriter-allowance-changed")));
  await page.locator('[data-session-status="unavailable"]').waitFor();
  setAuthUnavailable(false);clearAbuse();await page.evaluate(()=>window.dispatchEvent(new Event("ghostwriter-allowance-changed")));
  await editor.waitFor();assert.equal(await editor.inputValue(),"Synthetic draft preserved across a temporary session outage.");
  evidence.push({test:"real-Auth-503-browser-draft-preservation",status:"PASS"});
  await page.getByRole("button",{name:"Outcomes",exact:true}).click();
  for(const name of ["Improve clarity","Get a reply","Sound confident","Be concise","Be persuasive"]){await page.getByRole("button",{name:new RegExp(name)}).click();}
  await page.getByRole("button",{name:"Authors",exact:true}).click();
  // Author buttons are aria-label="Choose <full name>" (AuthorOrbital.tsx), not "<name> portrait".
  for(const name of ["Tolkien","Stephen King","Tolstoy","Hemingway"]){await page.getByRole("button",{name:new RegExp("Choose.*"+name)}).click();}
  evidence.push({test:"all-author-and-outcome-selections",status:"PASS"});
  for(const width of [1440,768,390]){
   await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   await page.screenshot({path:evidenceDir+"/production-"+width+".png",fullPage:true});
  }
  evidence.push({test:"production-browser-desktop-tablet-mobile-scroll",status:"PASS"});
 } catch(error) {
  console.error(JSON.stringify({failure:String(error),calls,active,mode,workers:processes.map(p=>p.summary())}));
  throw error;
 } finally {
  setRestFailure(null);setAuthUnavailable(false);hold=false;releases.splice(0).forEach(r=>r());await browser?.close();
  for(const p of processes){if(p.exitCode===null)p.kill("SIGTERM");}
  provider.closeAllConnections();await new Promise(r=>provider.close(r));
  writeFileSync(evidenceDir+"/production-gate.json",JSON.stringify({at:new Date().toISOString(),evidence,externalInference:false},null,2),{mode:0o600});
  console.log(JSON.stringify({scope:"isolated production gate",evidence}));
 }
}
