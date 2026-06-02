/**
 * Canonical audit event shape (Sprint 3). Mirrors audit-svc's
 * `src/types/event.ts`. The chain fields (`prev_hash`, `hash`) are assigned
 * by audit-svc on append, so producers emit an {@link AuditEventInput}
 * without them.
 */
export interface AuditActor {
  id: string;
  role: string;
  ip: string;
  ua: string;
}

export interface AuditEntity {
  type: string;
  id: string;
}

export type AuditOutcome = "success" | "failure";

export interface AuditEvent {
  id: string; // uuidv7
  occurred_at: string; // ISO
  tenant_id: string | null; // null = platform-global
  actor: AuditActor;
  action: string; // dot.namespaced, e.g. "identity.idp.created"
  entity: AuditEntity;
  outcome: AuditOutcome;
  details: Record<string, unknown>; // redacted via allowlist
  request_id: string;
  prev_hash: string;
  hash: string;
}

/** What a producer sends to `POST /events`; chain fields filled server-side. */
export type AuditEventInput = Omit<AuditEvent, "id" | "prev_hash" | "hash"> & {
  id?: string;
};

const HEX = "0123456789abcdef";

/**
 * RFC 9562 UUIDv7 — 48-bit big-endian unix-ms timestamp + 74 random bits,
 * version/variant nibbles set. Time-ordered so audit ids sort by creation,
 * which keeps the hot table's primary index append-friendly.
 */
export function uuidv7(now: number = Date.now(), rand: () => number = Math.random): string {
  const ts = BigInt(now);
  const bytes = new Uint8Array(16);
  // 48-bit timestamp
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  }
  // remaining 10 bytes random
  for (let i = 6; i < 16; i++) bytes[i] = Math.floor(rand() * 256) & 0xff;
  // version 7 in high nibble of byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // variant 10xx in high bits of byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
    if (i === 3 || i === 5 || i === 7 || i === 9) out += "-";
  }
  return out;
}
