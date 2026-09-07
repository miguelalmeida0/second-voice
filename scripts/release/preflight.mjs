import {readFileSync,existsSync} from "node:fs";
import {sourceIdentity,evidenceIdentityErrors} from "./source-identity.mjs";
const mode=process.argv[2];
if(!["deploy","enable-ai"].includes(mode)){console.error("Use deploy or enable-ai");process.exit(1);}
const blockers=[];
if(process.env.AI_ENABLED!=="false")blockers.push("Exact disabled target must have AI_ENABLED=false");
if(!process.env.GHOSTWRITER_TARGET_ID)blockers.push("Target identity missing");
if(!process.env.GHOSTWRITER_RELEASE_EVIDENCE)blockers.push("Commit/build/schema-bound evidence missing");
else{
 try{
  const e=JSON.parse(readFileSync(process.env.GHOSTWRITER_RELEASE_EVIDENCE,"utf8"));
  blockers.push(...evidenceIdentityErrors(e,sourceIdentity()));
  if(e.repositoryVerdict!=="PASS")blockers.push("Repository evidence is incomplete");
  if(e.target!==process.env.GHOSTWRITER_TARGET_ID)blockers.push("Evidence target mismatch");
 }catch{blockers.push("Evidence unreadable");}
}
if(!existsSync(".next/BUILD_ID"))blockers.push("Reviewed production build missing");
blockers.push("Target schema/grants, deployment identity, proxy trust, and isolated credentials have not been independently verified");
if(mode==="enable-ai")blockers.push("Provider full-token/billing bound unresolved; live transport disabled in code","Supabase browser authentication integration and controlled canary unperformed","Provider organization/hosting billing controls unknown");
console.log(JSON.stringify({mode,readOnly:true,status:blockers.length?"BLOCKED":"READY",blockers},null,2));
process.exitCode=blockers.length?1:0;
