export interface LtiLaunchPayload {
  issuer?: string;
  client_id?: string;
  deployment_id?: string;
  target_link_uri?: string;
  nonce?: string;
  state?: string;
  id_token?: string;
  roles?: string[];
  context?: { id?: string; label?: string; title?: string };
  resource_link?: { id?: string; title?: string };
}

export interface LtiLaunchOptions {
  productionMode?: boolean;
  trustedIssuers?: Set<string>;
}

export interface LtiValidationIssue {
  code: string;
  message: string;
}

export interface LtiValidationResult {
  valid: boolean;
  issues: LtiValidationIssue[];
}

const REQUIRED_FIELDS: Array<keyof LtiLaunchPayload> = [
  "issuer",
  "client_id",
  "deployment_id",
  "target_link_uri",
  "nonce",
  "state",
];

function looksLikeUnsigned(idToken: string | undefined): boolean {
  if (!idToken) return true;
  const parts = idToken.split(".");
  if (parts.length !== 3) return true;
  return parts[2].trim() === "";
}

export function validateLtiLaunch(
  payload: LtiLaunchPayload,
  options: LtiLaunchOptions = {},
): LtiValidationResult {
  const issues: LtiValidationIssue[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!payload[field]) {
      issues.push({ code: "missing_field", message: `Missing field: ${field}` });
    }
  }
  if (!payload.resource_link?.id) {
    issues.push({ code: "missing_resource_link", message: "resource_link.id is required" });
  }
  if (!payload.context?.id) {
    issues.push({ code: "missing_context", message: "context.id is required" });
  }
  if (!Array.isArray(payload.roles) || payload.roles.length === 0) {
    issues.push({ code: "missing_roles", message: "At least one role is required" });
  }
  if (options.productionMode && looksLikeUnsigned(payload.id_token)) {
    issues.push({
      code: "unsigned_id_token",
      message: "id_token must be signed in production mode",
    });
  }
  if (options.trustedIssuers && payload.issuer && !options.trustedIssuers.has(payload.issuer)) {
    issues.push({ code: "untrusted_issuer", message: `Issuer not trusted: ${payload.issuer}` });
  }
  return { valid: issues.length === 0, issues };
}
