import test from "node:test";import assert from "node:assert/strict";import{parsePortfolioAllowance,portfolioAccessView}from"../src/lib/portfolio-access.ts";
test("anonymous recruiter access is immediately usable",()=>{const a={remaining:3,todayRemaining:3,available:true},v=portfolioAccessView({status:"anonymous",allowance:a},true,true);assert.equal(v.canGenerate,true);assert.match(v.message,/3 free rewrites left in your rolling 24-hour allowance/);});
test("anonymous exhaustion is a clear daily limit",()=>{const v=portfolioAccessView({status:"anonymous",allowance:{remaining:0,todayRemaining:0,available:true}},true,true);assert.equal(v.canGenerate,false);assert.match(v.message,/used for now/);assert.match(v.message,/24-hour window/);});
test("authenticated access renews after rolling window",()=>{const e=portfolioAccessView({status:"authenticated",allowance:{remaining:0,todayRemaining:0,available:true}},true,true);assert.equal(e.canGenerate,false);assert.match(e.message,/free rewrites in the last 24 hours/);assert.doesNotMatch(e.message,/lifetime/);const r=portfolioAccessView({status:"authenticated",allowance:{remaining:3,todayRemaining:3,available:true}},true,true);assert.equal(r.canGenerate,true);});
test("unavailable states fail closed",()=>{assert.equal(portfolioAccessView({status:"checking"},true,true).canGenerate,false);assert.equal(portfolioAccessView({status:"unavailable"},true,true).canGenerate,false);assert.equal(portfolioAccessView({status:"anonymous",allowance:{remaining:3,todayRemaining:3,available:false}},true,true).canGenerate,false);});
test("allowance parser stays bounded",()=>{assert.deepEqual(parsePortfolioAllowance({remaining:3,todayRemaining:3,available:true}),{remaining:3,todayRemaining:3,available:true});for(const v of[null,{}, {remaining:11,available:true},{remaining:3,todayRemaining:11,available:true}])assert.equal(parsePortfolioAllowance(v),null);});

// Production's database policy grants five starts per rolling 24 hours.
// The UI validates the response shape; the server alone enforces admission.
test("production allowances above three remain usable without increasing server quotas", () => {
 for (const remaining of [4, 5]) {
  const allowance = parsePortfolioAllowance({ remaining, todayRemaining: remaining, available: true, globalLimited: false });
  assert.ok(allowance);
  for (const status of ["anonymous", "authenticated"] as const) {
   assert.equal(portfolioAccessView({ status, allowance }, true, true).canGenerate, true);
   assert.equal(portfolioAccessView({ status, allowance: {...allowance, available: false} }, true, true).canGenerate, false);
  }
 }
});
