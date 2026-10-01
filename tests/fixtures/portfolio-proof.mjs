import assert from "node:assert/strict";
import { seedCombinedHistory } from "./combined-history-seed.mjs";
export async function runPortfolioProof({sql,startWorker,workerPort,localFetch,name}){
 const id=n=>"00000000-0000-0000-0000-"+String(n).padStart(12,"0");
 sql("truncate public.ghostwriter_beta_entitlements,public.ghostwriter_portfolio_entitlements,public.ghostwriter_ai_operations; update public.ghostwriter_ai_control set release_profile='portfolio-free',paused=false,valid_until='infinity'::timestamptz,free_organization_id='org-isolated',free_project_id='project-isolated',free_verified_at=clock_timestamp(),free_verified_until=now()+interval '1 day',free_evidence_reference='synthetic-plan-fixture',portfolio_global_daily_limit=60; select public.ghostwriter_retention_maintenance();");
 // The shared harness only pre-seeds 25 authenticated visitors; the 26th
 // needs its own auth identity and session here, same as id(27) below, so
 // this proves entitlement enrollment isn't secretly capped at 25.
 sql(`insert into auth.users values('${id(26)}',now(),null,'visitor26@isolated.test');insert into auth.sessions values('${id(26)}','${id(26)}',null);`);
 // More than 25 authenticated visitors must remain enrollable; verified-email identity stays unique.
 for(let n=1;n<=26;n++)assert.equal(sql(`select public.ghostwriter_free_entitle('${id(n)}','${id(n)}');`),"entitled");
 assert.equal(sql("select count(*) from public.ghostwriter_portfolio_entitlements;"),"26");
 sql(`insert into auth.users values('${id(27)}',now(),null,'visitor1@isolated.test');insert into auth.sessions values('${id(27)}','${id(27)}',null);`);
 assert.equal(sql(`select public.ghostwriter_free_entitle('${id(27)}','${id(27)}');`),"trial_already_claimed");

 const children=[0,1].map(()=>startWorker("tests/fixtures/release-gateway-worker.mjs",[name,"portfolio-free"],{execArgv:["--experimental-strip-types"],stdio:["ignore","ignore","inherit","ipc"]}));
 try{
  const ports=await Promise.all(children.map(workerPort));
  const get=async(i,path)=>{const r=await localFetch("http://127.0.0.1:"+ports[i]+path);assert.equal(r.status,200);return r.json();};
  let completed=0;const pending=Array.from({length:25},(_,i)=>get(i%2,"/"+(i+1)).then(r=>{completed++;return r;}));
  let stats=[];for(let n=0;n<600;n++){stats=await Promise.all([get(0,"/stats"),get(1,"/stats")]);if(completed===24&&stats.reduce((t,x)=>t+x.calls,0)===1)break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(completed,24);assert.equal(stats.reduce((n,x)=>n+x.calls,0),1);assert.equal(stats.reduce((n,x)=>n+x.active,0),1);
  await Promise.all([get(0,"/release"),get(1,"/release")]);const results=await Promise.all(pending);const winner=results.findIndex(r=>r.status===200)+1;assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.reason==="global_concurrency_limit").length,24);
  // The same account can perform all three visible rewrites consecutively.
  sql("truncate public.ghostwriter_ai_operations;");const accountProbe=20;for(const n of[accountProbe,accountProbe+25,accountProbe+50])assert.equal((await get(1,"/"+n)).status,200);assert.equal((await get(1,"/"+(accountProbe+75))).reason,"account_day_limit");
  // Global burst fence remains independent.
  sql("truncate public.ghostwriter_ai_operations;");for(const n of[1,2,3,4,5,6])assert.equal((await get(n%2,"/"+n)).status,200);assert.equal((await get(1,"/7")).reason,"global_minute_limit");
  sql("truncate public.ghostwriter_ai_operations;");await get(0,"/disconnect");assert.equal((await get(0,"/101")).status,502);assert.equal(sql("select state||':'||reserved_micro_usd from public.ghostwriter_ai_operations where idempotency_key='gateway-race-000101';"),"uncertain:750");assert.equal((await get(1,"/102")).reason,"service_paused");
  console.log(JSON.stringify({scenario:"portfolio-renewable-auth-concurrency",status:"PASS",authenticatedEntitlements:26,perAccountRolling24h:3,globalMinute:6,lifetimeSelfDestruct:false}));
 }finally{children.forEach(c=>c.kill());}
 // Historical volume cannot permanently disable a user/fleet.
 sql("truncate public.ghostwriter_ai_operations;update public.ghostwriter_ai_control set paused=false;");
 const insert=(count,account,time)=>seedCombinedHistory(sql,`insert into public.ghostwriter_ai_operations(account_id,session_id,idempotency_key,request_fingerprint,profile,principal_kind,state,outcome,pricing_version,reserved_micro_usd,actual_micro_usd,dispatched_at,settled_at) select ${account},${account},'boundary-fixture-'||n,repeat('a',64),'portfolio-free','authenticated','settled','succeeded','estimate',750,38,${time},${time} from generate_series(1,${count})n;`);
 const reserve=()=>JSON.parse(sql(`select public.ghostwriter_free_reserve('${id(1)}','${id(1)}','boundary-new-0001',repeat('b',64),'org-isolated','project-isolated');`));
 insert(250,`'${id(2)}'::uuid`,"now()-interval '2 days'");assert.equal(reserve().kind,"admitted");
 sql("truncate public.ghostwriter_ai_operations;");insert(3,`'${id(1)}'::uuid`,"now()-interval '2 hours'");assert.equal(reserve().reason,"account_day_limit");
 // Anonymous visitor: 3/day and fourth denied before dispatch.
 sql("truncate public.ghostwriter_ai_operations;");const visitor=id(500),limits=JSON.stringify({accounts:25,accountLifetime:10,accountDay:3,accountMinute:3,globalMinute:6,hourBudget:500000,dayBudget:2000000,lifetimeBudget:10000000,operationBudget:10000});
 for(let n=1;n<=3;n++){const key=`anonymous-proof-${String(n).padStart(4,"0")}`,a=JSON.parse(sql(`select public.ghostwriter_anonymous_reserve_bounded('${visitor}','${key}',repeat('c',64),'org-isolated','project-isolated','${limits}'::jsonb,60);`));assert.equal(a.kind,"admitted");assert.equal(sql(`select public.ghostwriter_ai_mark_dispatched('${a.operation_id}','${visitor}');`),"t");assert.equal(sql(`select public.ghostwriter_ai_settle_success('${a.operation_id}','${visitor}',38,'anonymous-${n}','{\"rewrite\":\"synthetic\"}'::jsonb);`),"t");}
 const fourth=JSON.parse(sql(`select public.ghostwriter_anonymous_reserve_bounded('${visitor}','anonymous-proof-0004',repeat('d',64),'org-isolated','project-isolated','${limits}'::jsonb,60);`));assert.equal(fourth.reason,"anonymous_day_limit");
 console.log(JSON.stringify({scenario:"anonymous-recruiter-three-per-day",status:"PASS"}));
}
