import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface SyncItem {
  id: string;
  action: string;
  endpoint: string;
  method: string;
  body: string;
  createdAt: number;
}

const syncQueue: SyncItem[] = [];

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingActions, setPendingActions] = useState(0);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && syncQueue.length > 0) {
        processSyncQueue();
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- processSyncQueue is module-scoped and stable
  }, []);

  const addToSyncQueue = useCallback((action: string, endpoint: string, method: string, body: unknown) => {
    const item: SyncItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      action,
      endpoint,
      method,
      body: JSON.stringify(body),
      createdAt: Date.now(),
    };
    syncQueue.push(item);
    setPendingActions(syncQueue.length);
  }, []);

  const processSyncQueue = useCallback(async () => {
    while (syncQueue.length > 0) {
      const item = syncQueue[0];
      try {
        await fetch(item.endpoint, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        });
        syncQueue.shift();
      } catch {
        break;
      }
    }
    setPendingActions(syncQueue.length);
  }, []);

  return {
    isOnline,
    pendingActions,
    addToSyncQueue,
    processSyncQueue,
  };
}
