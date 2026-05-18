import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface HomeworkAssignment {
  id: string;
  subject: string;
  status: "PROCESSING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | string;
  homeworkMode: string;
  detectedSubject: string;
  problemCount: number;
  adaptedCount: number;
  createdAt: string;
}

export function useHomeworkAssignments(learnerId: string) {
  return useQuery<HomeworkAssignment[]>({
    queryKey: ["homework-assignments", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/homework/learner/${learnerId}`);
      if (!res.ok) throw new Error("Failed to load homework");
      const data = await res.json();
      return (data.assignments ?? []) as HomeworkAssignment[];
    },
    enabled: !!learnerId,
    staleTime: 30 * 1000,
  });
}

export interface AdaptedProblem {
  problem_number: number;
  original: string;
  adapted: string;
  scaffolding: string;
  accommodation_notes: string;
  visual_supports: string[];
  choices: string[];
  parent_guide: string;
}

export interface HomeworkChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface HomeworkSessionState {
  sessionId: string;
  assignmentId: string;
  learnerId: string;
  tutorSku: string | null;
  subject: string;
  adaptedProblems: AdaptedProblem[];
  messages: HomeworkChatMessage[];
  startedAt?: string | null;
  endedAt?: string | null;
}

/** Mirrors the web flow: POST /session/start with assignmentId + learnerId returns { sessionId }. */
export function useStartHomeworkSession() {
  return useMutation<{ sessionId: string }, Error, { assignmentId: string; learnerId: string }>({
    mutationFn: async ({ assignmentId, learnerId }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/homework/session/start`, {
        method: "POST",
        body: JSON.stringify({ assignmentId, learnerId }),
      });
      if (!res.ok) throw new Error("Failed to start homework session");
      return res.json();
    },
  });
}

/**
 * Mirrors the web upload flow: POST /api/tutors/homework/upload with
 * { learnerId, imageBase64, mimeType } (no `data:` prefix on the base64).
 *
 * On success the server returns `{ assignment }`; if the learner isn't
 * subscribed for the detected subject, it returns `{ locked: true,
 * requiredSku, detectedSubject }` instead — the caller is responsible for
 * surfacing that to the user.
 */
export interface HomeworkUploadResult {
  assignment?: HomeworkAssignment;
  locked?: boolean;
  requiredSku?: string;
  detectedSubject?: string;
}

export function useUploadHomework() {
  const qc = useQueryClient();
  return useMutation<
    HomeworkUploadResult,
    Error,
    { learnerId: string; imageBase64: string; mimeType: string }
  >({
    mutationFn: async ({ learnerId, imageBase64, mimeType }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/homework/upload`, {
        method: "POST",
        body: JSON.stringify({ learnerId, imageBase64, mimeType }),
      });
      const data = (await res.json().catch(() => ({}))) as HomeworkUploadResult & {
        error?: string;
      };
      if (!res.ok && !data.locked) {
        throw new Error(data.error || "Upload failed");
      }
      return data;
    },
    onSuccess: (data, vars) => {
      if (data.assignment) {
        qc.invalidateQueries({ queryKey: ["homework-assignments", vars.learnerId] });
      }
    },
  });
}

export function useHomeworkSessionState(sessionId: string) {
  return useQuery<HomeworkSessionState>({
    queryKey: ["homework-session", sessionId],
    queryFn: async () => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/homework/session/${sessionId}/state`);
      if (!res.ok) throw new Error("Session not found");
      return res.json();
    },
    enabled: !!sessionId,
    staleTime: 5 * 1000,
  });
}

export function useSendHomeworkMessage(sessionId: string) {
  const qc = useQueryClient();
  return useMutation<{ response: string }, Error, { message: string; locale?: string }>({
    mutationFn: async ({ message, locale }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/homework/session/${sessionId}/message`, {
        method: "POST",
        body: JSON.stringify({ message, locale }),
      });
      if (!res.ok) throw new Error("Message failed");
      return res.json();
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["homework-session", sessionId] });
    },
  });
}

export function useCompleteHomeworkSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, { problemsAttempted: number; problemsCompleted: number }>({
    mutationFn: async ({ problemsAttempted, problemsCompleted }) => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/homework/session/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ problemsAttempted, problemsCompleted }),
      });
      if (!res.ok) throw new Error("Failed to complete session");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["homework-session", sessionId] });
      qc.invalidateQueries({ queryKey: ["homework-assignments"] });
    },
  });
}
