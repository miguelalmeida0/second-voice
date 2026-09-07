import assert from "node:assert/strict";
export async function runPortfolioProof({sql,startWorker,workerPort,localFetch,name}){
 const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
 sql("truncate public.ghostwriter_beta_entitlements; update public.ghostwriter_ai_control set release_profile='portfolio-free',free_organization_id='org-isolated',free_project_id='project-isolated',free_verified_until=now()+interval '1 day',free_evidence_reference='synthetic-plan-fixture';");
 for(let n=1;n<=25;n++)assert.equal(sql(`select public.ghostwriter_free_entitle('${id(n)}','${id(n)}');`),"entitled");
 assert.equal(sql("select count(*)||':'||count(*) filter(where paid_approved) from public.ghostwriter_beta_entitlements;"),"25:0");
 sql(`insert into auth.users values('${id(26)}',now(),null,'new@isolated.test');insert into auth.sessions values('${id(26)}','${id(26)}',null);`);
 assert.equal(sql(`select public.ghostwriter_free_entitle('${id(26)}','${id(26)}');`),"trial_capacity");
 sql(`update auth.users set email='visitor1@isolated.test' where id='${id(26)}';`);
 assert.equal(sql(`select public.ghostwriter_free_entitle('${id(26)}','${id(26)}');`),"trial_already_claimed");
 const children=[0,1].map(()=>startWorker("tests/fixtures/release-gateway-worker.mjs",[name,"portfolio-free"],{execArgv:["--experimental-strip-types"],stdio:["ignore","ignore","inherit","ipc"]}));
 try{
  const ports=await Promise.all(children.map(workerPort));
  const get=async(i,path)=>{const r=await localFetch("http://127.0.0.1:"+ports[i]+path);assert.equal(r.status,200);return r.json();};
  let completed=0;
  const pending=Array.from({length:25},(_,i)=>get(i%2,"/"+(i+1)).then(r=>{completed++;return r;}));
  for(let n=0;n<600&&completed<24;n++)await new Promise(r=>setTimeout(r,100));
  assert.equal(completed,24);
  const stats=await Promise.all([get(0,"/stats"),get(1,"/stats")]);
  assert.equal(stats.reduce((n,s)=>n+s.calls,0),1);assert.equal(stats.reduce((n,s)=>n+s.active,0),1);
  assert.equal(sql("select count(*) from public.ghostwriter_ai_operations where dispatched_at is not null;"),"1");
  await Promise.all([get(0,"/release"),get(1,"/release")]);
  const results=await Promise.all(pending),winner=results.findIndex(r=>r.status===200)+1;
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert.equal(results.filter(r=>r.reason==="global_concurrency_limit").length,24);
  assert.equal((await get(1,"/"+winner)).status,200);
  const second=winner===1?2:1;assert.equal((await get(0,"/"+second)).status,200);
  const third=[1,2,3].find(n=>n!==winner&&n!==second);
  assert.equal((await get(1,"/"+third)).reason,"global_minute_limit");
  // Account minute blocks independently from the global gate (same account,
  // different key). No success-only counting or client-side quota authority.
  assert.equal((await get(1,"/"+(winner+25))).reason,"account_minute_limit");
  sql("update public.ghostwriter_ai_operations set dispatched_at=now()-interval '2 minutes';");
  await get(0,"/disconnect");
  assert.equal((await get(0,"/101")).status,502);
  assert.equal(sql("select count(*) from public.ghostwriter_ai_operations where dispatched_at is not null;"),"3");
  assert.equal(sql("select state||':'||reserved_micro_usd from public.ghostwriter_ai_operations where idempotency_key='gateway-race-000101';"),"uncertain:750");
  assert.equal((await get(1,"/102")).reason,"service_paused");
  assert.equal((await get(1,"/101")).status,409);
  await get(1,"/database-outage");assert.equal((await get(1,"/103")).status,503);
  const final=await Promise.all([get(0,"/stats"),get(1,"/stats")]);assert.equal(final.reduce((n,s)=>n+s.calls,0),3);
  console.log(JSON.stringify({scenario:"portfolio-two-process-gateway",status:"PASS",attempted:33,recipients:25,mockDispatches:3,maximumConcurrency:1,states:{settled:2,uncertain:1},unresolvedEstimateMicroUsd:750,proof:["trial-capacity","same-email-recreation-denied","paid-approval-not-granted","global-concurrency","account-minute","global-minute","idempotent-replay","disconnect-retains-start","pause","datastore-outage"],scope:"Two application-gateway processes and real production SQL; synthetic identity/finalizer, real provider serializer with all outbound fetch replaced"}));
 }finally{children.forEach(c=>c.kill());}
 // Boundary fixtures age dispatch timestamps using operator-only SQL, never a
 // production clock override. Old financial records remain in normal operation.
 sql("truncate public.ghostwriter_ai_operations;update public.ghostwriter_ai_control set paused=false;");
 const insert=(count,account,time)=>sql(`insert into public.ghostwriter_ai_operations(account_id,session_id,idempotency_key,request_fingerprint,profile,state,outcome,pricing_version,reserved_micro_usd,actual_micro_usd,dispatched_at,settled_at) select ${account},${account},'boundary-fixture-'||n,repeat('a',64),'portfolio-free','settled','succeeded','estimate',750,38,${time},${time} from generate_series(1,${count})n;`);
 const reserve=()=>JSON.parse(sql(`select public.ghostwriter_free_reserve('${id(1)}','${id(1)}','boundary-new-0001',repeat('b',64),'org-isolated','project-isolated');`));
 insert(10,`'${id(1)}'::uuid`,"now()-interval '2 days'");assert.equal(reserve().reason,"account_lifetime_limit");
 sql("truncate public.ghostwriter_ai_operations;");insert(3,`'${id(1)}'::uuid`,"now()-interval '2 hours'");assert.equal(reserve().reason,"account_day_limit");
 sql("truncate public.ghostwriter_ai_operations;");insert(25,`'${id(2)}'::uuid`,"now()-interval '2 hours'");assert.equal(reserve().reason,"global_day_limit");
 sql("truncate public.ghostwriter_ai_operations;");insert(250,`'${id(2)}'::uuid`,"now()-interval '2 days'");assert.equal(reserve().reason,"global_lifetime_limit");
 console.log(JSON.stringify({scenario:"portfolio-window-lifetime-boundaries",status:"PASS",accountLifetime:10,accountDay:3,globalDay:25,globalLifetime:250,scope:"Production SQL with synthetic historical rows; lifetime remains consumed after daily rollover"}));
}
