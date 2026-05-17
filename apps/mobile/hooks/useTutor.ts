import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API } from '@/constants/api';

interface TutorSession {
  id: string;
  tutorSlug: string;
  learnerId: string;
  status: 'active' | 'paused' | 'completed';
  startedAt: string;
  endedAt?: string;
  transcript: Message[];
  score?: number;
}

interface Message {
  role: 'tutor' | 'learner';
  content: string;
  timestamp: string;
  contentType?: 'text' | 'image' | 'audio' | 'choice';
}

export function useActiveSessions(learnerId: string) {
  return useQuery<TutorSession[]>({
    queryKey: ['tutor-sessions', learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.TUTOR, `/api/tutor/sessions/${learnerId}`);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
    enabled: !!learnerId,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      learnerId,
      tutorSlug,
    }: {
      learnerId: string;
      tutorSlug: string;
    }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutor/session/start`, {
        method: 'POST',
        body: JSON.stringify({ learnerId, tutorSlug }),
      });
      if (!res.ok) throw new Error('Failed to start session');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tutor-sessions', variables.learnerId] });
    },
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async ({
      sessionId,
      message,
      locale,
    }: {
      sessionId: string;
      message: string;
      locale?: string;
    }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutor/session/${sessionId}/message`, {
        method: 'POST',
        body: JSON.stringify({ message, locale }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutor/session/${sessionId}/complete`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to end session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutor-sessions'] });
    },
  });
}
