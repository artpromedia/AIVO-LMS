import { useState, useEffect, useCallback, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { makeItem, enqueue, flushQueue, queueLength } from "@/lib/offline-queue";

/**
 * Offline-aware action queue. Writes made while offline are persisted
 * (survives app restart) and replayed — authenticated and idempotent —
 * when connectivity returns. See `lib/offline-queue.ts`.
 */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState(0);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      setPendingActions(await flushQueue());
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    queueLength().then((n) => {
      if (alive) setPendingActions(n);
    });
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) void flush();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [flush]);

  const addToSyncQueue = useCallback(
    async (action: string, baseUrl: string, path: string, method: string, body?: unknown) => {
      const n = await enqueue(makeItem(action, baseUrl, path, method, body));
      setPendingActions(n);
      if (isOnline) void flush();
    },
    [isOnline, flush],
  );

  return {
    isOnline,
    pendingActions,
    addToSyncQueue,
    processSyncQueue: flush,
  };
}
