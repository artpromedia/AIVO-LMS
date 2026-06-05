/**
 * Server-side enterprise feature flag reader (Sprint G + H).
 *
 * Mirrors the env names in
 * infra/k8s/base/enterprise/feature-flags-configmap.yaml so BFF routes
 * can decide whether to fan out to the corresponding service or keep
 * using the in-app mock store. The check is cheap and uncached
 * (process.env lookup) so an operator flipping the ConfigMap + rolling
 * the pod takes effect immediately.
 */
function readBool(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const enterpriseFlags = {
  responsibleAiGuardrails: () => readBool("AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS"),
  dataGovernanceCenter: () => readBool("AIVO_FEATURE_DATA_GOVERNANCE_CENTER"),
  sisSync: () => readBool("AIVO_FEATURE_SIS_SYNC"),
  lti13: () => readBool("AIVO_FEATURE_LTI_13"),
  delegatedAdminRbacV2: () => readBool("ADMIN_ENTERPRISE_DELEGATED_ADMIN_RBAC_V2"),
  // The default for this flag was flipped to true in the
  // ConfigMap (see Sprint C). The reader still defaults to false so a
  // missing env doesn't change behavior elsewhere in BFF land.
  advancedContentGenerators: () => readBool("AIVO_FEATURE_ADVANCED_CONTENT_GENERATORS"),
  // Sprint 1 (Enterprise Identity) — gates the SSO/SCIM/MFA admin UI and the
  // district-facing identity surfaces. Defaults false per the sprint spec.
  enterpriseIdentity: () => readBool("AIVO_FEATURE_ENTERPRISE_IDENTITY"),
};
