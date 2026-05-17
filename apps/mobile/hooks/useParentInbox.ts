import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API } from '@/constants/api';

export type InboxNotificationType =
  | 'brain_review'
  | 'recommendation'
  | 'iep_reminder'
  | 'milestone'
  | 'progress'
  | 'team'
  | 'system'
  | string;

export interface InboxNotification {
  id: string;
  type: InboxNotificationType;
  title: string;
  body?: string;
  actionUrl?: string;
  urgency: string;
  readAt: string | null;
  createdAt: string;
  learnerId?: string;
  source?: 'family' | 'iep';
}

interface InboxResponse {
  items: InboxNotification[];
  unreadCount?: number;
}

export function useParentInbox(parentId: string) {
  return useQuery<InboxResponse>({
    queryKey: ['parent-inbox', parentId],
    queryFn: async () => {
      const res = await apiFetch(API.FAMILY, `/api/family/inbox/${parentId}`);
      if (!res.ok) throw new Error('Failed to load inbox');
      return res.json();
    },
    enabled: !!parentId,
    staleTime: 30 * 1000,
  });
}

export function useInboxMarkRead(parentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiFetch(API.FAMILY, `/api/family/inbox/${notificationId}/read`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('Failed to mark read');
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-inbox', parentId] });
    },
  });
}

export function useInboxDismiss(parentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await apiFetch(API.FAMILY, `/api/family/inbox/${notificationId}/dismiss`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('Failed to dismiss');
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-inbox', parentId] });
    },
  });
}
