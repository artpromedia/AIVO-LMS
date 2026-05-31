import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import type { GradebookEntry, LessonSession } from "@/lib/gradebook-logic";

/**
 * Per-skill gradebook entries for a learner — real learning-svc data
 * (`GET /api/learning/gradebook/:learnerId`, backed by the
 * `gradebook_entries` Postgres table). Accessible to the learner and to
 * linked parents / teachers (server enforces via requireLearnerAccess).
 */
export function useGradebook(learnerId: string) {
  return useQuery<GradebookEntry[]>({
    queryKey: ["gradebook", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.LEARNING, `/api/learning/gradebook/${learnerId}`);
      if (!res.ok) throw new Error("Failed to fetch gradebook");
      const data = await res.json();
      return Array.isArray(data) ? (data as GradebookEntry[]) : [];
    },
    enabled: !!learnerId,
    staleTime: 60 * 1000,
  });
}

/**
 * Recent lesson sessions for a learner — real learning-svc data
 * (`GET /api/learning/sessions?learnerId=…`, backed by the
 * `lesson_sessions` Postgres table; last 20, newest first).
 */
export function useLessonSessions(learnerId: string) {
  return useQuery<LessonSession[]>({
    queryKey: ["lesson-sessions", learnerId],
    queryFn: async () => {
      const res = await apiFetch(
        API.LEARNING,
        `/api/learning/sessions?learnerId=${encodeURIComponent(learnerId)}`,
      );
      if (!res.ok) throw new Error("Failed to fetch lesson sessions");
      const data = await res.json();
      return Array.isArray(data) ? (data as LessonSession[]) : [];
    },
    enabled: !!learnerId,
    staleTime: 30 * 1000,
  });
}
