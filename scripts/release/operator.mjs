import {spawnSync} from "node:child_process";
import {randomBytes,createHash} from "node:crypto";
import {FREE_REVIEW_REFERENCE} from "../../src/lib/free-review-reference.ts";
const [action,...args]=process.argv.slice(2);
const opts=Object.fromEntries(args.filter(a=>a.startsWith("--")&&a.includes("=")).map(a=>a.slice(2).split(/=(.*)/s).slice(0,2)));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function required(name,pattern){const v=opts[name];if(!v||!pattern.test(v))throw new Error("Invalid or missing --"+name);return v;}
try{
 const target=required("target",/^[a-zA-Z0-9_-]{1,80}$/);
 if (/example|placeholder|changeme|your[-_]/i.test(target)) throw new Error("Placeholder target forbidden");
 const reason=required("reason",/^[a-zA-Z0-9 .:_-]{3,240}$/);
 let sql; let deletionReceipt;
 if(action==="pause") sql="select public.ghostwriter_ai_pause("+quote(reason)+");";
 else if(action==="maintenance")sql="select public.ghostwriter_retention_maintenance();";
 else if(action==="schedule-maintenance"){
  if(opts.approve!=="seven-day-content-ninety-day-trial")throw new Error("Explicit retention policy approval required");
  sql="do $$ declare existing bigint; begin if not exists(select 1 from pg_extension where extname='pg_cron') then raise exception 'Owner must enable reviewed pg_cron extension first'; end if; for existing in select jobid from cron.job where jobname='ghostwriter-retention' loop perform cron.unschedule(existing); end loop; end $$; select cron.schedule('ghostwriter-retention','*/5 * * * *','select public.ghostwriter_retention_maintenance();'); select public.ghostwriter_retention_maintenance();";
 }
 else if(action==="recover-deletion"){
  const id=required("account",uuid);
  if(opts.approve!=="resume-committed-deletion")throw new Error("Explicit cleanup recovery approval required");
  deletionReceipt=randomBytes(32).toString("hex");
  const hash=createHash("sha256").update(deletionReceipt).digest("hex");
  sql=`do $$ begin update public.ghostwriter_deletions set receipt_hash=${quote(hash)},receipt_expires_at=clock_timestamp()+interval '7 days' where account_id=${quote(id)} and completed_at is null; if not found then raise exception 'Expected existing incomplete deletion'; end if; end $$;`;
 }
 else if(action==="configure-portfolio"){
  const org=required("organization",FREE_REVIEW_REFERENCE),project=required("project",FREE_REVIEW_REFERENCE),evidence=required("evidence",/^[A-Za-z0-9._:/-]{3,240}$/);
  const until=required("valid-until",/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/);
  if(!Number.isFinite(Date.parse(until))||Date.parse(until)<=Date.now()||Date.parse(until)>Date.now()+30*86400000)throw new Error("Free-plan review expiry must be within 30 days");
  if(opts.approve!=="verified-free-only")throw new Error("Owner must attest actual Free organization and key project with --approve=verified-free-only");
  sql=`select public.ghostwriter_ai_pause('portfolio_configuration_review'); update public.ghostwriter_ai_control set release_profile='portfolio-free',free_organization_id=${quote(org)},free_project_id=${quote(project)},free_verified_at=clock_timestamp(),free_verified_until=${quote(until)},free_evidence_reference=${quote(evidence)};`;
 }else if(action==="enable-portfolio"){
  if(opts.approve!=="verified-free-only")throw new Error("Explicit reviewed Free-only authorization required");
  sql=`do $$ begin if not exists(select 1 from public.ghostwriter_ai_control where singleton and release_profile='portfolio-free' and free_verified_at is not null and length(free_evidence_reference)>2) or exists(select 1 from public.ghostwriter_ai_operations where state in ('reserved','dispatched','uncertain')) then raise exception 'Free release not reviewed or unresolved operations remain'; end if; perform public.ghostwriter_retention_maintenance(); update public.ghostwriter_ai_control set paused=false,valid_until='infinity'::timestamptz,updated_at=clock_timestamp(),reason=${quote(reason)}; if not public.ghostwriter_release_active() then raise exception 'Portfolio lifecycle is not active after maintenance'; end if; end $$;`;
 }else if(action==="complete-portfolio-canary"){
  const run=required("run",uuid);
  sql=`select public.ghostwriter_ai_pause('portfolio_canary_review');do $$ begin update public.ghostwriter_canary c set active=false where c.run_id=${quote(run)} and c.active and exists(select 1 from public.ghostwriter_ai_operations o where o.id=c.operation_id and o.profile='portfolio-free' and o.state='settled' and o.outcome='succeeded');if not found then raise exception 'Expected successfully settled Free canary';end if;end $$;`;
 }
 else if(action==="grant"){
  const id=required("account",uuid),slot=Number(required("slot",/^([1-9]|1[0-9]|2[0-5])$/));
  sql=`insert into public.ghostwriter_beta_entitlements(account_id,approved_slot,note) values(${quote(id)},${slot},${quote(reason)});`;
 }else if(action==="revoke"){
  const id=required("account",uuid);
  sql=`do $$ declare changed integer:=0; affected integer:=0; begin update public.ghostwriter_beta_entitlements set revoked_at=clock_timestamp() where account_id=${quote(id)} and revoked_at is null; get diagnostics affected=row_count; changed:=changed+affected; if to_regclass('public.ghostwriter_portfolio_entitlements') is not null then update public.ghostwriter_portfolio_entitlements set revoked_at=clock_timestamp() where account_id=${quote(id)} and revoked_at is null; get diagnostics affected=row_count; changed:=changed+affected; end if; if changed=0 then raise exception 'No active entitlement'; end if; end $$;`;
 }else if(action==="prepare-canary"){
  const id=required("account",uuid),run=required("run",uuid);
  sql=`select public.ghostwriter_ai_pause('canary_preparation'); insert into public.ghostwriter_canary(singleton,run_id,account_id) values(true,${quote(run)},${quote(id)});`;
 }else if(action==="quarantine-dispatched"){
  const id=required("operation",uuid);
  sql=`select public.ghostwriter_ai_pause('operator_crash_quarantine'); do $$ begin update public.ghostwriter_ai_operations set state='uncertain',updated_at=clock_timestamp(),failure_code='operator_crash_quarantine' where id=${quote(id)} and state='dispatched'; if not found then raise exception 'Expected dispatched operation'; end if; end $$;`;
 }else if(action==="release-reserved"){
  const id=required("operation",uuid);
  sql=`select public.ghostwriter_ai_pause('operator_reserved_recovery'); do $$ begin update public.ghostwriter_ai_operations set actual_micro_usd=0,state='failed',outcome='failed',settled_at=clock_timestamp(),failure_code='operator_released_reserved' where id=${quote(id)} and state='reserved'; if not found then raise exception 'Expected reserved operation'; end if; end $$;`;
 }else if(action==="reconcile"){
  const id=required("operation",uuid),cost=required("actual-micro-usd",/^(0|[1-9][0-9]{0,12})$/);
  sql=`select public.ghostwriter_ai_pause('operator_reconciliation'); do $$ begin update public.ghostwriter_ai_operations set actual_micro_usd=${cost},state='settled',outcome='failed',settled_at=clock_timestamp(),failure_code='operator_reconciled' where id=${quote(id)} and state='uncertain' and coalesce(observed_micro_usd,0)<=${cost}; if not found then raise exception 'Expected uncertain operation and cost covering observed liability'; end if; end $$;`;
 }else throw new Error("Allowed actions: pause, maintenance, schedule-maintenance, configure-portfolio, enable-portfolio, complete-portfolio-canary, grant, revoke, prepare-canary, quarantine-dispatched, release-reserved, reconcile, recover-deletion");
 if(!args.includes("--execute")){console.log(JSON.stringify({mode:"dry-run",action,target,changesApplied:false,requires:"Owner-authorized operator PGSERVICE; no provider call"}));process.exit(0);}
 const deployment=required("database-id",uuid);
 if(deletionReceipt){
  const project=required("auth-project",/^[a-z]{20}$/);
  if(process.env.SUPABASE_URL!==`https://${project}.supabase.co` || !process.env.SUPABASE_SERVICE_ROLE_KEY || opts["management-project"]!==project)throw new Error("Recovery requires matching explicit database/Auth project and server credential; no secrets in arguments");
 }
 const managementProject=opts["management-project"];
 if(managementProject){
  required("management-project",/^[a-z]{20}$/);
  if(target!=="postgres")throw new Error("Managed Supabase database target must be postgres");
 }else{
  if(!process.env.PGSERVICE||process.env.PGPASSWORD)throw new Error("Use a restricted PGSERVICE and .pgpass; no password in arguments/environment");
  const service=required("service",/^[a-zA-Z0-9_-]{1,80}$/);
  if(process.env.PGSERVICE!==service)throw new Error("Operator service does not match authorization");
 }
 const targetCheck="do $$ begin if current_database()<>"+quote(target)+" or not exists(select 1 from public.ghostwriter_ai_control where singleton and deployment_id="+quote(deployment)+"::uuid) then raise exception 'Target identity mismatch'; end if; end $$; ";
 const subject=opts.operation??opts.account;
 const transaction="begin; set local statement_timeout='3s'; select pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0)); "+targetCheck+sql+" insert into public.ghostwriter_operator_events(action,reason,subject_id) values("+quote(action)+","+quote(reason)+","+(subject?quote(subject)+"::uuid":"null")+"); commit;";
 // Both transports execute the identical deployment-bound, audited transaction.
 // Management uses the owner's existing CLI login, never the runtime role.
 const result=managementProject
  ? spawnSync("npx",["--cache",".tmp/npm-release","--yes","supabase","db","query","--linked","--project-ref",managementProject,transaction],{encoding:"utf8",timeout:30000})
  : spawnSync("psql",["-X","-q","-v","ON_ERROR_STOP=1"],{input:transaction,encoding:"utf8"});
 if(result.status!==0)throw new Error("Operator transaction failed; no success claimed");
 if(deletionReceipt){
  const {continueAccountDeletion}=await import("../../src/server/account-deletion.ts");
  const cleanup=await continueAccountDeletion(deletionReceipt);
  console.log(JSON.stringify({mode:"executed",action,target,committed:true,cleanup,receiptDisclosed:false}));
  process.exit(cleanup==="complete"?0:2);
 }
 console.log(JSON.stringify({mode:"executed",action,target,committed:true}));
}catch(error){console.error(error.message);process.exitCode=1;}
