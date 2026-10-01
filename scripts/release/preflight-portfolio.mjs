// Read-only target checks. Console plan evidence remains an OWNER ATTESTATION,
// not an automatically established billing guarantee.
import {existsSync,readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {sourceIdentity,evidenceIdentityErrors} from "./source-identity.mjs";
import {portfolioTargetSql,portfolioTargetErrors} from "./target-policy.mjs";
const blockers=[];
// Match local app configuration without shell sourcing or logging values.
// Explicit process settings (including production target settings) take priority.
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
let attestation;
try{
 const local=JSON.parse(readFileSync(".tmp/release/portfolio-evidence.json","utf8"));
 blockers.push(...evidenceIdentityErrors(local,sourceIdentity()));
 attestation=JSON.parse(readFileSync(process.env.GHOSTWRITER_PORTFOLIO_TARGET_EVIDENCE??"","utf8"));
 const manualBrowserSubstitution=attestation.authAcceptanceVerified===true && local.checks?.every(check=>check.status==="PASS" || (check.name==="authentication" && check.status==="BLOCKED" && check.details?.some(detail=>detail.status==="PASS" && detail.scope==="Real Next HTTP + GoTrue + PostgREST + PostgreSQL")));
 if(local.repositoryVerdict!=="PASS" && !manualBrowserSubstitution)blockers.push("Required local checks incomplete; browser-only environment limitation may be replaced by recorded owner acceptance");
 const time=Date.parse(attestation.verifiedAt);
 if(!Number.isFinite(time)||time>Date.now()||Date.now()-time>86400000)blockers.push("Target evidence is invalid or older than 24 hours");
 if(attestation.groqPlan!=="Free"||attestation.supabasePlan!=="Free"||attestation.hostingPlan!=="Hobby")blockers.push("Actual non-overage Free plans have not been owner-verified");
 for(const flag of ["credentialProjectVerified","previewIsolationVerified","authAcceptanceVerified","ingressVerified","noPaidAddonsVerified"])
  if(attestation[flag]!==true)blockers.push("Owner verification missing: "+flag);
 if(attestation.sourceCommit!==local.sourceCommit||attestation.sourceTreeSha256!==local.sourceTreeSha256||attestation.buildSha256!==local.buildSha256)blockers.push("Target build/source evidence mismatch");
 if(new URL(attestation.targetOrigin).origin!==new URL(process.env.NEXT_PUBLIC_SITE_URL).origin)blockers.push("Application origin mismatch");
 if(attestation.groqOrganizationId!==process.env.GROQ_FREE_ORGANIZATION_ID||attestation.groqProjectId!==process.env.GROQ_FREE_PROJECT_ID)blockers.push("Groq project/organization metadata mismatch");
 if(new URL(process.env.SUPABASE_URL).hostname!==attestation.supabaseProjectRef+".supabase.co")blockers.push("Supabase project identity mismatch");
 if(!process.env.PGSERVICE||process.env.PGPASSWORD)blockers.push("Read-only target connection requires protected PGSERVICE/.pgpass");
 else{
  const r=spawnSync("psql",["-X","-Atq","-v","ON_ERROR_STOP=1"],{input:portfolioTargetSql,encoding:"utf8",timeout:10000});
  if(r.status!==0)blockers.push("Target schema/permissions unavailable");
  else{
   const db=JSON.parse(r.stdout.trim());
   blockers.push(...portfolioTargetErrors(db,attestation));
  }
 }
}catch{blockers.push("Required local/target evidence unavailable or malformed");}
if(process.env.GHOSTWRITER_RELEASE_PROFILE!=="portfolio-free")blockers.push("Portfolio Free profile is not selected");
if(process.env.VERCEL_ENV&&process.env.VERCEL_ENV!=="production")blockers.push("Preview cannot enable inference");
console.log(JSON.stringify({status:blockers.length?"BLOCKED":"READY_FOR_OWNER_AUTHORIZATION",readOnly:true,planEvidence:"OWNER-ATTESTED, not automatically verified",liveRewrite:"NOT PERFORMED",blockers},null,2));
process.exitCode=blockers.length?1:0;
