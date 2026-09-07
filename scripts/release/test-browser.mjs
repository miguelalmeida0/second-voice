import {chromium} from "@playwright/test";
import {spawnSync} from "node:child_process";
try{
 const browser=await chromium.launch();await browser.close();
 const result=spawnSync("npm",["run","test:e2e"],{stdio:"inherit"});
 process.exitCode=result.status??1;
}catch(error){
 if(/bootstrap_check_in|MachPortRendezvous|Permission denied|operation not permitted/.test(String(error))){
  console.error("BROWSER_BLOCKED: native browser bootstrap permission denied");
  process.exitCode=2;
 }else throw error;
}
