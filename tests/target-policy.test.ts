import test from 'node:test';
import assert from 'node:assert/strict';
import {portfolioTargetErrors} from '../scripts/release/target-policy.mjs';
import {disabledDeploymentErrors} from '../scripts/release/deployment-policy.mjs';

const target={deploymentId:'00000000-0000-4000-8000-000000000001',groqOrganizationId:'org-isolated',groqProjectId:'project-isolated'};
const db={deploymentId:target.deploymentId,profile:'portfolio-free',organization:target.groqOrganizationId,project:target.groqProjectId,reviewValid:true,controlValid:true,lifecycleActive:true,runtimeTableWrite:false,entitlementTableAccess:false,boundedRpc:true,anonymousRpc:true,heartbeatRpc:true,cronActive:true,legacyRpc:false,boundedEnrollment:true,legacyEnrollment:false,unresolved:0};
test('target preflight requires current bounded grants and live lifecycle, never legacy permission',()=>{
 assert.deepEqual(portfolioTargetErrors(db,target),[]);
 for(const [key,value] of Object.entries(db)){
  const mutation=typeof value==='boolean'?!value:typeof value==='number'?1:'different';
  assert.ok(portfolioTargetErrors({...db,[key]:mutation},target).length,key);
  const missing={...db};delete missing[key as keyof typeof db];
  assert.ok(portfolioTargetErrors(missing,target).length,'missing '+key);
 }
 assert.ok(portfolioTargetErrors(null,target).length);
});
test('AI-disabled preparation does not require an unperformed canary or deployed artifact',()=>{
 const now=Date.UTC(2026,8,15),environment={AI_ENABLED:'false',GHOSTWRITER_TARGET_ID:'prj_isolatedverification'};
 const preparation={target:environment.GHOSTWRITER_TARGET_ID,verifiedAt:new Date(now).toISOString(),hostingFreePlanVerified:true,noPaidAddonsVerified:true,credentialIsolationVerified:true,privacyApproved:true,operatorReady:true};
 assert.deepEqual(disabledDeploymentErrors(environment,preparation,now),[]);
 for(const key of ['hostingFreePlanVerified','noPaidAddonsVerified','credentialIsolationVerified','privacyApproved','operatorReady'])assert.ok(disabledDeploymentErrors(environment,{...preparation,[key]:false},now).length);
 for(const override of [{AI_ENABLED:'true'},{GROQ_API_KEY:'synthetic-not-allowed'},{GHOSTWRITER_TARGET_ID:'example'}])assert.ok(disabledDeploymentErrors({...environment,...override},preparation,now).length);
 assert.ok(disabledDeploymentErrors(environment,preparation,now+86400001).length);
});
