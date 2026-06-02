"use client";

/**
 * Sprint 9 — non-intrusive offline indicator.
 *
 * Subscribes to navigator.onLine and the corresponding window events.
 * When the learner goes offline mid-lesson we surface a small calm
 * banner explaining what's happening — and that their work is being
 * saved locally. When connectivity returns we automatically drain the
 * outbox (registered at provider time) and dismiss the banner.
 *
 * The component is intentionally lightweight: no portal, no animation
 * dependency, no Tailwind opinion beyond inline classes. Drop it once
 * inside the learner role layout.
 */
import { useEffect, useState } from "react";
import { drainOutbox, registerOutboxAutoDrain, listOutbox } from "@/lib/offline/outbox";

interface OfflineBannerProps {
  /** i18n strings supplied by the consumer so this component stays
   *  decoupled from next-intl and the namespace catalog. */
  copy?: {
    offlineMessage: string;
    queuedLabel: (count: number) => string;
    backOnlineMessage: string;
  };
}

const DEFAULT_COPY: NonNullable<OfflineBannerProps["copy"]> = {
  offlineMessage:
    "Working offline — your answers are being saved and will sync when you reconnect.",
  queuedLabel: (n) => (n === 1 ? "1 answer waiting to sync" : `${n} answers waiting to sync`),
  backOnlineMessage: "Back online — syncing your work…",
};

export function OfflineBanner({ copy = DEFAULT_COPY }: OfflineBannerProps) {
  const [online, setOnline] = useState<boolean>(true);
  const [queueSize, setQueueSize] = useState<number>(0);
  const [showJustReconnected, setShowJustReconnected] = useState<boolean>(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);

    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function refreshQueue() {
      listOutbox()
        .then((records) => setQueueSize(records.length))
        .catch(() => setQueueSize(0));
    }

    function onOffline() {
      setOnline(false);
      refreshQueue();
    }

    function onOnline() {
      setOnline(true);
      setShowJustReconnected(true);
      drainOutbox()
        .catch(() => undefined)
        .finally(refreshQueue);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => setShowJustReconnected(false), 4000);
    }

    refreshQueue();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const unsubAutoDrain = registerOutboxAutoDrain();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsubAutoDrain();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  if (online && !showJustReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-online={online ? "true" : "false"}
      className={
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-md " +
        (online
          ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
          : "bg-amber-100 text-amber-900 border border-amber-200")
      }
    >
      {online ? (
        <span>{copy.backOnlineMessage}</span>
      ) : (
        <span>
          {copy.offlineMessage}
          {queueSize > 0 ? (
            <span className="ml-2 font-semibold">· {copy.queuedLabel(queueSize)}</span>
          ) : null}
        </span>
      )}
    </div>
  );
}
