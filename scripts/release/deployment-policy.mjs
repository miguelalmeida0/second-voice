// Preparation only: does not deploy, enable AI, or replace target acceptance.
export function disabledDeploymentErrors(environment, preparation, now=Date.now()) {
 const errors=[];
 if(environment.AI_ENABLED!=='false')errors.push('AI-disabled deployment requires AI_ENABLED=false');
 if(environment.GROQ_API_KEY)errors.push('AI-disabled deployment must omit the inference credential');
 if(!/^prj_[A-Za-z0-9]{10,80}$/.test(environment.GHOSTWRITER_TARGET_ID??''))errors.push('Exact Vercel project identity required');
 if(!preparation || preparation.target!==environment.GHOSTWRITER_TARGET_ID)return [...errors,'Target preparation identity mismatch'];
 const time=Date.parse(preparation.verifiedAt);
 if(!Number.isFinite(time)||time>now||now-time>86400000)errors.push('Target preparation expired or malformed');
 for(const name of ['hostingFreePlanVerified','noPaidAddonsVerified','credentialIsolationVerified','privacyApproved','operatorReady']){
  if(preparation[name]!==true)errors.push('Preparation missing: '+name);
 }
 return errors;
}
