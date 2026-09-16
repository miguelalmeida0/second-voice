/**
 * Destructive tests ONLY inside a newly created, network-isolated PostgreSQL
 * container. No connection URL, Vercel credential, Supabase secret or live AI call.
 * Run from the repo: node scripts/release/test-combined-ai-cap.mjs
 */
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../../", import.meta.url)));
const image = "postgres:16@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94";
const name = `secondvoice-cap-test-${randomUUID()}`;
const migrationNames = ["202609160001_ghostwriter_combined_global_cap.sql","202609160002_secondvoice_provider_failure_accounting.sql"];
const latestMigrationName = migrationNames.at(-1);
const results = [];
let started = false;
const limits = JSON.stringify({accounts:25,accountLifetime:10,accountDay:3,accountMinute:3,globalMinute:6,hourBudget:500000,dayBudget:2000000,lifetimeBudget:10000000,operationBudget:10000});
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const account = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function docker(args, input, allowFailure = false) {
  const result = spawnSync("docker",args,{input,encoding:"utf8",timeout:120_000,maxBuffer:4*1024*1024});
  if (result.error) throw new Error(`Docker unavailable: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) throw new Error(result.stderr || result.stdout || `Docker exited ${result.status}`);
  return result;
}
const sqlArgs = ["exec","-i",name,"psql","-U","postgres","-XAtq","-v","ON_ERROR_STOP=1"];
const sql = statement => docker(sqlArgs,statement).stdout.trim();
const lastJson = text => JSON.parse(text.trim().split("\n").filter(Boolean).at(-1));
const query = statement => lastJson(sql(statement));
function sqlAsync(statement) {
  return new Promise((resolve,reject) => {
    const child=spawn("docker",sqlArgs,{stdio:["pipe","pipe","pipe"]});
    let out="",error="";
    const timer=setTimeout(()=>child.kill("SIGKILL"),120_000);
    child.stdout.on("data",chunk=>{out+=chunk;});
    child.stderr.on("data",chunk=>{error+=chunk;});
    child.on("error",e=>{clearTimeout(timer);reject(e);});
    child.on("close",code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(new Error(error||`psql exit ${code}`));});
    child.stdin.end(statement);
  });
}
function cleanup() {
  if(started) spawnSync("docker",["rm","-f",name],{stdio:"ignore",timeout:30_000});
}
for(const signal of ["SIGTERM","SIGINT"]) process.once(signal,()=>{cleanup();process.exit(2);});
async function check(label,run) {
  await run(); results.push(label); console.log(`PASS ${label}`);
}
function reset() {
  sql(`truncate public.ghostwriter_ai_operations;
    delete from public.ghostwriter_deletions;
    delete from public.ghostwriter_revoked_sessions;
    update public.ghostwriter_portfolio_entitlements set revoked_at=null;
    update public.ghostwriter_beta_entitlements set revoked_at=null;
    update public.ghostwriter_ai_control set paused=false,valid_until='infinity',
      portfolio_global_daily_limit=60,combined_ai_limit_24h=60;
    select public.ghostwriter_retention_maintenance();`);
}
function seed(count, age = "2 hours", profile = "portfolio-free") {
  assert.match(age,/^[0-9]+ (minutes|hours|days)$/);
  assert.ok(["portfolio-free","paid"].includes(profile));
  // Historical state fixture only: disable guards in this disposable container.
  sql(`alter table public.ghostwriter_ai_operations disable trigger ghostwriter_00_combined_ai_cap;
    alter table public.ghostwriter_ai_operations disable trigger ghostwriter_profile_admit;
    insert into public.ghostwriter_ai_operations
      (account_id,idempotency_key,request_fingerprint,state,outcome,pricing_version,
       reserved_micro_usd,actual_micro_usd,profile,principal_kind,dispatched_at,
       global_dispatch_authorized_at,settled_at,result_json)
    select gen_random_uuid(),'historical-seed-'||gen_random_uuid(),repeat('a',64),'settled','succeeded',
       'groq-openai-gpt-oss-20b-2026-09-07',750,0,${quote(profile)},
       case when n%2=0 then 'anonymous' else 'authenticated' end,
       clock_timestamp()-interval '${age}',clock_timestamp()-interval '${age}',
       clock_timestamp()-interval '${age}','{}'::jsonb
    from generate_series(1,${Number(count)}) n;
    alter table public.ghostwriter_ai_operations enable trigger ghostwriter_profile_admit;
    alter table public.ghostwriter_ai_operations enable trigger ghostwriter_00_combined_ai_cap;`);
}
const reserve = (n,kind,key) => kind === "authenticated"
  ? `public.ghostwriter_free_reserve_bounded('${account(n)}','${account(n)}',${quote(key)},repeat('b',64),'Test Org','Test Project','${limits}'::jsonb)`
  : `public.ghostwriter_anonymous_reserve_bounded('${account(n)}',${quote(key)},repeat('b',64),'Test Org','Test Project','${limits}'::jsonb,60)`;
const runReserve = (n,kind,key) => query(`set role service_role;select ${reserve(n,kind,key)};`);
const health = () => query("set role service_role;select public.ghostwriter_combined_ai_health();");
const attempt = (n,kind,key) => `set role service_role;select public.fixture_cap_attempt('${account(n)}',${quote(kind)},${quote(key)});`;
async function storm(total,rr=false) {
  const rows=[];let cursor=0;
  await Promise.all(Array.from({length:16},async()=>{
    while(cursor<total){
      const i=cursor++;const auth=i%4===0;
      const n=auth?Math.floor(i/4)+1:1000+i;
      const call=attempt(n,auth?"authenticated":"anonymous",`concurrency-key-${i.toString().padStart(8,"0")}`);
      const statement=rr?`begin isolation level repeatable read;set local role service_role;select public.ghostwriter_combined_ai_health();select pg_sleep(0.03);${call}commit;`:call;
      try { rows.push(lastJson(await sqlAsync(statement))); }
      catch(error) { if(rr&&/could not serialize|serialization/i.test(String(error)))rows.push({kind:"serialization_abort"});else throw error; }
    }
  }));
  return rows;
}
try {
  docker(["info","--format","{{.ServerVersion}}"]);
  docker(["run","--rm","-d","--name",name,"--network","none","-e","POSTGRES_PASSWORD=isolated-fixture-only",image]);
  started=true;
  let ready=false;
  for(let i=0;i<60;i++){
    if(docker(["exec",name,"pg_isready","-U","postgres"],undefined,true).status===0){ready=true;break;}
    await sleep(500);
  }
  assert.ok(ready,"disposable PostgreSQL readiness");
  sql(`create role anon;create role authenticated;create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,banned_until timestamptz,email text);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz not null default now());`);
  const migrations=readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort();
  assert.equal(migrations.at(-1),latestMigrationName,"Review newer migrations before running this fixture");
  for(const file of migrations.filter(f=>!migrationNames.includes(f))) sql(readFileSync(`supabase/migrations/${file}`,"utf8"));
  sql(`update public.ghostwriter_ai_control set release_profile='portfolio-free',paused=false,valid_until='infinity',
    free_organization_id='Test Org',free_project_id='Test Project',free_verified_at=now(),
    free_evidence_reference='isolated-test-not-a-provider-attestation';
    select public.ghostwriter_retention_maintenance();
    insert into auth.users select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,now(),null,'user'||n||'@isolated.invalid' from generate_series(1,25)n;
    insert into auth.sessions(id,user_id) select id,id from auth.users;
    insert into public.ghostwriter_beta_entitlements(account_id,approved_slot) select id,row_number()over(order by id) from auth.users;
    insert into public.ghostwriter_portfolio_entitlements(account_id,identity_hash)
      select id,encode(sha256(convert_to(email,'UTF8')),'hex') from auth.users;
    insert into public.ghostwriter_ai_operations(account_id,idempotency_key,request_fingerprint,state,outcome,pricing_version,reserved_micro_usd,actual_micro_usd,profile,principal_kind,dispatched_at,settled_at)
      values(gen_random_uuid(),'existing-dispatch-0001',repeat('a',64),'settled','succeeded','groq-openai-gpt-oss-20b-2026-09-07',750,0,'portfolio-free','anonymous',now()-interval '1 hour',now()-interval '1 hour');`);
  for(const migrationName of migrationNames) sql(readFileSync(`supabase/migrations/${migrationName}`,"utf8"));
  await check("forward migration backfills existing usage, keeps AI controls and default 60",()=>{
    const h=health();assert.equal(h.used,1);assert.equal(h.limit,60);
    assert.equal(sql("select global_dispatch_authorized_at=dispatched_at from public.ghostwriter_ai_operations;"),"t");
    assert.equal(sql("select paused from public.ghostwriter_ai_control;"),"f");
  });
  sql(`create function public.fixture_cap_attempt(p_account uuid,p_kind text,p_key text) returns jsonb
    language plpgsql set search_path=pg_catalog as $$
    declare r jsonb;op uuid;ok boolean;d text;
    begin
      if p_kind='authenticated' then
        r:=public.ghostwriter_free_reserve_bounded(p_account,p_account,p_key,repeat('b',64),'Test Org','Test Project','${limits}'::jsonb);
      else
        r:=public.ghostwriter_anonymous_reserve_bounded(p_account,p_key,repeat('b',64),'Test Org','Test Project','${limits}'::jsonb,100);
      end if;
      if r->>'kind'<>'admitted' then return r;end if;
      op:=(r->>'operation_id')::uuid;
      ok:=public.ghostwriter_ai_mark_dispatched(op,p_account);
      if not ok then raise exception 'Fixture dispatch unexpectedly refused';end if;
      ok:=public.ghostwriter_ai_settle_success(op,p_account,0,'isolated-provider-fixture','{"rewrite":"fixture","status":200,"error":null,"moodLabel":"fixture","artifactToken":null,"shortId":null}'::jsonb);
      if not ok then raise exception 'Fixture settlement unexpectedly refused';end if;
      return r || '{"simulatedDispatch":true}'::jsonb;
    exception when sqlstate 'GW429' then
      get stacked diagnostics d=pg_exception_detail;
      return jsonb_build_object('kind','combined_denied','details',d);
    end $$;
    grant execute on function public.fixture_cap_attempt(uuid,text,text) to service_role;`);

  await check("100 mixed-identity transactions at 59/60 admit exactly one dispatch",async()=>{
    reset();seed(59);
    // Isolate the new guard from the old UTC-day guard; never done in production.
    sql("update public.ghostwriter_ai_control set portfolio_global_daily_limit=100;");
    const rows=await storm(100);
    assert.equal(rows.filter(r=>r.simulatedDispatch).length,1);
    assert.equal(rows.filter(r=>r.kind==="combined_denied").length,99);
    assert.equal(health().used,60);
  });
  await check("negative control detects a removed combined guard",async()=>{
    reset();seed(59);sql("update public.ghostwriter_ai_control set portfolio_global_daily_limit=100;alter table public.ghostwriter_ai_operations disable trigger ghostwriter_00_combined_ai_cap;");
    try{const rows=await storm(20);assert.ok(rows.filter(r=>r.simulatedDispatch).length>1,"mutation did not defeat the cap assertion");}
    finally{sql("alter table public.ghostwriter_ai_operations enable trigger ghostwriter_00_combined_ai_cap;");}
  });
  await check("REPEATABLE READ cannot oversubscribe with a stale snapshot",async()=>{
    reset();seed(59);sql("update public.ghostwriter_ai_control set portfolio_global_daily_limit=100;");
    const rows=await storm(40,true);
    assert.equal(rows.filter(r=>r.simulatedDispatch).length,1);
    assert.equal(health().used,60);
  });
  await check("anonymous and authenticated personal three-request limits remain",()=>{
    reset();
    for(const [n,kind] of [[4000,"anonymous"],[1,"authenticated"]]){
      for(let i=0;i<3;i++)assert.equal(query(attempt(n,kind,`personal-${kind}-${i.toString().padStart(8,"0")}`)).simulatedDispatch,true);
      const fourth=runReserve(n,kind,`personal-${kind}-fourth`);
      assert.equal(fourth.kind,"denied");assert.match(fourth.reason,/account_day_limit|anonymous_day_limit/);
    }
    assert.equal(health().used,6);
  });
  await check("idempotent replay after full capacity does not authorize again",()=>{
    reset();assert.equal(query(attempt(1,"authenticated","idempotent-replay-key-001")).simulatedDispatch,true);
    seed(59);
    const replay=runReserve(1,"authenticated","idempotent-replay-key-001");assert.equal(replay.kind,"replay");
    assert.equal(health().used,60);
    const conflict=query(`set role service_role;select ${reserve(1,"authenticated","idempotent-replay-key-001").replace("repeat('b',64)","repeat('c',64)")};`);
    assert.equal(conflict.kind,"conflict");assert.equal(health().used,60);
  });
  await check("dispatch rechecks owner-lowered capacity after reservation",()=>{
    reset();const r=runReserve(5000,"anonymous","dispatch-race-test-001");assert.equal(r.kind,"admitted");
    seed(1);sql("update public.ghostwriter_ai_control set combined_ai_limit_24h=1;");
    const denied=docker(sqlArgs,`set role service_role;select public.ghostwriter_ai_mark_dispatched('${r.operation_id}','${account(5000)}');`,true);
    assert.notEqual(denied.status,0);assert.match(denied.stderr,/global_combined_limit/);
    assert.equal(sql(`select global_dispatch_authorized_at is null from public.ghostwriter_ai_operations where id='${r.operation_id}';`),"t");
  });
  await check("failure before dispatch releases a hold; claimed failure never refunds",()=>{
    reset();const a=runReserve(5001,"anonymous","before-dispatch-test-001");assert.equal(a.kind,"admitted");
    assert.equal(health().used,1);
    assert.equal(sql(`set role service_role;select public.ghostwriter_ai_fail_before_dispatch('${a.operation_id}','${account(5001)}','test');`),"t");
    assert.equal(health().used,0);
    const b=runReserve(5002,"anonymous","after-dispatch-test-001");assert.equal(b.kind,"admitted");
    assert.equal(sql(`set role service_role;select public.ghostwriter_ai_mark_dispatched('${b.operation_id}','${account(5002)}');`),"t");
    assert.equal(sql(`set role service_role;select public.ghostwriter_ai_mark_dispatched('${b.operation_id}','${account(5002)}');`),"f");
    assert.equal(sql(`set role service_role;select public.ghostwriter_ai_fail_before_dispatch('${b.operation_id}','${account(5002)}','test');`),"f");
    sql(`set role service_role;select public.ghostwriter_ai_mark_uncertain('${b.operation_id}','${account(5002)}','timeout');`);
    assert.equal(health().used,1);
    sql(`update public.ghostwriter_ai_operations set state='failed',outcome='failed',actual_micro_usd=0,settled_at=now() where id='${b.operation_id}';`);
    assert.equal(health().used,1);
  });
  await check("rolling window does not reset at UTC midnight",()=>{
    reset();seed(60);
    sql(`alter table public.ghostwriter_ai_operations disable trigger ghostwriter_00_combined_ai_cap;
      update public.ghostwriter_ai_operations set global_dispatch_authorized_at=(date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC') - interval '1 minute';
      alter table public.ghostwriter_ai_operations enable trigger ghostwriter_00_combined_ai_cap;`);
    // Test-only time argument on the private read helper, not on the public gate.
    const h=query("select ghostwriter_private.combined_ai_capacity(null,(date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC') + interval '1 minute');");
    assert.equal(h.used,60);assert.equal(h.available,false);
    reset();seed(60,"25 hours");assert.equal(health().available,true);
  });
  await check("capacity is shared across legacy paid history and portfolio identities",()=>{
    reset();seed(30,"2 hours","paid");seed(30);
    const h=health();assert.equal(h.used,60);assert.equal(h.available,false);
    for(const call of ["public.ghostwriter_anonymous_allowance('"+account(6000)+"')",`public.ghostwriter_portfolio_allowance('${account(1)}','${account(1)}','authenticated')`]){
      const a=query(`set role service_role;select ${call};`);
      assert.equal(a.globalLimited,true);assert.equal(a.available,false);assert.equal(a.remaining,3);
    }
  });
  await check("account deletion and retention do not reset the combined counter",()=>{
    reset();assert.equal(query(attempt(1,"authenticated","delete-account-test-001")).simulatedDispatch,true);
    assert.equal(sql(`set role service_role;select public.ghostwriter_delete_begin('${account(1)}','${account(1)}',repeat('c',64));`),"t");
    sql("select public.ghostwriter_retention_maintenance();");assert.equal(health().used,1);
  });
  await check("dispatch stamps cannot be cleared or backdated, even by stale SQL",()=>{
    reset();query(attempt(1,"authenticated","immutable-stamp-test-001"));
    for(const mutation of ["global_dispatch_authorized_at=null","global_dispatch_authorized_at=now()-interval '2 days'","dispatched_at=null","state='reserved'"]){
      const denied=docker(sqlArgs,`update public.ghostwriter_ai_operations set ${mutation};`,true);
      assert.notEqual(denied.status,0);
    }
    assert.equal(health().used,1);
  });
  await check("runtime roles cannot rewrite counters, raise limits or call private helpers",()=>{
    for(const role of ["anon","authenticated","service_role"]){
      for(const table of ["ghostwriter_ai_operations","ghostwriter_ai_control"])
        assert.equal(sql(`select has_table_privilege('${role}','public.${table}','INSERT,UPDATE,DELETE,TRUNCATE');`),"f");
      assert.equal(sql(`select has_schema_privilege('${role}','ghostwriter_private','USAGE');`),"f");
    }
    for(const role of ["anon","authenticated"])
      assert.equal(sql(`select has_function_privilege('${role}','public.ghostwriter_combined_ai_health()','EXECUTE');`),"f");
    const raised=docker(sqlArgs,"update public.ghostwriter_ai_control set combined_ai_limit_24h=61;",true);
    assert.notEqual(raised.status,0);
  });
  await check("missing authoritative singleton fails closed",()=>{
    reset();
    const result=query("begin;delete from public.ghostwriter_ai_control;set local role service_role;select public.ghostwriter_combined_ai_health();rollback;");
    assert.equal(result.configured,false);assert.equal(result.available,false);
  });
  console.log(JSON.stringify({status:"PASS",postgresVersion:sql("show server_version;"),scenarios:results.length,independentConnections:true,concurrencyAttempts:100,liveProviderCalls:0,liveDatabaseTouched:false,checks:results},null,2));
} catch(error) {
  console.error("FAIL",error instanceof Error?error.message:String(error));process.exitCode=1;
} finally { cleanup(); }
