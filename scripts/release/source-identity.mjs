import {spawnSync} from "node:child_process";
import {readFileSync,existsSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
export function sourceIdentity(){
 const git=args=>{const r=spawnSync("git",args,{encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024});if(r.status!==0)throw new Error("Source inventory unavailable");return r.stdout;};
 const paths=git(["ls-files","-z","--cached","--others","--exclude-standard"]).split("\0").filter(p=>p&&!p.startsWith(".tmp/"));
 const digest=createHash("sha256");
 for(const path of [...new Set(paths)].sort()){
  digest.update(path+"\0");
  // Preserve tracked deletions in the inventory, rather than silently omitting them.
  if(!existsSync(path)){digest.update("deleted\0");continue;}
  const contents=readFileSync(path);digest.update("file:"+contents.length+"\0");digest.update(contents);
 }
 const buildId=existsSync(".next/BUILD_ID")?readFileSync(".next/BUILD_ID","utf8").trim():null;
 let buildSha256=null;
 if(buildId){
  const walk=dir=>existsSync(dir)?readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir+"/"+entry.name):[dir+"/"+entry.name]):[];
  // Production runtime output only: a concurrent dev server may write .next/dev
  // and caches, which are not part of the deployed build.
  const artifacts=[...walk(".next/server"),...walk(".next/static"),...readdirSync(".next").filter(p=>p.endsWith(".json")||p==="BUILD_ID").map(p=>".next/"+p)];
  const build=createHash("sha256");
  for(const path of artifacts.sort()){const bytes=readFileSync(path);build.update(path+"\0"+bytes.length+"\0");build.update(bytes);}
  buildSha256=build.digest("hex");
 }
 return {sourceCommit:git(["rev-parse","HEAD"]).trim(),sourceTreeSha256:digest.digest("hex"),workingDiffSha256:createHash("sha256").update(git(["diff","HEAD","--binary"])).digest("hex"),buildId,buildSha256};
}
export function sameSource(a,b){
 return ["sourceCommit","sourceTreeSha256","workingDiffSha256"].every(field=>a[field]&&a[field]===b[field]);
}
export function evidenceIdentityErrors(evidence,current,now=Date.now()){
 const errors=[];
 for(const field of ["sourceCommit","sourceTreeSha256","workingDiffSha256","buildId","buildSha256"])
  if(!current[field]||evidence[field]!==current[field])errors.push("Evidence mismatch: "+field);
 const timestamp=Date.parse(evidence.verifiedAt);
 if(!Number.isFinite(timestamp)||timestamp>now||now-timestamp>86400000)errors.push("Evidence timestamp invalid or expired");
 return errors;
}
