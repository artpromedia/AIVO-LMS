/**
 * Admin route IP allowlist (Sprint 4).
 *
 * Reads `ADMIN_IP_ALLOWLIST` (comma-separated CIDR list) and rejects requests
 * to `/api/admin/**` and `/api/admin-svc/**` whose client IP is not in the
 * allowlist. Empty / unset = off (so dev environments stay open). Trusts
 * the first hop of `x-forwarded-for` since both services sit behind a proxy.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface ParsedCidr {
  raw: string;
  family: 4 | 6;
  // For v4 we keep an integer + mask; for v6 we keep a BigInt + mask.
  v4Net?: number;
  v4Mask?: number;
  v6Net?: bigint;
  v6Mask?: bigint;
}

function parseV4(addr: string): number | null {
  const parts = addr.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n * 256) + o;
  }
  return n >>> 0;
}

function parseV6(addr: string): bigint | null {
  // Accept full and compressed forms. Reject embedded IPv4 mappings other
  // than ::ffff:a.b.c.d to keep the parser tight.
  if (addr.includes(".")) {
    const m = addr.match(/^(.*:)([\d.]+)$/);
    if (!m) return null;
    const v4 = parseV4(m[2]);
    if (v4 === null) return null;
    addr = m[1] + ((v4 >> 16) & 0xffff).toString(16) + ":" + (v4 & 0xffff).toString(16);
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const fillCount = 8 - left.length - right.length;
  if (fillCount < 0) return null;
  const groups = [...left, ...new Array(fillCount).fill("0"), ...right];
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

function parseCidr(raw: string): ParsedCidr | null {
  const [addr, maskStr] = raw.trim().split("/");
  if (!addr) return null;
  if (addr.includes(":")) {
    const net = parseV6(addr);
    if (net === null) return null;
    const mask = maskStr === undefined ? 128 : Number(maskStr);
    if (!Number.isInteger(mask) || mask < 0 || mask > 128) return null;
    const maskBits = mask === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - mask)) - 1n);
    return { raw, family: 6, v6Net: net & maskBits, v6Mask: maskBits };
  }
  const net = parseV4(addr);
  if (net === null) return null;
  const mask = maskStr === undefined ? 32 : Number(maskStr);
  if (!Number.isInteger(mask) || mask < 0 || mask > 32) return null;
  const maskBits = mask === 0 ? 0 : (~((1 << (32 - mask)) - 1)) >>> 0;
  return { raw, family: 4, v4Net: (net & maskBits) >>> 0, v4Mask: maskBits };
}

export function parseAllowlist(env: string | undefined): ParsedCidr[] {
  if (!env || !env.trim()) return [];
  return env
    .split(",")
    .map((s) => parseCidr(s))
    .filter((c): c is ParsedCidr => c !== null);
}

export function ipMatches(allowlist: ParsedCidr[], ip: string): boolean {
  if (allowlist.length === 0) return true;
  // Strip an IPv6 zone or v4 mapping wrapper.
  const normalized = ip.replace(/^::ffff:/, "");
  if (normalized.includes(":")) {
    const n = parseV6(normalized);
    if (n === null) return false;
    return allowlist.some((c) => c.family === 6 && (n & c.v6Mask!) === c.v6Net!);
  }
  const n = parseV4(normalized);
  if (n === null) return false;
  return allowlist.some((c) => c.family === 4 && ((n & c.v4Mask!) >>> 0) === c.v4Net);
}

function clientIp(req: FastifyRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const first = (Array.isArray(xff) ? xff[0] : xff).split(",")[0]?.trim();
    if (first) return first;
  }
  return (req.ip || "").trim();
}

/**
 * Register the admin IP allowlist as an `onRequest` hook. The hook only
 * fires for URLs starting with one of the configured prefixes so non-admin
 * routes are unaffected.
 */
export function registerAdminIpAllowlist(
  app: FastifyInstance,
  opts: { envVar?: string; prefixes?: string[] } = {},
): void {
  const allowlist = parseAllowlist(process.env[opts.envVar ?? "ADMIN_IP_ALLOWLIST"]);
  if (allowlist.length === 0) return; // off
  const prefixes = opts.prefixes ?? ["/api/admin/", "/api/admin-svc/"];
  app.log.info(
    { cidrs: allowlist.map((c) => c.raw), prefixes },
    "admin ip allowlist enforcing",
  );
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url || "";
    if (!prefixes.some((p) => url.startsWith(p))) return;
    const ip = clientIp(req);
    if (!ipMatches(allowlist, ip)) {
      req.log.warn({ ip, url }, "admin ip allowlist rejected");
      return reply.status(403).send({ error: "Forbidden", code: "IP_NOT_ALLOWED" });
    }
  });
}
