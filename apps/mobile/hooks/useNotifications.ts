import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface NotificationItem {
  id: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt?: string | null;
}

/**
 * Learner/user notifications — comms-svc (`GET /api/comms/notifications/
 * :userId`), polled on a short interval as the RN-friendly stand-in for
 * the web SSE stream. Returns an empty list if unavailable so the screen
 * still renders.
 */
export function useNotifications(userId: string) {
  return useQuery<NotificationItem[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const res = await apiFetch(API.COMMS, `/api/comms/notifications/${userId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data)
        ? data
        : Array.isArray(data?.notifications)
          ? data.notifications
          : [];
    },
    enabled: !!userId,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, id }: { userId: string; id: string }) => {
      const res = await apiFetch(API.COMMS, `/api/comms/notifications/${id}/read`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to mark read");
      return res.json().catch(() => ({}));
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["notifications", v.userId] }),
  });
}
