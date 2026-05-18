"use client";
/**
 * Sprint 5: shows a warning 5 minutes before the server-side idle timeout
 * fires for an internal-role session. "Stay signed in" issues a forced
 * heartbeat which pushes the deadline forward.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  attachActivityHeartbeat,
  sendHeartbeat,
  type HeartbeatResponse,
} from "@/lib/session-heartbeat";

const INTERNAL_ROLES = new Set([
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
]);
const WARN_BEFORE_MS = 5 * 60_000;

export function IdleWarningModal() {
  const { user, accessToken, logout } = useAuth();
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const internal = user && INTERNAL_ROLES.has(user.role);

  useEffect(() => {
    if (!internal || !accessToken) return;
    const detach = attachActivityHeartbeat(
      () => accessToken,
      (r: HeartbeatResponse) => setDeadline(r.idleDeadline),
    );
    return detach;
  }, [internal, accessToken]);

  useEffect(() => {
    if (!internal) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [internal]);

  if (!internal || deadline == null) return null;
  const remaining = deadline - now;
  if (remaining > WARN_BEFORE_MS) return null;
  if (remaining <= 0) {
    void logout();
    return null;
  }

  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Still there?</h2>
        <p className="text-sm text-gray-600">
          For your security we will sign you out in about {minutes} minute{minutes === 1 ? "" : "s"}{" "}
          due to inactivity.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => logout()}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
          <button
            onClick={async () => {
              if (!accessToken) return;
              const r = await sendHeartbeat(accessToken, true);
              if (r) setDeadline(r.idleDeadline);
            }}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
