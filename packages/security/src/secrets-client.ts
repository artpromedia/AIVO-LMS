/**
 * Sprint 12.7 — single entry point for secrets retrieval.
 *
 * Services depend on the `SecretsClient` interface — never directly on
 * Vault, AWS Secrets Manager, or process.env. This lets us swap the
 * backing store without touching call sites.
 *
 * Provider chosen by `SECRETS_PROVIDER`:
 *   - `vault` (default for production):   Vault HTTP API. Reads `VAULT_ADDR`
 *                                         and `VAULT_TOKEN`.
 *   - `aws`  :                            AWS Secrets Manager. Reads
 *                                         `AWS_REGION` (and the default
 *                                         AWS SDK credentials chain).
 *   - `env`  (default in dev / test):     `process.env` direct.
 *
 * The returned client is cached so subsequent calls hit the same instance.
 *
 * See docs/adr/0018-secrets-management.md for the rotation policy and
 * provider trade-offs.
 */

export interface SecretsClient {
  /** Resolve a secret by logical name. Returns null when absent. */
  get(name: string): Promise<string | null>;
  /** Resolve many at once; missing keys map to null. */
  getMany(names: string[]): Promise<Record<string, string | null>>;
  /** Provider identifier for logs / health endpoints. */
  readonly provider: "vault" | "aws" | "env";
}

class EnvSecretsClient implements SecretsClient {
  readonly provider = "env" as const;
  async get(name: string): Promise<string | null> {
    return process.env[name] ?? null;
  }
  async getMany(names: string[]): Promise<Record<string, string | null>> {
    return Object.fromEntries(names.map((n) => [n, process.env[n] ?? null]));
  }
}

class VaultSecretsClient implements SecretsClient {
  readonly provider = "vault" as const;
  private readonly addr: string;
  private readonly token: string;
  private readonly mount: string;
  constructor(addr: string, token: string, mount = "secret") {
    this.addr = addr.replace(/\/$/, "");
    this.token = token;
    this.mount = mount;
  }
  async get(name: string): Promise<string | null> {
    const url = `${this.addr}/v1/${this.mount}/data/${encodeURIComponent(name)}`;
    try {
      const res = await fetch(url, { headers: { "X-Vault-Token": this.token } });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { data?: Record<string, string> } };
      // KV v2 nests the actual payload under data.data; we treat the
      // `value` field as the canonical secret payload (single-value
      // entries are the norm for service tokens / API keys).
      const inner = body?.data?.data ?? {};
      return (inner.value as string | undefined) ?? null;
    } catch {
      return null;
    }
  }
  async getMany(names: string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    await Promise.all(names.map(async (n) => (out[n] = await this.get(n))));
    return out;
  }
}

class AwsSmSecretsClient implements SecretsClient {
  readonly provider = "aws" as const;
  private readonly region: string;
  constructor(region: string) {
    this.region = region;
  }
  async get(name: string): Promise<string | null> {
    // We intentionally avoid pulling @aws-sdk/client-secrets-manager into
    // this lightweight package — instead we sign the request via the
    // existing AWS SDK already present in services that need it. When
    // the SDK is not on the runtime path, fall through to env so dev
    // boots without AWS creds.
    try {
      const mod = await import("@aws-sdk/client-secrets-manager").catch(() => null as any);
      if (!mod) return process.env[name] ?? null;
      const client = new mod.SecretsManagerClient({ region: this.region });
      const cmd = new mod.GetSecretValueCommand({ SecretId: name });
      const res = await client.send(cmd);
      return (res as any).SecretString ?? null;
    } catch {
      return null;
    }
  }
  async getMany(names: string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    await Promise.all(names.map(async (n) => (out[n] = await this.get(n))));
    return out;
  }
}

let _cached: SecretsClient | null = null;

export function getSecretsClient(): SecretsClient {
  if (_cached) return _cached;
  const provider = (process.env.SECRETS_PROVIDER || "env").toLowerCase();
  if (provider === "vault") {
    const addr = process.env.VAULT_ADDR;
    const token = process.env.VAULT_TOKEN;
    if (!addr || !token) {
      // Fall back to env in dev, but warn loudly in production.
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "[secrets] SECRETS_PROVIDER=vault requires VAULT_ADDR and VAULT_TOKEN to be set.",
        );
      }
      _cached = new EnvSecretsClient();
      return _cached;
    }
    _cached = new VaultSecretsClient(addr, token, process.env.VAULT_KV_MOUNT);
    return _cached;
  }
  if (provider === "aws" || provider === "aws-secrets-manager") {
    _cached = new AwsSmSecretsClient(process.env.AWS_REGION || "us-east-1");
    return _cached;
  }
  _cached = new EnvSecretsClient();
  return _cached;
}

/** Test-only — drop the cached client so the next get re-reads env. */
export function _resetSecretsClient(): void {
  _cached = null;
}
