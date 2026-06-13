/**
 * Real antivirus scanning for IEP uploads (Decision D6 follow-up).
 *
 * `scanBuffer` streams bytes to a clamd daemon over INSTREAM; `scanUploadOrReject`
 * applies the rejection policy. These tests drive a FAKE clamd through the
 * injectable `connect` factory — no real socket, no network — and pin:
 *   - no CLAMAV_HOST  → skipped (scanning disabled, hardening still applies);
 *   - clean reply     → ok;
 *   - FOUND reply     → 422 av_infected, with the signature surfaced;
 *   - scanner error / outage → fail OPEN when not required, fail CLOSED (503)
 *     when IEP_AV_REQUIRED=true;
 *   - the INSTREAM framing is well-formed (zINSTREAM, length-prefixed chunks,
 *     zero terminator).
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { AvSocket } from "../src/lib/av-scan.js";
import { scanBuffer, scanUploadOrReject, avRequired } from "../src/lib/av-scan.js";

/** A fake clamd socket that records what was written and replies on the next
 *  tick with the configured verdict line. */
function fakeClamd(reply: string, opts: { error?: string } = {}) {
  const writes: Buffer[] = [];
  const handlers: Record<string, ((arg?: unknown) => void)[]> = {};
  const emit = (event: string, arg?: unknown) => (handlers[event] ?? []).forEach((h) => h(arg));
  const socket: AvSocket = {
    write(data: Buffer) {
      writes.push(Buffer.from(data));
    },
    end() {},
    destroy() {},
    on(event: string, listener: (arg?: unknown) => void) {
      (handlers[event] ??= []).push(listener);
      return socket as never;
    },
    setTimeout() {},
  };
  // After the caller wires its listeners + writes the stream, deliver the reply.
  queueMicrotask(() => {
    if (opts.error) emit("error", new Error(opts.error));
    else emit("data", Buffer.from(reply, "utf8"));
  });
  return { socket, writes, connect: () => socket };
}

const ENV_KEYS = ["CLAMAV_HOST", "CLAMAV_PORT", "IEP_AV_REQUIRED", "NODE_ENV"] as const;
const saved: Record<string, string | undefined> = {};
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
    delete saved[k];
  }
});
function setEnv(k: (typeof ENV_KEYS)[number], v: string | undefined) {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

test("scanBuffer skips cleanly when no CLAMAV_HOST is configured", async () => {
  setEnv("CLAMAV_HOST", undefined);
  const v = await scanBuffer(Buffer.from("anything"));
  assert.deepEqual(v, { status: "skipped", reason: "not_configured" });
});

test("scanBuffer returns clean on a stream: OK reply", async () => {
  const fake = fakeClamd("stream: OK\0");
  const v = await scanBuffer(Buffer.from("%PDF-1.4 clean"), {
    host: "clamd",
    connect: fake.connect,
  });
  assert.deepEqual(v, { status: "clean" });
});

test("scanBuffer reports infected + signature on a FOUND reply", async () => {
  const fake = fakeClamd("stream: Eicar-Test-Signature FOUND\0");
  const v = await scanBuffer(Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}"), {
    host: "clamd",
    connect: fake.connect,
  });
  assert.equal(v.status, "infected");
  if (v.status !== "infected") return;
  assert.equal(v.signature, "Eicar-Test-Signature");
});

test("scanBuffer surfaces a clamd ERROR line as an error verdict", async () => {
  const fake = fakeClamd("INSTREAM size limit exceeded ERROR\0");
  const v = await scanBuffer(Buffer.from("big"), { host: "clamd", connect: fake.connect });
  assert.equal(v.status, "error");
});

test("scanBuffer resolves error (not throw) when the socket errors", async () => {
  const fake = fakeClamd("", { error: "ECONNREFUSED" });
  const v = await scanBuffer(Buffer.from("x"), { host: "clamd", connect: fake.connect });
  assert.equal(v.status, "error");
  if (v.status !== "error") return;
  assert.match(v.reason, /ECONNREFUSED/);
});

test("INSTREAM framing: zINSTREAM command, length-prefixed chunks, zero terminator", async () => {
  const fake = fakeClamd("stream: OK\0");
  const payload = Buffer.from("hello clamd");
  await scanBuffer(payload, { host: "clamd", connect: fake.connect, chunkSize: 4 });
  const joined = Buffer.concat(fake.writes);
  // Starts with the null-terminated command.
  assert.equal(joined.subarray(0, 10).toString("ascii"), "zINSTREAM\0");
  // Decode the frames back: 4-byte length prefix + that many bytes, repeated,
  // until a zero-length terminator. The reassembled bytes must equal the input.
  let off = 10;
  const chunks: Buffer[] = [];
  for (;;) {
    const len = joined.readUInt32BE(off);
    off += 4;
    if (len === 0) break;
    chunks.push(joined.subarray(off, off + len));
    off += len;
  }
  assert.equal(off, joined.length, "stream ends exactly at the zero terminator");
  assert.deepEqual(Buffer.concat(chunks), payload);
  // The 11-byte payload was split into 4-byte frames (4 + 4 + 3).
  assert.equal(chunks.length, 3);
});

test("scanUploadOrReject: infected → 422 av_infected", async () => {
  const fake = fakeClamd("stream: Win.Test.EICAR FOUND\0");
  const res = await scanUploadOrReject(Buffer.from("bad"), { host: "clamd", connect: fake.connect });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 422);
  assert.equal(res.code, "av_infected");
});

test("scanUploadOrReject: clean → ok", async () => {
  const fake = fakeClamd("stream: OK\0");
  const res = await scanUploadOrReject(Buffer.from("ok"), { host: "clamd", connect: fake.connect });
  assert.equal(res.ok, true);
});

test("scanUploadOrReject: scanner error fails OPEN when not required", async () => {
  setEnv("NODE_ENV", "development");
  setEnv("IEP_AV_REQUIRED", undefined);
  const fake = fakeClamd("", { error: "ETIMEDOUT" });
  const res = await scanUploadOrReject(Buffer.from("x"), { host: "clamd", connect: fake.connect });
  assert.equal(res.ok, true); // proceed — structural hardening already ran
});

test("scanUploadOrReject: scanner error fails CLOSED when IEP_AV_REQUIRED=true", async () => {
  setEnv("IEP_AV_REQUIRED", "true");
  const fake = fakeClamd("", { error: "ETIMEDOUT" });
  const res = await scanUploadOrReject(Buffer.from("x"), { host: "clamd", connect: fake.connect });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 503);
  assert.equal(res.code, "av_unavailable");
});

test("avRequired: true in production with a host, false in dev", () => {
  setEnv("NODE_ENV", "production");
  setEnv("IEP_AV_REQUIRED", undefined);
  assert.equal(avRequired({ host: "clamd" }), true);
  assert.equal(avRequired({}), false); // no host configured → not required
  setEnv("NODE_ENV", "development");
  assert.equal(avRequired({ host: "clamd" }), false);
});
