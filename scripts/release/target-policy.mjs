// Shared read-only target probe. Missing migrations/functions fail closed.
export const portfolioTargetSql = `begin read only;
set local statement_timeout='3s';
select json_build_object(
 'deploymentId',deployment_id,'profile',release_profile,
 'organization',free_organization_id,'project',free_project_id,
 'reviewValid',free_verified_at is not null and length(free_evidence_reference)>2,
 'controlValid',public.ghostwriter_free_control_valid(),
 'unresolved',(select count(*) from public.ghostwriter_ai_operations where state in ('reserved','dispatched','uncertain')),
 'runtimeTableWrite',has_table_privilege('service_role','public.ghostwriter_ai_operations','INSERT,UPDATE,DELETE,TRUNCATE'),
 'entitlementTableAccess',has_table_privilege('service_role','public.ghostwriter_portfolio_entitlements','SELECT,INSERT,UPDATE,DELETE,TRUNCATE'),
 'boundedRpc',has_function_privilege('service_role','public.ghostwriter_free_reserve_bounded(uuid,uuid,text,text,text,text,jsonb)','EXECUTE'),
 'anonymousRpc',has_function_privilege('service_role','public.ghostwriter_anonymous_reserve_bounded(uuid,text,text,text,text,jsonb,integer)','EXECUTE'),
 'heartbeatRpc',has_function_privilege('service_role','public.ghostwriter_portfolio_heartbeat()','EXECUTE'),
 'cronActive',coalesce((public.ghostwriter_portfolio_health()->>'cronActive')::boolean,false),
 'legacyRpc',has_function_privilege('service_role','public.ghostwriter_free_reserve(uuid,uuid,text,text,text,text)','EXECUTE'),
 'boundedEnrollment',has_function_privilege('service_role','public.ghostwriter_portfolio_entitle(uuid,uuid,integer)','EXECUTE'),
 'legacyEnrollment',has_function_privilege('service_role','public.ghostwriter_free_entitle(uuid,uuid)','EXECUTE'),
 'lifecycleActive',public.ghostwriter_release_active()
) from public.ghostwriter_ai_control where singleton;
commit;`;
export function portfolioTargetErrors(db,target){if(!db||!target)return ['Target policy result missing'];const matches=db.deploymentId===target.deploymentId&&db.profile==='portfolio-free'&&db.organization===target.groqOrganizationId&&db.project===target.groqProjectId;const safe=db.reviewValid===true&&db.controlValid===true&&db.lifecycleActive===true&&db.runtimeTableWrite===false&&db.entitlementTableAccess===false&&db.boundedRpc===true&&db.anonymousRpc===true&&db.heartbeatRpc===true&&db.cronActive===true&&db.legacyRpc===false&&db.boundedEnrollment===true&&db.legacyEnrollment===false&&db.unresolved===0;return matches&&safe?[]:['Target schema/profile/privilege/lifecycle/quota-state mismatch'];}
