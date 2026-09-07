import {spawnSync} from "node:child_process";
const [action,...args]=process.argv.slice(2);
const opts=Object.fromEntries(args.filter(a=>a.startsWith("--")&&a.includes("=")).map(a=>a.slice(2).split(/=(.*)/s).slice(0,2)));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const quote=s=>"'"+s.replaceAll("'","''")+"'";
function required(name,pattern){const v=opts[name];if(!v||!pattern.test(v))throw new Error("Invalid or missing --"+name);return v;}
try{
 const target=required("target",/^[a-zA-Z0-9_-]{1,80}$/);
 const reason=required("reason",/^[a-zA-Z0-9 .:_-]{3,240}$/);
 let sql;
 if(action==="pause") sql="select public.ghostwriter_ai_pause("+quote(reason)+");";
 else if(action==="configure-portfolio"){
  const org=required("organization",/^[A-Za-z0-9_-]{3,120}$/),project=required("project",/^[A-Za-z0-9_-]{3,120}$/),evidence=required("evidence",/^[A-Za-z0-9._:/-]{3,240}$/);
  const until=required("valid-until",/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/);
  if(!Number.isFinite(Date.parse(until))||Date.parse(until)<=Date.now()||Date.parse(until)>Date.now()+30*86400000)throw new Error("Free-plan review expiry must be within 30 days");
  if(opts.approve!=="verified-free-only")throw new Error("Owner must attest actual Free organization and key project with --approve=verified-free-only");
  sql=`select public.ghostwriter_ai_pause('portfolio_configuration_review'); update public.ghostwriter_ai_control set release_profile='portfolio-free',free_organization_id=${quote(org)},free_project_id=${quote(project)},free_verified_until=${quote(until)},free_evidence_reference=${quote(evidence)};`;
 }else if(action==="enable-portfolio"){
  if(opts.approve!=="verified-free-only")throw new Error("Explicit reviewed Free-only authorization required");
  sql=`do $$ begin if not exists(select 1 from public.ghostwriter_ai_control where singleton and release_profile='portfolio-free' and free_verified_until>clock_timestamp() and length(free_evidence_reference)>2) or exists(select 1 from public.ghostwriter_ai_operations where state in ('reserved','dispatched','uncertain')) then raise exception 'Free release not reviewed or unresolved operations remain'; end if; update public.ghostwriter_ai_control set paused=false,valid_until=least(free_verified_until,clock_timestamp()+interval '24 hours'),updated_at=clock_timestamp(),reason=${quote(reason)}; end $$;`;
 }else if(action==="complete-portfolio-canary"){
  const run=required("run",uuid);
  sql=`select public.ghostwriter_ai_pause('portfolio_canary_review');do $$ begin update public.ghostwriter_canary c set active=false where c.run_id=${quote(run)} and c.active and exists(select 1 from public.ghostwriter_ai_operations o where o.id=c.operation_id and o.profile='portfolio-free' and o.state='settled' and o.outcome='succeeded');if not found then raise exception 'Expected successfully settled Free canary';end if;end $$;`;
 }
 else if(action==="grant"){
  const id=required("account",uuid),slot=Number(required("slot",/^([1-9]|1[0-9]|2[0-5])$/));
  sql=`insert into public.ghostwriter_beta_entitlements(account_id,approved_slot,note) values(${quote(id)},${slot},${quote(reason)});`;
 }else if(action==="revoke"){
  const id=required("account",uuid);
  sql=`do $$ begin update public.ghostwriter_beta_entitlements set revoked_at=clock_timestamp() where account_id=${quote(id)} and revoked_at is null; if not found then raise exception 'No active entitlement'; end if; end $$;`;
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
 }else throw new Error("Allowed actions: pause, grant, revoke, prepare-canary, quarantine-dispatched, release-reserved, reconcile");
 if(!args.includes("--execute")){console.log(JSON.stringify({mode:"dry-run",action,target,changesApplied:false,requires:"Owner-authorized operator PGSERVICE; no provider call"}));process.exit(0);}
 if(!process.env.PGSERVICE||process.env.PGPASSWORD)throw new Error("Use a restricted PGSERVICE and .pgpass; no password in arguments/environment");
 const deployment=required("database-id",uuid);
 const service=required("service",/^[a-zA-Z0-9_-]{1,80}$/);
 if(process.env.PGSERVICE!==service)throw new Error("Operator service does not match authorization");
 const targetCheck="do $$ begin if current_database()<>"+quote(target)+" or not exists(select 1 from public.ghostwriter_ai_control where singleton and deployment_id="+quote(deployment)+"::uuid) then raise exception 'Target identity mismatch'; end if; end $$; ";
 const subject=opts.operation??opts.account;
 const transaction="begin; set local statement_timeout='3s'; select pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1',0)); "+targetCheck+sql+" insert into public.ghostwriter_operator_events(action,reason,subject_id) values("+quote(action)+","+quote(reason)+","+(subject?quote(subject)+"::uuid":"null")+"); commit;";
 const result=spawnSync("psql",["-X","-q","-v","ON_ERROR_STOP=1"],{input:transaction,encoding:"utf8"});
 if(result.status!==0)throw new Error("Operator transaction failed; no success claimed");
 console.log(JSON.stringify({mode:"executed",action,target,committed:true}));
}catch(error){console.error(error.message);process.exitCode=1;}
