/**
 * Push router – Sprint 12.7 (PR #55) provides the FCM + APNs adapters
 * and the routing logic. This file is a thin stub representing the
 * interface that landed in #55 so Sprint 13 messaging code can compile
 * and run without depending on the merge order.
 *
 * When PR #55 merges first the more complete implementation will
 * overwrite this file (same exports, same shape). When Sprint 13 merges
 * first this minimum lets the messaging push hook continue to call
 * routePush(...) without changes — the call simply becomes a no-op in
 * environments where neither FCM nor APNs is configured.
 */
export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Used by APNs collapse-id / FCM collapse_key – e.g. a thread id. */
  collapseKey?: string;
}

export interface PushDispatchResult {
  status: "sent" | "skipped" | "failed";
  channel?: "fcm" | "apns";
  messageId?: string;
  reason?: string;
}

/**
 * Route a push payload to FCM and/or APNs based on the device tokens
 * registered for the user. PR #55 wires this to real provider adapters
 * at services/comms-svc/src/providers/{fcm,apns}.ts. Until that lands
 * the stub returns 'skipped' so callers (e.g. POST /messages) can still
 * succeed end-to-end in dev.
 */
export async function routePush(payload: PushPayload): Promise<PushDispatchResult> {
  if (!payload.userId || !payload.title) {
    return { status: "failed", reason: "invalid_payload" };
  }
  if (
    !process.env.FCM_PROJECT_ID &&
    !process.env.APNS_TEAM_ID &&
    !process.env.APNS_KEY_ID
  ) {
    return { status: "skipped", reason: "no_push_provider_configured" };
  }
  // PR #55 replaces this branch with the real fcm/apns adapter dispatch.
  return { status: "skipped", reason: "push_router_stub" };
}
