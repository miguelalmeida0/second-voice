import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolvePortfolioFreePolicy,resolveLiveAiPolicy,resolveAiPolicyConfig} from "../src/server/ai-policy.ts";
import {createAuthClient} from "../src/server/auth-session.ts";
const environment={AI_ENABLED:"true",GHOSTWRITER_RELEASE_PROFILE:"portfolio-free",GROQ_FREE_ORGANIZATION_ID:"org-isolated",GROQ_FREE_PROJECT_ID:"project-isolated",GHOSTWRITER_PROVIDER:"groq",GROQ_MODEL:"openai/gpt-oss-20b",GHOSTWRITER_AI_PRICING_VERSION:"groq-openai-gpt-oss-20b-2026-09-07",GROQ_API_KEY:"synthetic-never-a-live-key",GHOSTWRITER_FINGERPRINT_SECRET:"synthetic-isolated-fingerprint-secret-at-least-32",GHOSTWRITER_ABUSE_STORE_MODE:"supabase",SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_PUBLISHABLE_KEY:"synthetic-public",SUPABASE_SERVICE_ROLE_KEY:"synthetic-service"};
test("Free resource policy is explicit and does not enable paid mode",()=>{
 const result=resolvePortfolioFreePolicy(environment);assert.equal(result.enabled,true);
 if(!result.enabled)return;
 assert.equal(result.config.accountGenerationsPer24Hours,3);assert.equal(result.config.accountGenerationsPerMinute,3);
 assert.equal(result.config.globalConcurrency,1);assert.equal(result.config.globalGenerationsPerMinute,6);assert.equal(result.config.anonymousGlobalDailyLimit,60);
 assert.equal(result.config.maximumReservationMicroUsd,750,"Estimate retained, never fabricated as zero price");
 assert.equal(resolveLiveAiPolicy().enabled,false);
 for(const override of [{AI_ENABLED:"false"},{GHOSTWRITER_RELEASE_PROFILE:"paid"},{GROQ_FREE_PROJECT_ID:""},{VERCEL_ENV:"preview"},{NODE_ENV:"production",GHOSTWRITER_E2E_FIXTURE_MODE:"true"},{GROQ_MODEL:"premium"},{GHOSTWRITER_ANONYMOUS_GLOBAL_DAILY_LIMIT:"61"}])assert.equal(resolvePortfolioFreePolicy({...environment,...override}).enabled,false);
});
test("expired paid-dollar review blocks paid policy, not the independently guarded Free profile",t=>{
 t.mock.timers.enable({apis:["Date"],now:Date.UTC(2026,8,20)});
 assert.equal(resolveAiPolicyConfig(environment).enabled,false);
 assert.equal(resolvePortfolioFreePolicy(environment).enabled,true);
});
test("Free review references accept exact dashboard labels but reject malformed metadata",()=>{
 assert.equal(resolvePortfolioFreePolicy({...environment,GROQ_FREE_ORGANIZATION_ID:"Personal",GROQ_FREE_PROJECT_ID:"Default Project"}).enabled,true);
 for(const project of [" Default Project","Default Project ","bad\nreference","bad'reference","ab","a".repeat(121)])assert.equal(resolvePortfolioFreePolicy({...environment,GROQ_FREE_PROJECT_ID:project}).enabled,false);
});
test("Supabase PKCE generation stores only the verifier and requests minimal GitHub scopes",async()=>{
 const original={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
 Object.assign(process.env,{SUPABASE_URL:environment.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:environment.SUPABASE_PUBLISHABLE_KEY});
 try{
  const stored=new Map<string,string>();
  const client=createAuthClient({getItem:k=>stored.get(k)??null,setItem:(k,v)=>{stored.set(k,v);},removeItem:k=>{stored.delete(k);}});
  const result=await client.auth.signInWithOAuth({provider:"github",options:{scopes:"user:email",redirectTo:"http://127.0.0.1:4003/api/ghostwriter/auth/callback",skipBrowserRedirect:true}});
  assert.equal(result.error,null);assert.ok(result.data.url);
  const url=new URL(result.data.url!);assert.equal(url.origin,environment.SUPABASE_URL);assert.equal(url.searchParams.get("scopes"),"user:email");
  assert.equal(url.searchParams.get("code_challenge_method"),"s256");
  assert.ok([...stored].some(([k,v])=>k.endsWith("code-verifier")&&v.length>=43));
 }finally{for(const [k,v] of Object.entries(original)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test("Portfolio reliability removes lifetime/calendar shutdowns while preserving PKCE Auth",()=>{
 const sql=readFileSync("supabase/migrations/202609150001_ghostwriter_portfolio_reliability.sql","utf8");
 for(const pattern of ["anonymous_day_limit","global_day_limit","month_budget","pg_advisory_xact_lock","ghostwriter_portfolio_entitlements","ghostwriter_portfolio_heartbeat"])assert.ok(sql.includes(pattern),pattern);
 assert.ok(!sql.includes("'account_lifetime_limit'"));assert.ok(!/free_verified_until>clock_timestamp\(\)/.test(sql));assert.ok(!/retire_at>clock_timestamp\(\)/.test(sql));
 const callback=readFileSync("src/app/api/ghostwriter/auth/callback/route.ts","utf8");assert.ok(callback.includes("authenticateAiRequest"));assert.ok(callback.includes("exchangeCodeForSession"));assert.ok(!callback.includes('searchParams.get("next")'));
});
