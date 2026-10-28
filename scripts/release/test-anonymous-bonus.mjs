// Run with PGLITE_MODULE pointing to an independently installed @electric-sql/pglite.
// Uses an isolated in-memory database; never contacts production.
const {PGlite} = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import{readdirSync,readFileSync}from'node:fs';import assert from'node:assert/strict';
for(const base of [3,5]){
const db=new PGlite();const id=n=>`00000000-0000-4000-8000-${String(n+1).padStart(12,'0')}`;
await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz,banned_until timestamptz,email text); create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz not null default now());");
for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()){
if(f==='202609160001_ghostwriter_combined_global_cap.sql'){
 await db.exec(`update public.ghostwriter_ai_control set release_profile='portfolio-free',paused=false,valid_until='infinity',free_organization_id='Test Org',free_project_id='Test Project',free_verified_at=now(),free_evidence_reference='isolated-fixture', free_limits=jsonb_set(free_limits,'{accountDay}','${base}'); select public.ghostwriter_retention_maintenance();`);
 // Separate snapshots keep fleet use below the real shared cap.
 for(let n=0;n<=5;n++)for(let j=0;j<base+n;j++)await db.query(`insert into public.ghostwriter_ai_operations(account_id,idempotency_key,request_fingerprint,state,outcome,pricing_version,reserved_micro_usd,actual_micro_usd,profile,principal_kind,dispatched_at,settled_at) values($1,$2,repeat('a',64),'settled','succeeded','groq-openai-gpt-oss-20b-2026-09-07',750,0,'portfolio-free','anonymous',now()-interval '2 minutes',now()-interval '2 minutes')`,[id(n),`fixture-${n}-${j}-operation`]);
}
if(f==='202610280001_ghostwriter_anonymous_test_bonus.sql' && base===5){
 for(const name of ['ghostwriter_anonymous_reserve_bounded','ghostwriter_anonymous_allowance_before_combined_cap']){
 const {rows:[{definition}]}=await db.query('select pg_get_functiondef(oid) as definition from pg_proc where proname=$1',[name]);
 let configured=definition;
 if(name==='ghostwriter_anonymous_reserve_bounded') configured=configured.replace('least(3,(ceilings->>\'accountDay\')::integer)','least(5,(ceilings->>\'accountDay\')::integer)');
 else configured=configured.replace('global_day integer;','global_day integer; visitor_day integer;').replace('select portfolio_global_daily_limit into global_day','select portfolio_global_daily_limit,least(5,(free_limits->>\'accountDay\')::integer) into global_day,visitor_day').replaceAll('greatest(0,3-used)','greatest(0,visitor_day-used)');
 await db.exec(configured);
 }
}
await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
}
// The actual deployed allowance has a variable visitor_day, also covered by migration matching.
const limits=(await db.query('select free_limits from public.ghostwriter_ai_control')).rows[0].free_limits;
for(let n=0;n<=5;n++){
assert.equal((await db.query('select public.ghostwriter_anonymous_allowance($1) as v',[id(n)])).rows[0].v.remaining,0);
await db.query(`insert into public.ghostwriter_anonymous_test_bonus values($1,5,statement_timestamp(),statement_timestamp()+interval '24 hours','isolated regression test')`,[id(n)]);
const v=(await db.query('select public.ghostwriter_anonymous_allowance($1) as v',[id(n)])).rows[0].v;assert.equal(v.remaining,Math.max(0,5-n));assert.equal(v.available,true);
await db.exec('begin');
const admitted=(await db.query(`select public.ghostwriter_anonymous_reserve_bounded($1,'bonus-test-operation',repeat('b',64),'Test Org','Test Project',$2::jsonb,60) as v`,[id(n),JSON.stringify(limits)])).rows[0].v;
assert.equal(admitted.kind,n<5?'admitted':'denied',JSON.stringify(admitted));if(n===5)assert.equal(admitted.reason,'anonymous_day_limit');
await db.exec('rollback');
}
await db.query(`update public.ghostwriter_anonymous_test_bonus set granted_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where visitor_id=$1`,[id(0)]);
assert.equal((await db.query('select public.ghostwriter_anonymous_allowance($1) as v',[id(0)])).rows[0].v.remaining,0);
assert.equal((await db.query('select public.ghostwriter_anonymous_bonus($1) as v',[id(99)])).rows[0].v,0);
for(const role of ['anon','authenticated','service_role']){await db.exec('begin;set local role '+role);await assert.rejects(db.query('insert into public.ghostwriter_anonymous_test_bonus values($1,5,now(),now()+interval \'1 hour\',\'forbidden\')',[id(99)]));await db.exec('rollback');}
console.log(`PASS: baseline ${base}; five admissions, sixth denied, expiry, isolation, issuance permissions`);await db.close();
}
