import {execFileSync,spawnSync} from "node:child_process";
import {readFileSync,readdirSync} from "node:fs";
import assert from "node:assert/strict";
const name="gw-retention-cron-"+process.pid;
const docker=args=>execFileSync("docker",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const sql=input=>execFileSync("docker",["exec","-i",name,"psql","-U","supabase_admin","-d","postgres","-Atq","-v","ON_ERROR_STOP=1"],{input,encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim();
try{
 docker(["run","--rm","-d","--name",name,"--network","none","-e","POSTGRES_PASSWORD=isolated-only","supabase/postgres:17.6.1.136@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00","-c","shared_preload_libraries=pg_cron","-c","cron.database_name=postgres"]);
 let ready=false;
 for(let i=0;i<90;i++){
  try{docker(["exec",name,"pg_isready","-h","127.0.0.1","-U","supabase_admin","-d","postgres"]);sql("select 1;");ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}
 }
 assert.ok(ready);
 // Official DB image has the baseline Auth users schema; GoTrue adds sessions.
 sql("create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz,created_at timestamptz default now()); alter table auth.users add column if not exists email_confirmed_at timestamptz; alter table auth.users add column if not exists banned_until timestamptz; create extension if not exists pg_cron;");
 for(const f of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort())sql("begin;"+readFileSync("supabase/migrations/"+f,"utf8")+"commit;");
 assert.equal(sql("select last_maintenance_at is not null from public.ghostwriter_lifecycle;"),"t");
 sql("update public.ghostwriter_lifecycle set last_maintenance_at=clock_timestamp()-interval '2 days';");
 // Accelerated interval only in this isolated fixture. The installed schedule
 // is checked separately below; no production job or database is contacted.
 sql("select cron.schedule('ghostwriter-retention','1 second','select public.ghostwriter_retention_maintenance();');");
 // last_maintenance_at was rewound above, not nulled: it is already non-null
 // before pg_cron ever fires, so "is not null" can never detect a real run.
 // Detect an actual execution by requiring a timestamp newer than the rewind.
 let executed=false;
 for(let i=0;i<30;i++){
  await new Promise(r=>setTimeout(r,500));
  if(sql("select last_maintenance_at>clock_timestamp()-interval '1 minute' from public.ghostwriter_lifecycle;")==="t"){executed=true;break;}
 }
 assert.ok(executed,"pg_cron did not execute retention maintenance");
 // pg_cron records job_run_details slightly after the job's own commit; give
 // its background bookkeeping worker a brief grace window to catch up.
 let logged=false;
 for(let i=0;i<10;i++){
  if(Number(sql("select count(*) from cron.job_run_details where status='succeeded';"))>0){logged=true;break;}
  await new Promise(r=>setTimeout(r,300));
 }
 assert.ok(logged,"pg_cron did not record a succeeded run in cron.job_run_details");
 const old=sql("select jobid from cron.job where jobname='ghostwriter-retention' order by jobid limit 1;");if(old)sql(`select cron.unschedule(${old});`);sql("select cron.schedule('ghostwriter-retention','*/5 * * * *','select public.ghostwriter_retention_maintenance();');");
 assert.equal(sql("select count(*) from cron.job where jobname='ghostwriter-retention';"),"1");
 // boolean::text (triggered by || concatenation) renders "true"/"false", not
 // psql -A's raw "t"/"f" column formatting.
 assert.equal(sql("select schedule||':'||active from cron.job where jobname='ghostwriter-retention';"),"*/5 * * * *:true");
 console.log(JSON.stringify({test:"actual-pg-cron-retention-execution",status:"PASS",scope:"isolated official Postgres 17 image; accelerated execution and five-minute schedule readback; no hosted activation"}));
}finally{spawnSync("docker",["stop",name],{stdio:"ignore",timeout:30000});}
