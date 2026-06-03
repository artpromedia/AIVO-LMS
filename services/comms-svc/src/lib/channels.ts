/**
 * Notification channel registry.
 *
 * One place that documents every channel comms-svc owns, its current
 * state (real / descoped), how to enable it, and how the per-tenant
 * opt-out gate is honored. Routes consult this instead of inferring
 * channel state from a scattered set of `isXConfigured()` checks; the
 * `/api/comms/status` surface iterates the registry so a new channel is
 * documented and observable the same day it exists.
 *
 * The disabled path for a real-but-unconfigured channel is a typed
 * `channel_disabled` result with an audit trail — never a silent stub.
 */
import { isConfigured as isEmailConfigured } from "./postmark.js";
import { isSmsConfigured } from "../providers/sms-router.js";

export type ChannelId = "email" | "sms" | "push" | "in_app";
export type ChannelMode = "real" | "descoped";

export interface ChannelDescriptor {
  id: ChannelId;
  mode: ChannelMode;
  /** Human-readable summary surfaced via `/api/comms/status` introspection. */
  description: string;
  /** Env vars required to flip the channel from "available" to "connected". */
  requires: readonly string[];
  /** True when the provider for this channel is configured and ready. */
  isConfigured: () => boolean;
}

/**
 * Push gets its readiness from FCM/APNs config; mirrored from the
 * existing status route so we don't introduce a circular import on
 * push-router.
 */
function isPushConfigured(): boolean {
  const fcm = !!process.env.FCM_SERVICE_ACCOUNT_JSON;
  const apns = !!(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_PRIVATE_KEY
  );
  return fcm || apns;
}

export const CHANNELS: Readonly<Record<ChannelId, ChannelDescriptor>> = Object.freeze({
  email: {
    id: "email",
    mode: "real",
    description: "Transactional email via Postmark.",
    requires: ["POSTMARK_API_TOKEN", "POSTMARK_FROM_EMAIL"],
    isConfigured: isEmailConfigured,
  },
  sms: {
    id: "sms",
    mode: "real",
    description:
      "SMS via env-gated provider (Twilio). Disabled by default; per-tenant denylist honored.",
    requires: ["SMS_PROVIDER", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"],
    isConfigured: isSmsConfigured,
  },
  push: {
    id: "push",
    mode: "real",
    description: "Push notifications via FCM and/or APNs.",
    requires: ["FCM_SERVICE_ACCOUNT_JSON", "APNS_KEY_ID+APNS_TEAM_ID+APNS_PRIVATE_KEY"],
    isConfigured: isPushConfigured,
  },
  in_app: {
    id: "in_app",
    mode: "real",
    description: "In-app inbox (notifications table) — always on.",
    requires: [],
    isConfigured: () => true,
  },
});

/**
 * Reason codes returned to clients when a send is suppressed. Typed so
 * the wire shape and audit details stay aligned across channels.
 */
export type ChannelSkipReason =
  | "provider_not_configured"
  | "tenant_opted_out"
  | "user_opted_out"
  | "channel_descoped";

export interface ChannelDisabledResult {
  status: "channel_disabled";
  channel: ChannelId;
  reason: ChannelSkipReason;
  detail?: string;
}

/**
 * Per-tenant opt-out for a given channel. Today we honor `SMS_TENANT_DENYLIST`
 * (comma-separated tenantIds) for SMS so an operator can block a tenant
 * without touching code or rolling a release. Email/push gate on the
 * existing user-pref endpoints; in_app is always allowed.
 *
 * Returning `false` means "do not send"; the caller must surface a
 * typed `channel_disabled` result (reason `tenant_opted_out`) and emit
 * `NOTIFICATION_SKIPPED` so the suppression is auditable.
 */
export function isChannelAllowedForTenant(
  channel: ChannelId,
  tenantId: string | null | undefined,
): boolean {
  if (!tenantId) return true; // platform-level sends (no tenant context)
  if (channel === "sms") {
    const denylist = (process.env.SMS_TENANT_DENYLIST ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (denylist.includes(tenantId)) return false;
  }
  return true;
}

/** Build the public-facing status snapshot used by `/api/comms/status`. */
export function snapshotChannelStatus(): Record<
  ChannelId,
  { mode: ChannelMode; configured: boolean; description: string }
> {
  const out: Record<string, { mode: ChannelMode; configured: boolean; description: string }> = {};
  for (const c of Object.values(CHANNELS)) {
    out[c.id] = { mode: c.mode, configured: c.isConfigured(), description: c.description };
  }
  return out as Record<ChannelId, { mode: ChannelMode; configured: boolean; description: string }>;
}
