/**
 * Real antivirus scanning for IEP PDF uploads (Decision D6 follow-up).
 *
 * The Sprint C-10 hardening (`assertPdfSafety`) is structural defense-in-depth
 * — magic bytes, content-type, active-content rejection — explicitly NOT a
 * substitute for AV. This module is the named follow-up: a ClamAV client that
 * streams the uploaded bytes to a `clamd` daemon over its INSTREAM protocol and
 * returns a clean / infected verdict.
 *
 * Deployment model (ops-friendly, zero-config-safe):
 *   - No `CLAMAV_HOST` set  → scanning is SKIPPED. The structural hardening
 *     still runs, so the service behaves exactly as before AV was introduced.
 *     This keeps environments without a clamd sidecar working.
 *   - `CLAMAV_HOST` set      → every upload is scanned. A FOUND verdict rejects
 *     the file (422). A scanner error/timeout FAILS CLOSED in production
 *     (`NODE_ENV=production`) or whenever `IEP_AV_REQUIRED=true` — we never
 *     store a file we couldn't verify. In dev without the flag, a scanner
 *     error is logged and the upload proceeds.
 *
 * The INSTREAM wire format (clamd docs): send `zINSTREAM\0`, then for each
 * chunk a 4-byte big-endian length prefix followed by the chunk bytes, then a
 * terminating zero-length prefix; clamd replies `stream: OK\0` or
 * `stream: <signature> FOUND\0` (or a `... ERROR` line on a problem).
 *
 * Pure-ish + injectable: `scanBuffer` accepts a `connect` factory so the unit
 * tests drive a fake clamd with no real socket, and the env is read only when
 * options are omitted.
 */
import net from "node:net";

export type AvScanVerdict =
  | { status: "clean" }
  | { status: "infected"; signature: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; reason: string };

/** The minimal socket surface `scanBuffer` needs — `net.Socket` satisfies it,
 *  and the tests supply a tiny fake implementing the same shape. */
export interface AvSocket {
  write(data: Buffer): void;
  end(data?: Buffer): void;
  destroy(): void;
  on(event: "data", listener: (chunk: Buffer) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "close", listener: () => void): this;
  setTimeout(ms: number, listener: () => void): void;
}

export interface AvScanOptions {
  /** clamd host; defaults to `process.env.CLAMAV_HOST`. */
  host?: string;
  /** clamd port; defaults to `process.env.CLAMAV_PORT` or 3310. */
  port?: number;
  /** Overall scan timeout; defaults to `process.env.CLAMAV_TIMEOUT_MS` or 15000. */
  timeoutMs?: number;
  /** INSTREAM chunk size in bytes (default 64 KiB). */
  chunkSize?: number;
  /** Connection factory (injectable for tests). Defaults to `net.connect`. */
  connect?: (port: number, host: string) => AvSocket;
}

const DEFAULT_PORT = 3310;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CHUNK = 64 * 1024;

function resolveHost(opts: AvScanOptions): string | undefined {
  return opts.host ?? process.env.CLAMAV_HOST ?? undefined;
}

/**
 * Stream `buffer` to clamd via INSTREAM and resolve a verdict. Never rejects —
 * transport problems resolve to `{ status: "error" }` so the caller's policy
 * decides whether to fail open or closed.
 */
