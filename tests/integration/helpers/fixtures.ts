/**
 * Shared fixture factories for integration tests.
 */
import { serviceUrl } from "./services.js";

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface CreatedUser {
  id: string;
  email: string;
  role: string;
  tokens: AuthTokens;
}

export interface CreatedLearner {
  id: string;
  name: string;
  parentId: string;
  tenantId: string;
}

let _tenantId: string | null = null;

export async function createTenant(): Promise<{ tenantId: string; adminTokens: AuthTokens }> {
  const email = `admin-${Date.now()}@test.aivo.dev`;
  const password = "TestPass1!";
  const res = await fetch(serviceUrl("identity-svc", "/api/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name: "Test Admin",
      role: "admin",
      tenantName: `Test Tenant ${Date.now()}`,
    }),
  });
  if (!res.ok) throw new Error(`createTenant failed: ${await res.text()}`);
  const data = (await res.json()) as {
    tenantId: string;
    accessToken: string;
    refreshToken?: string;
  };
  _tenantId = data.tenantId;
  return {
    tenantId: data.tenantId,
    adminTokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
  };
}

export function getLastTenantId(): string {
  if (!_tenantId) throw new Error("No tenant created yet");
  return _tenantId;
}

export async function createUser(
  role: "parent" | "teacher" | "therapist" | "caregiver",
  tenantId: string,
  adminToken: string,
): Promise<CreatedUser> {
  const email = `${role}-${Date.now()}@test.aivo.dev`;
  const password = "TestPass1!";
  const res = await fetch(serviceUrl("identity-svc", "/api/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ email, password, name: `Test ${role}`, role, tenantId }),
  });
  if (!res.ok) throw new Error(`createUser(${role}) failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string; accessToken: string; refreshToken?: string };
  return {
    id: data.id,
    email,
    role,
    tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
  };
}

export async function createLearner(
  tenantId: string,
  parentId: string,
  adminToken: string,
): Promise<CreatedLearner> {
  const res = await fetch(serviceUrl("identity-svc", "/api/learners"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      tenantId,
      parentId,
      name: `Test Learner ${Date.now()}`,
      gradeLevel: "3",
      communicationMode: "verbal",
    }),
  });
  if (!res.ok) throw new Error(`createLearner failed: ${await res.text()}`);
  const data = (await res.json()) as {
    id: string;
    name: string;
    tenantId: string;
    parentId: string;
  };
  return { id: data.id, name: data.name, tenantId: data.tenantId, parentId: data.parentId };
}

export async function createBrainState(
  learnerId: string,
  tenantId: string,
  adminToken: string,
): Promise<{ brainStateId: string }> {
  // Trigger the brain clone pipeline.
  const res = await fetch(serviceUrl("brain-svc", "/api/brain/clone"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ learnerId, tenantId }),
  });
  if (!res.ok) throw new Error(`createBrainState failed: ${await res.text()}`);
  const data = (await res.json()) as { brainStateId: string };
  return { brainStateId: data.brainStateId };
}

/** Poll a fetch until predicate returns true or timeout. */
export async function pollUntil<T>(
  fetchFn: () => Promise<T>,
  predicate: (data: T) => boolean,
  options: { maxMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const maxMs = options.maxMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 2_000;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const data = await fetchFn();
    if (predicate(data)) return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("pollUntil timed out");
}
