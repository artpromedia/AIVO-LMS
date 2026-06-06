import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface TutorSession {
  id: string;
  tutorSku: string;
  tutorName?: string;
  learnerId: string;
  status?: "active" | "paused" | "completed";
  startedAt: string;
  completedAt?: string;
  messages?: TutorMessage[];
}

export interface TutorMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: string;
}

export interface StartTutorSessionInput {
  learnerId: string;
  tutorSku: string;
  sessionType?: "standard" | "agentic_guidance";
}

export interface StartTutorSessionResult {
  sessionId: string;
  tutorName: string;
  functioningLevel: string;
}

export interface TutorReply {
  response: string;
  model?: string;
  messageCount: number;
}

async function responseError(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
  return new Error(body.detail || body.error || fallback);
}

export function useActiveSessions(learnerId: string) {
  return useQuery<TutorSession[]>({
    queryKey: ["tutor-sessions", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.TUTOR, `/api/tutor/sessions/${learnerId}`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();

  return useMutation<StartTutorSessionResult, Error, StartTutorSessionInput>({
    mutationFn: async ({ learnerId, tutorSku, sessionType = "agentic_guidance" }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutor/session/start`, {
        method: "POST",
        body: JSON.stringify({ learnerId, tutorSku, sessionType }),
      });
      if (!res.ok) throw await responseError(res, "Failed to start tutor guidance");
      return res.json() as Promise<StartTutorSessionResult>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tutor-sessions", variables.learnerId] });
    },
  });
}

export function useSendMessage() {
  return useMutation<TutorReply, Error, { sessionId: string; message: string; locale?: string }>({
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
        method: "POST",
        body: JSON.stringify({ message, locale }),
      });
      if (!res.ok) throw await responseError(res, "Failed to send message");
      return res.json() as Promise<TutorReply>;
    },
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutor/session/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw await responseError(res, "Failed to end session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutor-sessions"] });
    },
  });
}