export function scanBuffer(buffer: Buffer, opts: AvScanOptions = {}): Promise<AvScanVerdict> {
  const host = resolveHost(opts);
  if (!host) {
    return Promise.resolve({ status: "skipped", reason: "not_configured" });
  }
  const port =
    opts.port ?? (process.env.CLAMAV_PORT ? Number(process.env.CLAMAV_PORT) : DEFAULT_PORT);
  const timeoutMs =
    opts.timeoutMs ??
    (process.env.CLAMAV_TIMEOUT_MS ? Number(process.env.CLAMAV_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS);
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK;
  // net.Socket provides write/end/destroy/on/setTimeout but its `on` overload
  // set is broader than AvSocket's narrowed three events, so TS won't treat it
  // as directly assignable — bridge through `unknown` at this single boundary.
  const defaultConnect = (p: number, h: string): AvSocket =>
    net.connect(p, h) as unknown as AvSocket;
  const connect = opts.connect ?? defaultConnect;

  return new Promise<AvScanVerdict>((resolve) => {
    let settled = false;
    let reply = "";
    let socket: AvSocket;

    const done = (verdict: AvScanVerdict) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* already gone */
      }
      resolve(verdict);
    };

    try {
      socket = connect(port, host);
    } catch (err) {
      return resolve({ status: "error", reason: `connect failed: ${(err as Error).message}` });
    }

    socket.setTimeout(timeoutMs, () => done({ status: "error", reason: "scan timeout" }));

    socket.on("error", (err) => done({ status: "error", reason: err.message }));

    socket.on("data", (chunk) => {
      reply += chunk.toString("utf8");
      if (!reply.includes("\0") && !reply.includes("\n")) return;
      const line = reply.replaceAll("\0", "").trim();
      if (/\bFOUND\b/.test(line)) {
        // "stream: Eicar-Test-Signature FOUND" → capture the signature token.
        const m = /:\s*(.+?)\s+FOUND\b/.exec(line);
        done({ status: "infected", signature: m?.[1]?.trim() || "unknown" });
      } else if (/\bERROR\b/i.test(line)) {
        done({ status: "error", reason: line });
      } else if (/\bOK\b/.test(line)) {
        done({ status: "clean" });
      }
    });

    socket.on("close", () => {
      if (!settled) done({ status: "error", reason: "connection closed before verdict" });
    });

    // INSTREAM: command, length-prefixed chunks, then a zero-length terminator.
    socket.write(Buffer.from("zINSTREAM\0", "ascii"));
    for (let off = 0; off < buffer.length; off += chunkSize) {
      const slice = buffer.subarray(off, Math.min(off + chunkSize, buffer.length));
      const prefix = Buffer.allocUnsafe(4);
      prefix.writeUInt32BE(slice.length, 0);
      socket.write(prefix);
      socket.write(slice);
    }
    const terminator = Buffer.allocUnsafe(4);
    terminator.writeUInt32BE(0, 0);
    socket.write(terminator);
  });
}

/** The same `{ ok }` shape `assertPdfSafety` returns, so the route handles an
 *  AV rejection identically to a structural rejection. */
export type AvGateResult =
  | { ok: true; verdict: AvScanVerdict }
  | { ok: false; status: number; error: string; code: string; verdict: AvScanVerdict };

/** True when an unverifiable upload must be rejected rather than waved through:
 *  production with a scanner configured, or an explicit `IEP_AV_REQUIRED=true`. */
export function avRequired(opts: AvScanOptions = {}): boolean {
  if (process.env.IEP_AV_REQUIRED === "true") return true;
  return process.env.NODE_ENV === "production" && Boolean(resolveHost(opts));
}

/**
 * Scan + apply the rejection policy in one call. Returns an `{ ok }` result the
 * upload handler can branch on exactly like `assertPdfSafety`.
 *   - infected            → 422 av_infected (always rejected)
 *   - error/skipped + req  → 503 av_unavailable (fail closed)
 *   - error/skipped + !req → ok (proceed; structural hardening already ran)
 */
export async function scanUploadOrReject(
  buffer: Buffer,
  opts: AvScanOptions = {},
): Promise<AvGateResult> {
  const verdict = await scanBuffer(buffer, opts);
  if (verdict.status === "infected") {
    return {
      ok: false,
      status: 422,
      error: "This file was flagged by our virus scanner and can't be uploaded.",
      code: "av_infected",
      verdict,
    };
  }
  if (verdict.status === "clean") {
    return { ok: true, verdict };
  }
  // skipped or error.
  if (avRequired(opts)) {
    return {
      ok: false,
      status: 503,
      error: "We couldn't verify this file's safety right now. Please try again in a moment.",
      code: "av_unavailable",
      verdict,
    };
  }
  return { ok: true, verdict };
}
