import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {sanitizeSecurityDetails,logSecurityEvent} from "../src/server/security-events.ts";
import {sealOAuthVerifier,openOAuthVerifier} from "../src/server/oauth-envelope.ts";
import {resolvePortfolioFreePolicy} from "../src/server/ai-policy.ts";

test("telemetry drops private/raw fields, nested objects and unknown events",()=>{
 const privateValue="PRIVATE_DRAFT_AND_COOKIE_DO_NOT_LOG";
 assert.deepEqual(sanitizeSecurityDetails({error:privateValue,text:privateValue,token:privateValue,email:"synthetic@isolated.test",nested:{text:privateValue},reason:privateValue,status:503,latencyMs:15,author:"tolkien",requestId:"00000000-0000-4000-8000-000000000001"}),{status:503,latencyMs:15,author:"tolkien",requestId:"00000000-0000-4000-8000-000000000001"});
 const previous=console.error;const output:string[]=[];console.error=(v)=>{output.push(String(v));};
 try{for(let n=0;n<1000;n++)logSecurityEvent("security_config_error",{error:privateValue});logSecurityEvent(privateValue,{});}finally{console.error=previous;}
 assert.equal(output.length,1);assert.ok(!output.join("").includes(privateValue));
});

test("OAuth verifier cookie requires purpose-separated authentic unexpired envelope",()=>{
 const old=process.env.GHOSTWRITER_SECURITY_SECRET;process.env.GHOSTWRITER_SECURITY_SECRET=randomBytes(32).toString("hex");
 try{
  const verifier="a".repeat(64),sealed=sealOAuthVerifier(verifier);
  assert.equal(openOAuthVerifier(sealed),verifier);
  assert.equal(openOAuthVerifier(verifier),null);
  assert.equal(openOAuthVerifier(sealed.slice(0,-1)+(sealed.endsWith("0")?"1":"0")),null);
  assert.equal(openOAuthVerifier(sealed+".extra"),null);
  assert.equal(openOAuthVerifier("x".repeat(2049)),null);
  const now=Date.now;Date.now=()=>now()+601000;
  try{assert.equal(openOAuthVerifier(sealed),null);}finally{Date.now=now;}
 }finally{if(old===undefined)delete process.env.GHOSTWRITER_SECURITY_SECRET;else process.env.GHOSTWRITER_SECURITY_SECRET=old;}
});

test("Free policy retains stricter configured account and global ceilings",()=>{
 const result=resolvePortfolioFreePolicy({AI_ENABLED:"true",GHOSTWRITER_RELEASE_PROFILE:"portfolio-free",GROQ_FREE_ORGANIZATION_ID:"org-isolated",GROQ_FREE_PROJECT_ID:"project-isolated",GHOSTWRITER_PROVIDER:"groq",GROQ_MODEL:"openai/gpt-oss-20b",GHOSTWRITER_AI_PRICING_VERSION:"groq-openai-gpt-oss-20b-2026-09-07",GROQ_API_KEY:"isolated-provider-credential",GHOSTWRITER_FINGERPRINT_SECRET:"independent-isolated-fingerprint-material-2026",GHOSTWRITER_ABUSE_STORE_MODE:"supabase",SUPABASE_URL:"http://127.0.0.1",SUPABASE_SERVICE_ROLE_KEY:"isolated-db",SUPABASE_PUBLISHABLE_KEY:"isolated-public",GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_24H:"1",GHOSTWRITER_AI_GLOBAL_GENERATIONS_PER_MINUTE:"1"});
 assert.equal(result.enabled,true);if(!result.enabled)return;
 assert.equal(result.config.accountGenerationsPer24Hours,1);assert.equal(result.config.globalGenerationsPerMinute,1);
});
