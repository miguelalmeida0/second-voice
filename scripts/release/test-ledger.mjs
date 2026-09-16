import {execFileSync,spawnSync,fork} from "node:child_process";
import {readFileSync,readdirSync} from "node:fs";
import assert from "node:assert/strict";
const name="ghostwriter-release-"+process.pid;
const workers=new Set();
const startWorker=(file,args,options)=>{const child=fork(file,args,options);workers.add(child);child.once("exit",()=>workers.delete(child));return child;};
function cleanup(){for(const child of workers)child.kill();spawnSync("docker",["stop",name],{stdio:"ignore",timeout:30000});}
for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>{cleanup();process.exit(2);});
const image="postgres:16@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94";
const run=(args)=>execFileSync("docker",args,{encoding:"utf8",timeout:120000,stdio:["ignore","pipe","pipe"]}).trim();
function workerPort(child){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(new Error("Fixture worker startup deadline")),30000);
  const onExit=code=>finish(new Error("Fixture worker exited "+code));
  const onError=error=>finish(error);
  const onMessage=port=>finish(null,port);
  function finish(error,port){clearTimeout(timer);child.off("exit",onExit);child.off("error",onError);child.off("message",onMessage);if(error)reject(error);else resolve(port);}
  child.once("message",onMessage);child.once("error",onError);child.once("exit",onExit);
 });
}
const localFetch=url=>fetch(url,{signal:AbortSignal.timeout(120000)});
function sql(statement){
 const r=spawnSync("docker",["exec","-i",name,"psql","-U","postgres","-Atq","-v","ON_ERROR_STOP=1"],{input:statement,encoding:"utf8",timeout:120000});
 if(r.status!==0) throw new Error("SQL failed: "+r.stderr.slice(0,1500));
 return r.stdout.trim();
}
let source;
const evidence=[];
try{
 run(["run","--rm","-d","--name",name,"--network","none","-e","POSTGRES_PASSWORD=isolated-test-only",image]);
 let ready=false;
 for(let i=0;i<40;i++){
  if(spawnSync("docker",["exec",name,"pg_isready","-h","127.0.0.1","-U","postgres"]).status===0){ready=true;break;}
  await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ready,"PostgreSQL readiness");
 sql("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz,banned_until timestamptz,email text); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz not null default now());");
 for(const f of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort()){
  sql(readFileSync("supabase/migrations/"+f,"utf8"));
  if(f==="202609070001_ghostwriter_ai_financial_boundary.sql"){
   sql("insert into public.ghostwriter_ai_operations(account_id,idempotency_key,request_fingerprint,state,pricing_version,reserved_micro_usd) values('00000000-0000-0000-0000-000000000099','historical-upgrade-0001',repeat('a',64),'dispatched','historical-policy',750);");
  }
 }
 assert.equal(sql("select state||':'||reserved_micro_usd from public.ghostwriter_ai_operations where idempotency_key='historical-upgrade-0001';"),"dispatched:750");
 sql("select public.ghostwriter_retention_maintenance();");
 evidence.push({scenario:"forward-migrations-preserve-existing-liability",status:"PASS"});
 sql("truncate public.ghostwriter_ai_operations;");
 sql("insert into auth.users select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now(),null,'visitor'||n||'@isolated.test' from generate_series(1,25)n; insert into auth.sessions(id,user_id,not_after) select id,id,null from auth.users; insert into public.ghostwriter_beta_entitlements(account_id,approved_slot) select id,row_number()over() from auth.users; update public.ghostwriter_ai_control set paused=false,valid_until=now()+interval '1 hour';");
 if(process.argv.includes("--portfolio")){
  const {runPortfolioProof}=await import("../../tests/fixtures/portfolio-proof.mjs");
  await runPortfolioProof({sql,startWorker,workerPort,localFetch,name});
 }else{
 source=sql("select pg_get_functiondef('public.ghostwriter_ai_reserve(uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint)'::regprocedure);");
 // Test-only SQL clones. Production migration never contains these relaxed limits.
 let fixture=source.replaceAll("ghostwriter_ai_reserve(","fixture_reserve(").replace("p_reservation_micro_usd <> 750","p_reservation_micro_usd not between 1 and 10000").replace("p_account_concurrency_limit <> 1","p_account_concurrency_limit not between 1 and 1000").replace("p_global_concurrency_limit not between 1 and 2","p_global_concurrency_limit not between 1 and 1000");
 fixture=fixture.replaceAll("v_count >= p_account_lifetime_limit","v_count >= 1000").replaceAll("v_count >= p_account_day_limit","v_count >= 1000").replaceAll("v_count >= p_account_minute_limit","v_count >= 1000").replaceAll("v_count >= p_global_minute_limit","v_count >= 1000");
 sql(fixture);
 // This fixture intentionally fires 100 concurrent SQL admissions. Keep the
 // production 3s timeout untouched; only the disposable cloned function gets
 // extra wait budget so Docker/psql process startup cannot masquerade as a
 // database-admission failure while requests serialize on the global lock.
 sql("alter function public.fixture_reserve(uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint) set statement_timeout='30s';");
 async function storm(fn,accountLimit,globalLimit,reservation,budget,accountPool=25,attempts=100){
  sql("truncate public.ghostwriter_ai_operations;");
  const children=[0,1].map(()=>startWorker("tests/fixtures/release-ledger-worker.mjs",[name,fn,String(accountLimit),String(globalLimit),String(reservation),String(budget),String(accountPool)],{stdio:["ignore","ignore","inherit","ipc"]}));
  try{
   const ports=await Promise.all(children.map(workerPort));
   const results=await Promise.all(Array.from({length:attempts},async(_,i)=>{const r=await localFetch("http://127.0.0.1:"+ports[i%2]+"/"+(i+1));assert.equal(r.status,200);return r.json();}));
   const admitted=results.filter(r=>r.kind==="admitted").length;
   const reasons=Object.fromEntries([...new Set(results.map(r=>r.reason).filter(Boolean))].map(reason=>[reason,results.filter(r=>r.reason===reason).length]));
   const liability=Number(sql("select coalesce(sum(reserved_micro_usd),0) from public.ghostwriter_ai_operations;"));
   return {attempted:attempts,admitted,liability,reasons,processes:2,mockDispatches:0,scope:"HTTP SQL admission harness; not application HTTP/auth or provider execution"};
  }finally{children.forEach(c=>c.kill());}
 }
 const financial=await storm("fixture_reserve",1000,1000,10000,20000);
 assert.equal(financial.admitted,2);assert.equal(financial.liability,20000);assert.deepEqual(financial.reasons,{hour_budget:98});
 evidence.push({scenario:"isolated-financial-race",...financial});
 // Remove all financial admission comparisons: the same assertion MUST fail.
 sql(fixture.replaceAll("fixture_reserve(","fixture_mutated(").replaceAll(/v_spend \+ p_reservation_micro_usd > p_(hour_budget_micro_usd|day_budget_micro_usd|beta_lifetime_budget_micro_usd)/g,"false"));
 sql("alter function public.fixture_mutated(uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint) set statement_timeout='30s';");
 // Test a missing financial fence below the independent 60/24h combined cap.
 const mutation=await storm("fixture_mutated",1000,1000,10000,20000,25,20);
 assert.ok(mutation.admitted>2,"negative control did not detect absent financial enforcement");
 evidence.push({scenario:"financial-mutation-detected",...mutation});
 const concurrency=await storm("fixture_reserve",1000,2,750,500000);
 assert.equal(concurrency.admitted,2);assert.deepEqual(concurrency.reasons,{global_concurrency_limit:98});
 evidence.push({scenario:"independent-global-concurrency",...concurrency});
 sql(fixture.replaceAll("fixture_reserve(","fixture_no_concurrency(").replaceAll("v_count >= p_global_concurrency_limit","false"));
 sql("alter function public.fixture_no_concurrency(uuid,uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint) set statement_timeout='30s';");
 // Keep this mutation test below the independent 60/24h combined cap. The
 // assertion only needs to prove that removing the concurrency fence admits
 // more than two; asking for 100 would correctly trip the separate global cap.
 const concurrentMutation=await storm("fixture_no_concurrency",1000,2,750,500000,25,20);
 assert.ok(concurrentMutation.admitted>2);evidence.push({scenario:"concurrency-mutation-detected",...concurrentMutation});
 const perAccount=await storm("fixture_reserve",1,1000,750,500000,1);
 assert.equal(perAccount.admitted,1);assert.deepEqual(perAccount.reasons,{account_concurrency_limit:99});
 evidence.push({scenario:"independent-account-concurrency",...perAccount});
 // Run the actual gateway, provider serializer/validator and SQL transitions in
 // two processes. Only authentication/finalization and network transport are fixtures.
 sql("truncate public.ghostwriter_ai_operations;");
 const gatewayWorkers=[0,1].map(()=>startWorker("tests/fixtures/release-gateway-worker.mjs",[name],{execArgv:["--experimental-strip-types"],stdio:["ignore","ignore","inherit","ipc"]}));
 try{
  const ports=await Promise.all(gatewayWorkers.map(workerPort));
  const get=(port,path)=>localFetch("http://127.0.0.1:"+port+path).then(async r=>{assert.equal(r.status,200);return r.json();});
  let completed=0;
  const requests=Array.from({length:100},(_,i)=>get(ports[i%2],"/"+(i+1)).then(r=>{completed++;return r;}));
  // Attach rejection handling while the responses are intentionally held.
  requests.forEach(p=>p.catch(()=>undefined));
  let stats;
  for(let attempt=0;attempt<600;attempt++){
   stats=await Promise.all(ports.map(p=>get(p,"/stats")));
   if(completed===98 && stats.reduce((n,s)=>n+s.calls,0)===2) break;
   await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(completed,98,"Only the two admitted requests may remain held");
  assert.equal(stats.reduce((n,s)=>n+s.calls,0),2);
  assert.equal(stats.reduce((n,s)=>n+s.active,0),2);
  assert.equal(sql("select count(*)||':'||sum(reserved_micro_usd) from public.ghostwriter_ai_operations where state='dispatched';"),"2:20000");
  await Promise.all(ports.map(p=>get(p,"/release")));
  const results=await Promise.all(requests);
  assert.equal(results.filter(r=>r.status===200).length,2);
  assert.equal(results.filter(r=>r.reason==="hour_budget").length,98);
  assert.equal(sql("select sum(actual_micro_usd) from public.ghostwriter_ai_operations;"),"76");
  // Safe settlement frees only unused maximum liability. One additional 10,000
  // reservation fits beside 76 actual, and settles to another 38 micro-USD.
  const reused=await get(ports[0],"/101");assert.equal(reused.status,200);
  assert.equal(sql("select sum(actual_micro_usd) from public.ghostwriter_ai_operations;"),"114");
  const replay=await get(ports[1],"/101");assert.equal(replay.status,200);
  stats=await Promise.all(ports.map(p=>get(p,"/stats")));
  assert.equal(stats.reduce((n,s)=>n+s.calls,0),3);
  evidence.push({scenario:"two-process-gateway-dispatch-settlement-replay",attempted:102,admitted:3,mockDispatches:3,initialHeldLiability:20000,settledMicroUsd:114,maximumObservedConcurrency:2,reasons:{hour_budget:98},states:{settled:3},scope:"Actual gateway/provider serializer/validator + PostgreSQL; synthetic auth/finalizer and blocked outbound fetch, not Next HTTP or browser auth"});
 }finally{gatewayWorkers.forEach(c=>c.kill());}
 // Old unresolved reserved work remains an hourly liability even after two days.
 await storm("fixture_reserve",1000,1000,10000,20000);
 sql("update public.ghostwriter_ai_operations set created_at=now()-interval '2 days';");
 const held=JSON.parse(sql("select public.fixture_reserve('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000025','aged-hold-check-0001',repeat('a',64),'groq-openai-gpt-oss-20b-2026-09-07',10000,25,10,5,3,1000,10,1000,20000,20000,20000);"));
 assert.equal(held.reason,"hour_budget");
 evidence.push({scenario:"old-unresolved-holds-retained",status:"PASS"});
 sql("truncate public.ghostwriter_ai_operations;");
 const account="00000000-0000-0000-0000-000000000001";
 const reserve=(key,amount="750")=>`select public.ghostwriter_ai_reserve('${account}','${account}','${key}',repeat('b',64),'groq-openai-gpt-oss-20b-2026-09-07',${amount},25,10,5,3,1,10,2,500000,2000000,10000000)`;
 assert.equal(JSON.parse(sql(reserve("nullable-input-0001","null"))).reason,"invalid_request");
 const admitted=JSON.parse(sql(reserve("valid-operation-0001")));
 assert.equal(admitted.kind,"admitted");
 const id=admitted.operation_id;
 assert.equal(sql(`select public.ghostwriter_ai_mark_dispatched('${id}','${account}');`),"t");
 assert.equal(sql(`select public.ghostwriter_ai_mark_dispatched('${id}','${account}');`),"f");
 assert.equal(sql(`select public.ghostwriter_ai_fail_before_dispatch('${id}','${account}','unsafe');`),"f");
 assert.equal(sql(`select public.ghostwriter_ai_settle_success('${id}','${account}',null,null,'{}');`),"f");
 assert.equal(sql(`select public.ghostwriter_ai_settle_success('${id}','${account}',100,null,'{}');`),"t");
 assert.equal(sql(`select public.ghostwriter_ai_settle_success('${id}','${account}',100,null,'{}');`),"f");
 assert.equal(sql("select sum(actual_micro_usd) from public.ghostwriter_ai_operations;"),"100");
 const subsequent=JSON.parse(sql(reserve("subsequent-work-0001")));
 assert.equal(subsequent.kind,"admitted");
 sql("select public.ghostwriter_ai_pause('test_pause_before_claim');");
 assert.equal(sql(`select public.ghostwriter_ai_mark_dispatched('${subsequent.operation_id}','${account}');`),"f");
 sql("update public.ghostwriter_ai_control set paused=false;");

 sql(`select public.ghostwriter_ai_revoke_session('${account}','${account}');`);
 assert.equal(JSON.parse(sql(reserve("revoked-session-0001"))).reason,"session_revoked");
 assert.equal(sql(`select public.ghostwriter_ai_mark_dispatched('${subsequent.operation_id}','${account}');`),"f");

 sql("select public.ghostwriter_ai_pause('integration_shutdown');");
 const paused=sql("select paused from public.ghostwriter_ai_control;");assert.equal(paused,"t");
 for(const role of ["anon","authenticated","service_role"])
  for(const table of ["ghostwriter_ai_operations","ghostwriter_beta_entitlements","ghostwriter_ai_control"])
   assert.equal(sql(`select has_table_privilege('${role}','public.${table}','INSERT,UPDATE,DELETE,TRUNCATE');`),"f");
 assert.equal(sql("select has_function_privilege('service_role','public.ghostwriter_ai_reconcile_uncertain(uuid,bigint,text,text)','execute');"),"f");
 evidence.push({scenario:"state-transitions-revocation-null-privileges",status:"PASS"});
 sql(readFileSync("tests/fixtures/release-failure-matrix.sql","utf8"));
 evidence.push({scenario:"recovery-fencing-monotonic-observed-cost-expiry-canary-history",status:"PASS",scope:"Real production SQL functions; operator settlement and expiry simulated in isolated database"});
 console.log(JSON.stringify({status:"PASS",evidence,limitations:["Auth schema is an isolated SQL fixture, not Supabase Auth browser integration","No real provider or application HTTP handler exercised","Docker network disabled"]},null,2));
 }
 const {retentionProof}=await import("../../tests/fixtures/retention-proof.mjs");retentionProof(sql);
}finally{cleanup();}
