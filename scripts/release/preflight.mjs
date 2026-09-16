import {readFileSync,existsSync} from "node:fs";
import {sourceIdentity,evidenceIdentityErrors} from "./source-identity.mjs";
import {disabledDeploymentErrors} from "./deployment-policy.mjs";
const mode=process.argv[2];
if(!["deploy","enable-ai"].includes(mode)){console.error("Use deploy or enable-ai");process.exit(1);}
const blockers=[];
let preparation;
try{preparation=JSON.parse(readFileSync(process.env.GHOSTWRITER_DEPLOYMENT_PREPARATION??'',"utf8"));}catch{/* Missing evidence is rejected below. */}
blockers.push(...disabledDeploymentErrors(process.env,preparation));
if(!process.env.GHOSTWRITER_RELEASE_EVIDENCE)blockers.push("Commit/build/schema-bound evidence missing");
else{
 try{
  const e=JSON.parse(readFileSync(process.env.GHOSTWRITER_RELEASE_EVIDENCE,"utf8"));
  blockers.push(...evidenceIdentityErrors(e,sourceIdentity()));
  if(e.repositoryVerdict!=="PASS")blockers.push("Repository evidence is incomplete");
  // Local artifact evidence deliberately has no deployment target yet.
  // Preparation binds the chosen project; acceptance happens after deployment.
 }catch{blockers.push("Evidence unreadable");}
}
if(!existsSync(".next/BUILD_ID"))blockers.push("Reviewed production build missing");
if(mode==="enable-ai")blockers.push("This command never authorizes inference. Use preflight:portfolio for current target checks, then obtain separate owner canary approval.");
console.log(JSON.stringify({mode,readOnly:true,status:blockers.length?"BLOCKED":"READY_FOR_AI_DISABLED_DEPLOYMENT_AUTHORIZATION",blockers,acceptanceAfterDeployment:["HTTPS and headers","GitHub callback and session flow","ingress trust","target schema and credentials"],planEvidence:"Recorded verification is not a billing guarantee"},null,2));
process.exitCode=blockers.length?1:0;
