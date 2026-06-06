export function adminSvcUrl(): string {
  return process.env.ADMIN_SVC_URL || "http://localhost:3005";
}

export function identitySvcUrl(): string {
  return process.env.IDENTITY_SVC_URL || "http://localhost:3001";
}

export function internalServiceToken(): string | null {
  return process.env.INTERNAL_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_KEY || null;
}
