/**
 * Sprint 3 — daily tamper-evidence anchor job.
 *
 * Computes the chain head hash + event count for a window and writes an
 * `audit_anchors` row, mirroring it to WORM / object-lock storage. A later
 * full-table rewrite that fixes intra-table hashes still fails to match the
 * externally-stored anchor. The WORM store is an injectable port so the job
 * is unit-testable and the S3 object-lock impl lives behind it.
 */
import type { EventStore } from "../services/event-store.js";

export interface WormStore {
  /** Persist an immutable object; returns a reference (e.g. s3 uri + version). */
  put(key: string, body: string): Promise<{ ref: string }>;
}

export interface AnchorRecord {
  windowStart: string;
  windowEnd: string;
  eventCount: number;
  headHash: string;
  wormRef: string | null;
}

export interface AnchorSink {
  /** Persist the anchor row (audit_anchors). */
  save(record: AnchorRecord): Promise<void>;
}

export async function runAnchorOnce(
  store: EventStore,
  worm: WormStore | null,
  sink: AnchorSink | null,
  opts: { windowStart: string; windowEnd: string },
): Promise<AnchorRecord> {
  let count = 0;
  let headHash = "";
  let headKey = ""; // (occurred_at,id) of the latest event in the window
  for await (const e of store.stream({ from: opts.windowStart, to: opts.windowEnd })) {
    count += 1;
    const key = `${e.occurred_at}|${e.id}`;
    if (key > headKey) {
      headKey = key;
      headHash = e.hash;
    }
  }

  let wormRef: string | null = null;
  if (worm) {
    const body = JSON.stringify({
      window_start: opts.windowStart,
      window_end: opts.windowEnd,
      event_count: count,
      head_hash: headHash,
    });
    const key = `audit-anchors/${opts.windowEnd}.json`;
    wormRef = (await worm.put(key, body)).ref;
  }

  const record: AnchorRecord = {
    windowStart: opts.windowStart,
    windowEnd: opts.windowEnd,
    eventCount: count,
    headHash,
    wormRef,
  };
  if (sink) await sink.save(record);
  return record;
}
