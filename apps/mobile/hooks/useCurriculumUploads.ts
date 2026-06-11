/**
 * Wave B — parent weekly curriculum sync on mobile, wired to the REAL
 * tutor-svc endpoints (the same `curriculum_uploads` table the web BFF and
 * lesson generation read):
 *
 *   GET    /api/tutors/curriculum/learner/:learnerId      → saved uploads
 *   POST   /api/tutors/curriculum/parse-preview           → AI parse, no save
 *   POST   /api/tutors/curriculum/upload                  → persist focus
 *   DELETE /api/tutors/curriculum/:id                     → remove
 *
 * tutor-svc enforces learner ownership from the caller's JWT, so these run
 * over the normal authenticated apiFetch with no extra plumbing.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface CurriculumParsedFocus {
  title?: string | null;
  subject?: string | null;
  weekStart?: string | null;
  weekEnd?: string | null;
  topics?: string[];
  keywords?: string[];
  standards?: string[];
  skills?: string[];
  summary?: string;
  confidence?: number;
}

export interface CurriculumUploadRow {
  id: string;
  learnerId: string;
  subject: string;
  title: string | null;
  status: string;
  sourceType?: string;
  fileName?: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  parsedFocus: CurriculumParsedFocus | null;
  createdAt: string;
}

export function useCurriculumUploads(learnerId: string) {
  return useQuery<CurriculumUploadRow[]>({
    queryKey: ["curriculum-uploads", learnerId],
    queryFn: async () => {
      const res = await apiFetch(
        API.TUTOR,
        `/api/tutors/curriculum/learner/${encodeURIComponent(learnerId)}`,
      );
      if (!res.ok) throw new Error("Failed to load curriculum uploads");
      const data = (await res.json()) as { uploads?: CurriculumUploadRow[] };
      return data.uploads ?? [];
    },
    enabled: !!learnerId,
    staleTime: 30 * 1000,
  });
}

export interface ParsePreviewInput {
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  subject?: string;
}

export function useParseCurriculumPreview() {
  return useMutation<
    { parsed: CurriculumParsedFocus; rawText: string },
    Error,
    ParsePreviewInput
  >({
    mutationFn: async (input) => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/curriculum/parse-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Could not parse the curriculum content",
        );
      }
      return (await res.json()) as { parsed: CurriculumParsedFocus; rawText: string };
    },
  });
}

export interface SaveUploadInput {
  learnerId: string;
  subject: string;
  parsedFocus: CurriculumParsedFocus;
  text?: string;
  imageBase64?: string;
  mimeType?: string;
  fileName?: string;
  weekStart?: string;
  weekEnd?: string;
}

export function useSaveCurriculumUpload() {
  const queryClient = useQueryClient();
  return useMutation<{ uploads: CurriculumUploadRow[] }, Error, SaveUploadInput>({
    mutationFn: async (input) => {
      const res = await apiFetch(API.TUTOR, `/api/tutors/curriculum/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Could not save the upload");
      }
      return (await res.json()) as { uploads: CurriculumUploadRow[] };
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["curriculum-uploads", vars.learnerId] });
    },
  });
}

export function useDeleteCurriculumUpload(learnerId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiFetch(
        API.TUTOR,
        `/api/tutors/curriculum/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 404) throw new Error("Could not remove the upload");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["curriculum-uploads", learnerId] });
    },
  });
}
