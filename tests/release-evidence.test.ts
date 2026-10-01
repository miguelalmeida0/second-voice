import assert from "node:assert/strict";
import test from "node:test";
import {evidenceIdentityErrors,sameSource} from "../scripts/release/source-identity.mjs";

const source={sourceCommit:"commit",sourceTreeSha256:"tree",workingDiffSha256:"diff",buildId:"build",buildSha256:"artifact"};
const now=Date.UTC(2026,8,7,12);
const evidence={...source,verifiedAt:new Date(now).toISOString()};

test("release evidence rejects changed commit, staged or untracked source and build",()=>{
 assert.deepEqual(evidenceIdentityErrors(evidence,source,now),[]);
 for(const field of Object.keys(source)){
  assert.deepEqual(evidenceIdentityErrors(evidence,{...source,[field]:"changed"},now),["Evidence mismatch: "+field]);
 }
 assert.equal(sameSource(source,{...source,sourceTreeSha256:"new-untracked-file"}),false);
 assert.equal(sameSource(source,{...source,workingDiffSha256:"staged-change"}),false);
 assert.equal(sameSource(source,{...source,buildId:"new-build"}),true);
});

test("release evidence cannot be missing, future-dated or older than one day",()=>{
 for(const verifiedAt of [undefined,"invalid",new Date(now+1).toISOString(),new Date(now-86400001).toISOString()]){
  assert.ok(evidenceIdentityErrors({...evidence,verifiedAt},source,now).includes("Evidence timestamp invalid or expired"));
 }
 assert.ok(evidenceIdentityErrors(evidence,{...source,buildId:null},now).includes("Evidence mismatch: buildId"));
});
