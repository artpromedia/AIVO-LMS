export function adminSvcUrl(): string {
  return process.env.ADMIN_SVC_URL || "http://localhost:3005";
}

export function identitySvcUrl(): string {
  return process.env.IDENTITY_SVC_URL || "http://localhost:3001";
}

export function integrationSvcUrl(): string {
  return process.env.INTEGRATION_SVC_URL || "http://localhost:3068";
}

export function dataGovernanceSvcUrl(): string {
  return process.env.DATA_GOVERNANCE_SVC_URL || "http://localhost:3070";
}

export function billingSvcUrl(): string {
  return process.env.BILLING_SVC_URL || "http://localhost:3009";
}

export function internalServiceToken(): string | null {
  return process.env.INTERNAL_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_KEY || null;
}
