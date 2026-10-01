import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
const args=process.argv.slice(2);
const portfolio=args.includes("--portfolio");
const opts=Object.fromEntries(args.filter(a=>a.startsWith("--")&&a.includes("=")).map(a=>a.slice(2).split(/=(.*)/s).slice(0,2)));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
try{
 if(!uuid.test(opts.run??"")||!uuid.test(opts.account??""))throw new Error("Explicit --run and --account UUIDs required");
 const target=new URL(opts.target);
 if(target.protocol!=="https:"||target.username||target.password||target.pathname!=="/")throw new Error("Exact HTTPS target origin required");
 const key="canary-"+opts.run;
 if(!args.includes("--execute")){
  console.log(JSON.stringify({mode:"dry-run",target:target.origin,run:opts.run,account:opts.account,idempotencyKey:key,maximumDistinctDispatches:1,additionalCeilingMicroUsd:10000,providerCalls:0,requires:"Pre-provisioned matching durable canary row, passed enablement preflight and explicit live approval"}));
 }else{
  const gate=spawnSync("node",portfolio?["scripts/release/preflight-portfolio.mjs"]:["scripts/release/preflight.mjs","enable-ai"],{stdio:"inherit"});
  if(gate.status!==0)throw new Error("Canary blocked by enablement preflight; no paid request sent");
  if(opts.approve!=="one-operation"||!process.env.GHOSTWRITER_CANARY_ACCESS_TOKEN)throw new Error("Explicit one-operation approval and secure process credential required");
  if(!uuid.test(opts["database-id"]??"")||!/^[a-zA-Z0-9_-]{1,80}$/.test(opts.database??"")||opts.service!==process.env.PGSERVICE)throw new Error("Pre-authorized operator pause target required");
  if(new URL(process.env.NEXT_PUBLIC_SITE_URL??"").origin!==target.origin)throw new Error("Canary target differs from configured application");
  const check=spawnSync("psql",["-X","-Atq","-v","ON_ERROR_STOP=1"],{input:`begin read only;set local statement_timeout='3s';select exists(select 1 from public.ghostwriter_ai_control d join public.ghostwriter_canary c on c.singleton=d.singleton left join public.ghostwriter_ai_operations o on o.id=c.operation_id where d.deployment_id='${opts["database-id"]}' and current_database()='${opts.database}' and c.run_id='${opts.run}' and c.account_id='${opts.account}' and (c.operation_id is null or (o.state='settled' and o.outcome='succeeded')));commit;`,encoding:"utf8",timeout:10000});
  if(check.status!==0 || check.stdout.trim()!=="t")throw new Error("Durable canary/account/database binding not verified; no request sent");
  const jar=new Map(),ua="Mozilla/5.0 GhostwriterOwnerCanary";
  const capture=r=>{for(const v of r.headers.getSetCookie()){const first=v.split(";")[0],i=first.indexOf("=");jar.set(first.slice(0,i),first.slice(i+1));}};
  const page=await fetch(target.origin+"/second-voice",{headers:{"user-agent":ua},redirect:"error",signal:AbortSignal.timeout(10000)});capture(page);
  async function submit(){
   const headers={"user-agent":ua,origin:target.origin,cookie:[...jar].map(([k,v])=>k+"="+v).join("; "),"x-ghostwriter-csrf":jar.get("gw_csrf")??""};
   const challenge=await fetch(target.origin+"/api/ghostwriter/challenge",{headers,redirect:"error",signal:AbortSignal.timeout(10000)});
   if(!challenge.ok)throw new Error("Challenge failed");
   const c=await challenge.json();
   if(!Number.isInteger(c.difficulty)||c.difficulty<3||c.difficulty>4)throw new Error("Unexpected proof policy");
   let nonce=0;while(nonce<2000000&&!createHash("sha256").update(c.challengeToken+"."+nonce).digest("hex").startsWith("0".repeat(c.difficulty)))nonce++;
   if(nonce===2000000)throw new Error("Proof exhausted");
   return fetch(target.origin+"/api/ghostwriter",{method:"POST",redirect:"error",signal:AbortSignal.timeout(35000),headers:{...headers,authorization:"Bearer "+process.env.GHOSTWRITER_CANARY_ACCESS_TOKEN,"content-type":"application/json","idempotency-key":key},body:JSON.stringify({author:"hemingway",mode:"author",mood:50,outcome:"clarity",text:"The lamp stayed lit beside the empty road.",share:false,challengeToken:c.challengeToken,challengeNonce:String(nonce)})});
  }
  try{
   const result=await submit();if(!result.ok)throw new Error("Canary failed or uncertain; do not regenerate");
   const first=await result.json();if(!first.operationId||first.error)throw new Error("Canary result incomplete");
   const replay=await submit();if(!replay.ok)throw new Error("Replay failed; reconcile without regenerating");
   const second=await replay.json();if(first.operationId!==second.operationId||first.rewrite!==second.rewrite)throw new Error("Replay mismatch");
   console.log(JSON.stringify({run:opts.run,operationId:first.operationId,result:"returned-and-replayed",profile:portfolio?"portfolio-free":"paid",providerInvoice:"not established by this test"}));
  }finally{
   // The normal operator transaction pauses even after an ambiguous HTTP result.
   const paused=spawnSync("node",["scripts/release/operator.mjs","pause","--target="+opts.database,"--database-id="+opts["database-id"],"--service="+opts.service,"--reason=canary_completed_or_uncertain","--execute"],{stdio:"inherit"});
   if(paused.status!==0)throw new Error("Pause not confirmed: use independent provider/edge emergency shutdown");
  }
 }
}catch(error){console.error(error.message);process.exitCode=1;}
