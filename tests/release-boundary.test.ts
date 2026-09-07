import test from "node:test";
import assert from "node:assert/strict";
import {signingKey,rejectAmbiguousSecrets} from "../src/server/signing-purpose.ts";
import {authenticateAiRequest} from "../src/server/ai-auth.ts";
import {readAuthCookie} from "../src/server/auth-session.ts";
import {calculateMaximumAiCostMicroUsd,calculateActualAiCostMicroUsd,resolveLiveAiPolicy,conservativeInputTokenUpperBound} from "../src/server/ai-policy.ts";
test("HKDF signing purposes and rotations are disjoint",()=>{
 const keys=["gw.session","gw.csrf","gw.challenge","gw.artifact"].map(p=>signingKey("synthetic-root".repeat(4),p).toString("hex"));
 assert.equal(new Set(keys).size,4);
 assert.notEqual(keys[0],signingKey("rotated-synthetic-root".repeat(4),"gw.session").toString("hex"));
 assert.throws(()=>signingKey("synthetic","unknown"));
});
test("misspelled and reused signing credentials fail closed",()=>{
 assert.throws(()=>rejectAmbiguousSecrets({GHOSTWRITTER_SECURITY_SECRET:"synthetic"}));
 assert.throws(()=>rejectAmbiguousSecrets({GHOSTWRITER_SECURITY_SECRET:"synthetic",GROQ_API_KEY:"synthetic"}));
 assert.throws(()=>rejectAmbiguousSecrets({GHOSTWRITER_SECURITY_SECRET:" synthetic ",GROQ_API_KEY:"synthetic"}));
});
test("unverified transport billing contract cannot enable live AI",()=>assert.equal(resolveLiveAiPolicy().enabled,false));
test("invalid money inputs never create capacity",()=>{
 for(const n of [-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>calculateMaximumAiCostMicroUsd({maxInputTokens:n,maxOutputTokens:0}));
  assert.equal(calculateActualAiCostMicroUsd({promptTokens:n,completionTokens:0}),null);
 }
 assert.equal(calculateMaximumAiCostMicroUsd({maxInputTokens:2000,maxOutputTokens:2000}),750);
});
test("Unicode byte heuristic is treated as a heuristic, never live authorization",()=>{
 for(const text of ["😀".repeat(1000),"e\u0301".repeat(1000),"a".repeat(10000),"\n ".repeat(2000),"const x = '<script>'"]){
  assert.ok(conservativeInputTokenUpperBound("system",text)>=Buffer.byteLength(text));
  assert.equal(resolveLiveAiPolicy().enabled,false);
 }
});
test("duplicate cookies and missing or oversized bearer credentials reject",async()=>{
 const name=process.env.NODE_ENV==="production"?"__Host-gw-access":"gw-access";
 assert.equal(readAuthCookie(new Request("https://local",{headers:{cookie:name+"=a; "+name+"=b"}}),"access"),null);
 for(const headers of [{},{authorization:"Bearer "+"a".repeat(9000)},{authorization:"invalid"}] as HeadersInit[]){
  const result=await authenticateAiRequest(new Request("https://local",{headers}));
  assert.equal(result.ok,false);
 }
});
