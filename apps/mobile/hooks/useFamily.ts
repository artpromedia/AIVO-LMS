import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface TeamMemberRow {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | string;
  memberType: "teacher" | "caregiver" | "therapist";
  specialty?: string | null;
  credentials?: string | null;
  relationship?: string | null;
}

interface Seats {
  used: number;
  max: number;
}

export interface CollaborationResponse {
  teachers: any[];
  caregivers: any[];
  therapists: any[];
  seats: {
    teacher: Seats;
    caregiver: Seats;
    therapist: Seats;
  };
}

export function useCollaboration(learnerId: string) {
  return useQuery<CollaborationResponse>({
    queryKey: ["collaboration", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.FAMILY, `/api/family/collaboration/${learnerId}/members`);
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

export type InviteRole = "TEACHER" | "CAREGIVER" | "THERAPIST";

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      learnerId: string;
      email: string;
      role: InviteRole;
      specialty?: string;
      credentials?: string;
      relationship?: string;
    }) => {
      const path =
        vars.role === "TEACHER"
          ? `/api/family/collaboration/${vars.learnerId}/invite/teacher`
          : vars.role === "CAREGIVER"
            ? `/api/family/collaboration/${vars.learnerId}/invite/caregiver`
            : `/api/family/collaboration/${vars.learnerId}/invite/therapist`;
      const body: Record<string, string> = { email: vars.email };
      if (vars.role === "THERAPIST") {
        if (vars.specialty) body.specialty = vars.specialty;
        if (vars.credentials) body.credentials = vars.credentials;
      }
      if (vars.role === "CAREGIVER" && vars.relationship) body.relationship = vars.relationship;
      const res = await apiFetch(API.FAMILY, path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to invite");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["collaboration", variables.learnerId] });
    },
  });
}

export function useConnectedLearners() {
  return useQuery({
    queryKey: ["connected-learners"],
    queryFn: async () => {
      const res = await apiFetch(API.FAMILY, "/api/family/collaboration/connected-learners");
      if (!res.ok) throw new Error("Failed to fetch connected learners");
      return res.json();
    },
  });
}

export function useIEPGoals(learnerId: string) {
  return useQuery({
    queryKey: ["iep-goals", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.FAMILY, `/api/family/iep/${learnerId}/goals`);
      if (!res.ok) throw new Error("Failed to fetch IEP goals");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

// Therapy-goals listing across the caller's accessible learners. The
// family-svc endpoint returns `{ goals: TherapyGoal[] }` aggregated across
// every learner the caller can see (parent ownership, accepted teacher /
// caregiver / therapist links). We filter to the requested learner here so
// each consumer only sees the slice it cares about.
export function useTherapyGoals(learnerId: string) {
  return useQuery({
    queryKey: ["therapy-goals", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.FAMILY, "/api/family/therapy-goals");
      if (!res.ok) throw new Error("Failed to fetch therapy goals");
      const data = (await res.json()) as { goals?: { learnerId: string }[] };
      const goals = Array.isArray(data?.goals) ? data.goals : [];
      return { goals: goals.filter((g) => g.learnerId === learnerId) };
    },
    enabled: !!learnerId,
  });
}

// ─────────────── IEP Updates: Timeline / Amendments / Preferences ───────────────

export interface IEPTimelineItem {
  type: "note" | "report" | "amendment" | "reminder";
  id: string;
  at: string;
  payload: any;
}

export interface IEPTimelineResponse {
  iepProfileId: string | null;
  lifecycleState?: string;
  reviewDate?: string | null;
  items: IEPTimelineItem[];
}

export function useIEPTimeline(learnerId: string) {
  return useQuery<IEPTimelineResponse>({
    queryKey: ["iep-timeline", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.ASSESSMENT, `/api/iep/learners/${learnerId}/timeline`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

export type IEPPrefCategory = "progress_notes" | "reports" | "amendments" | "reminders";
export type IEPPrefs = Record<IEPPrefCategory, { email: boolean; inApp: boolean }>;

export function useIEPPreferences() {
  return useQuery<IEPPrefs>({
    queryKey: ["iep-preferences"],
    queryFn: async () => {
      const res = await apiFetch(API.ASSESSMENT, "/api/iep/preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
  });
}

export function useSaveIEPPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: IEPPrefs) => {
      const res = await apiFetch(API.ASSESSMENT, "/api/iep/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iep-preferences"] }),
  });
}

export function useRespondToAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      amendmentId: string;
      response: "acknowledged" | "objected";
      note?: string;
      learnerId: string;
    }) => {
      const res = await apiFetch(
        API.ASSESSMENT,
        `/api/iep/amendments/${vars.amendmentId}/respond`,
        {
          method: "POST",
          body: JSON.stringify({ response: vars.response, note: vars.note }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit response");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["iep-timeline", variables.learnerId] });
    },
  });
}
