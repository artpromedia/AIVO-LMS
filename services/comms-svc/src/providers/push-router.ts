/**
 * Sprint 12.7 — push notification router.
 *
 * Fans an outbound push out to the right provider per device token. The
 * router is provider-agnostic — fcm.ts / apns.ts adapters implement the
 * `PushAdapter` interface so we can mock them in tests and recorded
 * fixtures.
 *
 * Result shape preserves per-token success / failure / invalid so callers
 * can prune device tokens that the provider has revoked.
 */

import { sendFcm } from "./fcm.js";
import { sendApns } from "./apns.js";

export type DeviceTokenKind = "fcm" | "apns";

export interface PushTarget {
  /** Provider-issued device token (or an iOS device token in hex). */
  token: string;
  kind: DeviceTokenKind;
  /** APNs only — defaults to APNS_BUNDLE_ID. */
  topic?: string;
}

export interface PushMessage {
  title?: string;
  body?: string;
  data?: Record<string, string>;
  /** Optional collapse / notification id (FCM `collapse_key`). */
  collapseId?: string;
}

export interface PushResult {
  token: string;
  kind: DeviceTokenKind;
  ok: boolean;
  /** True when the provider says the token is no longer valid. The
   *  caller should delete it from the device-token store. */
  invalidToken: boolean;
  error?: string;
}

export interface PushAdapter {
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}

const fcmAdapter: PushAdapter = {
  send: (t, m) => sendFcm(t, m),
};
const apnsAdapter: PushAdapter = {
  send: (t, m) => sendApns(t, m),
};

export interface PushRouterOptions {
  fcm?: PushAdapter;
  apns?: PushAdapter;
}

export class PushRouter {
  private readonly fcm: PushAdapter;
  private readonly apns: PushAdapter;

  constructor(opts: PushRouterOptions = {}) {
    this.fcm = opts.fcm ?? fcmAdapter;
    this.apns = opts.apns ?? apnsAdapter;
  }

  async send(targets: PushTarget[], message: PushMessage): Promise<PushResult[]> {
    // Partial-failure fan-out: a bad token must not abort the others.
    const settled = await Promise.allSettled(
      targets.map((t) => (t.kind === "fcm" ? this.fcm.send(t, message) : this.apns.send(t, message))),
    );
    return settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : {
            token: targets[i].token,
            kind: targets[i].kind,
            ok: false,
            invalidToken: false,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          },
    );
  }
}

export const defaultPushRouter = new PushRouter();
