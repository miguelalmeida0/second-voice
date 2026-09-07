import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {mkdirSync,readFileSync} from "node:fs";
mkdirSync(".tmp/release",{recursive:true});
const result=spawnSync("docker",["run","--rm","--network","none","-v",resolve(".")+":/repo:ro","-v",resolve(".tmp/release")+":/evidence","zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f","git","--gitleaks-ignore-path=/repo/.gitleaksignore","--redact","--no-banner","--report-format=json","--report-path=/evidence/secrets.json","/repo"],{stdio:"inherit"});
process.exitCode=result.status??1;
if(result.status===0){
 const diff=spawnSync("git",["diff","HEAD","--binary"],{encoding:"utf8",maxBuffer:16*1024*1024});
 const listing=spawnSync("git",["ls-files","--others","--exclude-standard"],{encoding:"utf8"});
 if(diff.status!==0||listing.status!==0)throw new Error("Secret scan source inventory unavailable");
 const patch=diff.stdout;
 const untracked=listing.stdout.trim().split("\n").filter(Boolean);
 const additions=untracked.map(f=>f+"\n"+readFileSync(f,"utf8")).join("\n");
 const working=spawnSync("docker",["run","--rm","-i","--network","none","-v",resolve(".tmp/release")+":/evidence","zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f","stdin","--redact","--no-banner","--report-format=json","--report-path=/evidence/working-secrets.json"],{input:patch+"\n"+additions,encoding:"utf8"});
 console.log(working.stdout??"");console.error(working.stderr??"");process.exitCode=working.status??1;
}
