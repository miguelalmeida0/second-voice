// Isolated test process only. No runtime bypass flag or alternate production route.
import http from "node:http";
import {execFile} from "node:child_process";
import {executeGovernedRewrite} from "../../src/server/ai-gateway.ts";
import {resolveAiPolicyConfig,resolvePortfolioFreePolicy} from "../../src/server/ai-policy.ts";
const [container,profile] = process.argv.slice(2);
const free=profile==="portfolio-free";
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const sql = statement => new Promise((resolve, reject) => {
 execFile("docker", ["exec", container, "psql", "-U", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", statement], {maxBuffer:32768,timeout:90000}, (error, stdout) => error ? reject(new Error("Fixture database unavailable")) : resolve(stdout.trim()));
});
const resolved = (free?resolvePortfolioFreePolicy:resolveAiPolicyConfig)({GHOSTWRITER_RELEASE_PROFILE:"portfolio-free",GROQ_FREE_ORGANIZATION_ID:"org-isolated",GROQ_FREE_PROJECT_ID:"project-isolated",AI_ENABLED:"true",GHOSTWRITER_PROVIDER:"groq",GROQ_MODEL:"openai/gpt-oss-20b",GHOSTWRITER_AI_PRICING_VERSION:"groq-openai-gpt-oss-20b-2026-09-07",GROQ_API_KEY:"synthetic-provider-never-live",GHOSTWRITER_FINGERPRINT_SECRET:"synthetic-fingerprint-for-isolated-proof-only",GHOSTWRITER_ABUSE_STORE_MODE:"supabase",SUPABASE_URL:"http://127.0.0.1",SUPABASE_SERVICE_ROLE_KEY:"synthetic-db",SUPABASE_PUBLISHABLE_KEY:"synthetic-public"});
if (!resolved.enabled) throw new Error("Test policy unavailable: " + resolved.reason);
const policy={...resolved.config,maximumReservationMicroUsd:free?750:10000,...(free?{profile:"portfolio-free",freeOrganizationId:"org-isolated",freeProjectId:"project-isolated"}:{})};
let calls=0,active=0,maximumActive=0,held=true;
let failTransport=false,failDatabase=false;
const releases=[];
// Replace all outbound fetches in this process. The real provider serializer and
// response validator execute, but no network request can reach an AI provider.
globalThis.fetch=async (url,options)=>{
 if(String(url)!==policy.providerUrl) throw new Error("Outbound access blocked by fixture");
 const body=JSON.parse(options.body);
 if(body.model!==policy.model || body.max_completion_tokens!==2000 || options.redirect!=="error") throw new Error("Unexpected provider contract");
 calls++;active++;maximumActive=Math.max(maximumActive,active);
 if(held) await new Promise(resolve=>releases.push(resolve));
 active--;
 if(failTransport)throw new Error("Synthetic acceptance then disconnect");
 return Response.json({id:"synthetic-provider-"+calls,choices:[{message:{content:"The lamp remained lit beside the road."},finish_reason:"stop"}],usage:{prompt_tokens:100,completion_tokens:100}});
};
const transitions={
 markDispatched:(id,account)=>sql(`select public.ghostwriter_ai_mark_dispatched(${quote(id)},${quote(account)});`).then(v=>v==="t"),
 failBeforeDispatch:(id,account,reason)=>sql(`select public.ghostwriter_ai_fail_before_dispatch(${quote(id)},${quote(account)},${quote(reason)});`).then(v=>v==="t"),
 markUncertain:(id,account,reason)=>sql(`select public.ghostwriter_ai_mark_uncertain(${quote(id)},${quote(account)},${quote(reason)});`).then(v=>v==="t"),
 settleSuccess:o=>sql(`select public.ghostwriter_ai_settle_success(${quote(o.operationId)},${quote(o.accountId)},${o.actualMicroUsd},${quote(o.providerRequestId)},${quote(JSON.stringify(o.result))}::jsonb);`).then(v=>v==="t")
};
const server=http.createServer(async(req,res)=>{
 if(req.url==="/stats"){res.end(JSON.stringify({calls,active,maximumActive}));return;}
 if(req.url==="/release"){held=false;releases.splice(0).forEach(r=>r());res.end("{}");return;}
 if(req.url==="/disconnect"){failTransport=true;res.end("{}");return;}
 if(req.url==="/database-outage"){failDatabase=true;res.end("{}");return;}
 const n=Number(req.url.slice(1));
 if(!Number.isSafeInteger(n)||n<1||n>1000){res.writeHead(400).end();return;}
 const account="00000000-0000-0000-0000-"+String(n%25+1).padStart(12,"0");
 let reason=null;
 const ledger={...transitions,reserve:async r=>{
  if(failDatabase)throw new Error("Synthetic database outage");
  const result=JSON.parse(await sql(free
   ? `select public.ghostwriter_free_reserve(${quote(account)},${quote(account)},${quote(r.idempotencyKey)},${quote(r.requestFingerprint)},'org-isolated','project-isolated');`
   : `select public.fixture_reserve(${quote(account)},${quote(account)},${quote(r.idempotencyKey)},${quote(r.requestFingerprint)},${quote(policy.pricingVersion)},10000,25,10,5,3,1000,10,1000,20000,20000,20000);`));
  reason=result.reason??null;
  return {...result,operationId:result.operation_id};
 }};
 try{
  const result=await executeGovernedRewrite(new Request("http://isolated/api/ghostwriter",{headers:{"idempotency-key":"gateway-race-"+String(n).padStart(6,"0")}}),{author:"tolkien",mode:"author",outcome:"clarity",mood:50,text:"A lamp beside the road."},{},{ledger,resolvePolicy:()=>({enabled:true,reason:null,config:policy}),authenticate:async()=>({ok:true,identity:{accountId:account,sessionId:account,emailVerified:true}}),killSwitchEnabled:()=>true,finalize:async()=>({artifactToken:null,error:null,moodLabel:"synthetic",rewrite:"The lamp remained lit beside the road.",shortId:null,status:200})});
  res.end(JSON.stringify({status:result.status,operationId:result.operationId,reason}));
 }catch{res.writeHead(500).end('{"error":"fixture"}');}
});
server.listen(0,"127.0.0.1",()=>process.send?.(server.address().port));
