/**
 * Sprint 5: throttled heartbeat for internal admin sessions. Calls
 * `PUT /api/auth/session/heartbeat` at most once per minute on user
 * activity, so the server can keep `lastActivityAt` fresh and reset the
 * idle-timeout window. Returns the next idle deadline (ms epoch) reported
 * by the server so the caller can drive a warning modal.
 */
const MIN_INTERVAL_MS = 60_000;

let lastSentAt = 0;
let inflight: Promise<HeartbeatResponse | null> | null = null;

export interface HeartbeatResponse {
  /** Server time when this heartbeat was processed. */
  serverNow: number;
  /** Epoch ms when the session will be force-logged-out for idleness. */
  idleDeadline: number;
  /** Epoch ms after which a fresh MFA verification is required. */
  mfaDeadline: number;
}

export async function sendHeartbeat(accessToken: string, force = false): Promise<HeartbeatResponse | null> {
  const now = Date.now();
  if (!force && now - lastSentAt < MIN_INTERVAL_MS) return null;
  if (inflight) return inflight;
  lastSentAt = now;
  inflight = (async () => {
    try {
      const res = await fetch("/api/auth/session/heartbeat", {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as HeartbeatResponse;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function attachActivityHeartbeat(
  getAccessToken: () => string | null,
  onResponse: (r: HeartbeatResponse) => void,
): () => void {
  const trigger = async () => {
    const token = getAccessToken();
    if (!token) return;
    const r = await sendHeartbeat(token);
    if (r) onResponse(r);
  };
  const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "click", "scroll"];
  events.forEach((e) => window.addEventListener(e, trigger, { passive: true }));
  // Kick once on attach so we get an initial deadline.
  void trigger();
  return () => events.forEach((e) => window.removeEventListener(e, trigger));
}
