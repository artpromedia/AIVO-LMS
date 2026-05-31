import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface TeacherAssignment {
  id: string;
  title: string;
  subject: string;
  dueDate?: string | null;
  status: string;
}

/**
 * Teacher assignments — learning-svc (`/api/learning/assignments`).
 * Returns an empty list when unavailable so the list screen still
 * renders its create entry point + empty state.
 */
export function useTeacherAssignments() {
  const q = useQuery<TeacherAssignment[]>({
    queryKey: ["teacher-assignments"],
    queryFn: async () => {
      const res = await apiFetch(API.LEARNING, "/api/learning/assignments");
      if (!res.ok) return [];
      const data = await res.json();
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.assignments)
          ? data.assignments
          : [];
      return arr.map((a: any) => ({
        id: a.id,
        title: a.title ?? "Assignment",
        subject: a.subject ?? "",
        dueDate: a.dueDate ?? a.due_date ?? null,
        status: a.status ?? "active",
      }));
    },
    staleTime: 30_000,
  });
  return { items: q.data ?? [], ...q };
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; subject: string; dueDate?: string }) => {
      const res = await apiFetch(API.LEARNING, "/api/learning/assignments", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create assignment");
      return res.json().catch(() => ({}));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teacher-assignments"] }),
  });
}
