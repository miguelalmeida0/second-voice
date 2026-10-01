import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync} from "node:fs";
import {resolve} from "node:path";
import {sourceIdentity,sameSource} from "./source-identity.mjs";
mkdirSync(".tmp/release",{recursive:true,mode:0o700});
const initialSource=sourceIdentity();
const portfolio=process.argv.includes("--portfolio");
const checks=[
 ["lint","npm",["run","lint"]],
 ["route-types","npx",["next","typegen"]],
 ["typecheck","npx",["tsc","--noEmit"]],
 ["security","npm",["run","test:security"]],
 ["scroll","npm",["run","test:scroll"]],
 ["sql-integration","node",["scripts/release/test-ledger.mjs"]],
 ["authentication","node",["--experimental-strip-types","scripts/release/test-auth.mjs"]],
 ["browser","node",["scripts/release/test-browser.mjs"]],
 ["build","npm",["run","build","--","--webpack"]],
 ["dependencies","npm",["audit","--audit-level=moderate"]],
 ["secrets","node",["scripts/release/scan-secrets.mjs"]],
 ["diff","git",["diff","--check"]]
];
if(portfolio){
 checks.push(["production-gate","node",["--experimental-strip-types","scripts/release/test-auth.mjs","--predeploy"]]);
 checks.push(["retention-cron","node",["scripts/release/test-retention-cron.mjs"]]);
 checks.find(c=>c[0]==="sql-integration")[2].push("--portfolio");
 checks.splice(checks.findIndex(c=>c[0]==="browser"),1); // Auth includes its own actual browser flow; the broad visual matrix remains in verify:release.
 checks.splice(checks.findIndex(c=>c[0]==="build")+1,0,["portfolio-ui","node",["scripts/release/test-portfolio-browser.mjs"]]);
}
const synthetic="CANARY_ONLY_NOT_A_CREDENTIAL_7293c67a83bb4ce79d36";
mkdirSync(".tmp/runtime",{recursive:true});
const env={...process.env,TMPDIR:resolve(".tmp/runtime"),AI_ENABLED:"false",GROQ_API_KEY:synthetic,SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_PUBLISHABLE_KEY:synthetic+"_public",SUPABASE_SERVICE_ROLE_KEY:synthetic+"_db",GHOSTWRITER_SECURITY_SECRET:synthetic+"_sign",GHOSTWRITER_FINGERPRINT_SECRET:synthetic+"_fingerprint",NEXT_TELEMETRY_DISABLED:"1"};
const results=[];
for(const [name,cmd,args] of checks){
 console.log("Checking "+name);
 const r=spawnSync(cmd,args,{env,encoding:"utf8",timeout:15*60*1000,killSignal:"SIGTERM",maxBuffer:16*1024*1024});
 const sandboxUnavailable=/BROWSER_BLOCKED|bootstrap_check_in.*Permission denied|MachPortRendezvous|operation not permitted/i.test((r.stderr??"")+(r.stdout??""));
 let status=r.error||(["authentication","production-gate","browser","portfolio-ui"].includes(name)&&r.status===2)||sandboxUnavailable?"BLOCKED":r.status===0?"PASS":"FAIL";
 // Tests use synthetic data. Redact synthetic secret markers too.
 const log=((r.stdout??"")+"\n"+(r.stderr??"")).replaceAll(synthetic,"[SYNTHETIC_REDACTED]");
 writeFileSync(".tmp/release/"+name+".log",log,{mode:0o600});
 let details;
 if(name==="sql-integration"&&r.status===0){try{details=portfolio?r.stdout.split("\n").filter(line=>line.startsWith('{"scenario":')).map(line=>JSON.parse(line)):JSON.parse(r.stdout);}catch{details={unreadable:true};}}
 if(name==="authentication"||name==="production-gate")details=(r.stdout??"").split("\n").filter(line=>line.startsWith('{"scope":')).map(line=>{try{return JSON.parse(line);}catch{return {unreadable:true};}});
 if(details&&/"(?:status|verdict)":"(?:BLOCKED|FAIL)"|"unreadable":true/.test(JSON.stringify(details)))status="FAIL";
 results.push({name,status,exitCode:r.status,unavailable:r.error?.code??null,...(details?{details}: {})});
}
function files(dir){return existsSync(dir)?readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+"/"+e.name):[dir+"/"+e.name]):[];}
const clientLeak=files(".next/static").some(f=>readFileSync(f).includes(Buffer.from(synthetic)));
results.push({name:"client-secret-canary",status:clientLeak?"FAIL":existsSync(".next/static")&&results.find(r=>r.name==="build")?.status==="PASS"?"PASS":"BLOCKED"});
const finalSource=sourceIdentity();
results.push({name:"source-stability",status:sameSource(initialSource,finalSource)?"PASS":"FAIL"});
const requiredUnperformed=portfolio?[]:["Complete two-Next-process authenticated dispatch/failure integration", "Complete crash/restore/recovery race matrix"];
const repositoryVerdict=results.some(r=>r.status==="FAIL")?"FAIL":results.some(r=>r.status==="BLOCKED")||requiredUnperformed.length?"BLOCKED":"PASS";
const evidence={...finalSource,verifiedAt:new Date().toISOString(),target:null,repositoryVerdict,checks:results,requiredUnperformed,externalControls:"UNKNOWN",liveAi:portfolio?"BLOCKED pending actual Free plans, target schema/auth and separately authorized live rewrite/replay":"DISABLED: complete provider token/billing bound unresolved",profile:portfolio?"portfolio-free":"paid",portfolioVerdict:portfolio?"LOCAL CHECKS ONLY; DEPLOYED ACCEPTANCE NOT VERIFIED":undefined};
writeFileSync(".tmp/release/"+(portfolio?"portfolio-evidence.json":"evidence.json"),JSON.stringify(evidence,null,2)+"\n");
console.log(JSON.stringify(evidence,null,2));
process.exitCode=repositoryVerdict==="PASS"?0:1;
