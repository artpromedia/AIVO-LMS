/**
 * React Query v5 hooks for `learning-svc`. Wraps the typed client so
 * callers (the lesson player, the gradebook page, the learning-path
 * dashboard) get cache management, retries, and devtools support for
 * free.
 *
 * Usage:
 *
 *     import { useCreateSession, useGradebook } from "@aivo/api-client/react";
 *     const create = useCreateSession();
 *     create.mutate({ learnerId, tutorSku: "math-k" });
 *
 * The hooks accept an optional `client` so tests can inject a stub.
 */
import {
  type QueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createLearningClient,
  type LearningClient,
  type LearningClientOptions,
} from "../learning/client.js";
import type {
  AdvanceLearningPathResponse,
  CompleteSessionRequest,
  CompleteSessionResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  GetGradebookResponse,
  GetLearningPathResponse,
  GetSessionByIdResponse,
  InitLearningPathResponse,
  ListSessionsResponse,
  SurfaceTelemetryRequest,
  UpdateGradebookRequest,
  UpdateGradebookResponse,
} from "../learning/schemas.js";

let defaultClient: LearningClient | null = null;

/**
 * Configure the singleton client used by hooks when no explicit client
 * is passed. Call once at app boot (typically inside the BFF Providers
 * wrapper) so every hook hits the right base URL.
 */
export function configureLearningClient(opts: LearningClientOptions): LearningClient {
  defaultClient = createLearningClient(opts);
  return defaultClient;
}

function getClient(override?: LearningClient): LearningClient {
  if (override) return override;
  if (!defaultClient) {
    defaultClient = createLearningClient({});
  }
  return defaultClient;
}

// ---- Query keys ---------------------------------------------------------

export const learningKeys = {
  all: ["learning"] as const,
  sessions: () => [...learningKeys.all, "sessions"] as const,
  sessionList: (learnerId: string) =>
    [...learningKeys.sessions(), "list", learnerId] as const,
  session: (sessionId: string) =>
    [...learningKeys.sessions(), "byId", sessionId] as const,
  gradebook: (learnerId: string) =>
    [...learningKeys.all, "gradebook", learnerId] as const,
  path: (learnerId: string, subject: string) =>
    [...learningKeys.all, "path", learnerId, subject] as const,
};

// ---- Queries ------------------------------------------------------------

export function useSessions(
  learnerId: string,
  opts?: {
    client?: LearningClient;
    queryOptions?: Partial<UseQueryOptions<ListSessionsResponse>>;
  },
) {
  const client = getClient(opts?.client);
  return useQuery<ListSessionsResponse>({
    queryKey: learningKeys.sessionList(learnerId),
    queryFn: () => client.listSessions(learnerId),
    enabled: !!learnerId,
    ...opts?.queryOptions,
  });
}

export function useSession(
  sessionId: string,
  opts?: {
    client?: LearningClient;
    queryOptions?: Partial<UseQueryOptions<GetSessionByIdResponse>>;
  },
) {
  const client = getClient(opts?.client);
  return useQuery<GetSessionByIdResponse>({
    queryKey: learningKeys.session(sessionId),
    queryFn: () => client.getSession(sessionId),
    enabled: !!sessionId,
    ...opts?.queryOptions,
  });
}

export function useGradebook(
  learnerId: string,
  opts?: {
    client?: LearningClient;
    queryOptions?: Partial<UseQueryOptions<GetGradebookResponse>>;
  },
) {
  const client = getClient(opts?.client);
  return useQuery<GetGradebookResponse>({
    queryKey: learningKeys.gradebook(learnerId),
    queryFn: () => client.getGradebook(learnerId),
    enabled: !!learnerId,
    ...opts?.queryOptions,
  });
}

export function useLearningPath(
  learnerId: string,
  subject: string,
  opts?: {
    client?: LearningClient;
    queryOptions?: Partial<UseQueryOptions<GetLearningPathResponse>>;
  },
) {
  const client = getClient(opts?.client);
  return useQuery<GetLearningPathResponse>({
    queryKey: learningKeys.path(learnerId, subject),
    queryFn: () => client.getLearningPath(learnerId, subject),
    enabled: !!learnerId && !!subject,
    ...opts?.queryOptions,
  });
}

// ---- Mutations ----------------------------------------------------------

export function useCreateSession(opts?: {
  client?: LearningClient;
  mutationOptions?: UseMutationOptions<CreateSessionResponse, Error, CreateSessionRequest>;
}) {
  const client = getClient(opts?.client);
  const qc = useQueryClient();
  return useMutation<CreateSessionResponse, Error, CreateSessionRequest>({
    mutationFn: (input: CreateSessionRequest) => client.createSession(input),
    onSuccess: (_data: CreateSessionResponse, vars: CreateSessionRequest) => {
      qc.invalidateQueries({ queryKey: learningKeys.sessionList(vars.learnerId) });
    },
    ...opts?.mutationOptions,
  });
}

export function useAdvanceSession(opts?: {
  client?: LearningClient;
  mutationOptions?: UseMutationOptions<
    CompleteSessionResponse,
    Error,
    {
      sessionId: string;
      stepKind: string;
      stepRefId?: string | null;
      response?: string;
      isCorrect?: boolean;
    }
  >;
}) {
  const client = getClient(opts?.client);
  return useMutation<
    CompleteSessionResponse,
    Error,
    {
      sessionId: string;
      stepKind: string;
      stepRefId?: string | null;
      response?: string;
      isCorrect?: boolean;
    }
  >({
    mutationFn: (input: {
      sessionId: string;
      stepKind: string;
      stepRefId?: string | null;
      response?: string;
      isCorrect?: boolean;
    }) =>
      client.advanceSession(input.sessionId, {
        stepKind: input.stepKind,
        stepRefId: input.stepRefId,
        response: input.response,
        isCorrect: input.isCorrect,
      }),
    ...opts?.mutationOptions,
  });
}

export function useCompleteSession(opts?: {
  client?: LearningClient;
  mutationOptions?: UseMutationOptions<
    CompleteSessionResponse,
    Error,
    { sessionId: string; learnerId?: string; body?: CompleteSessionRequest }
  >;
}) {
  const client = getClient(opts?.client);
  const qc = useQueryClient();
  return useMutation<
    CompleteSessionResponse,
    Error,
    { sessionId: string; learnerId?: string; body?: CompleteSessionRequest }
  >({
    mutationFn: ({
      sessionId,
      body,
    }: {
      sessionId: string;
      learnerId?: string;
      body?: CompleteSessionRequest;
    }) => client.completeSession(sessionId, body ?? {}),
    onSuccess: (
      _data: CompleteSessionResponse,
      vars: { sessionId: string; learnerId?: string; body?: CompleteSessionRequest },
    ) => {
      if (vars.learnerId) {
        invalidateLearnerCaches(qc, vars.learnerId);
      }
      qc.invalidateQueries({ queryKey: learningKeys.session(vars.sessionId) });
    },
    ...opts?.mutationOptions,
  });
}

export function useInitLearningPath(opts?: {
  client?: LearningClient;
  mutationOptions?: UseMutationOptions<
    InitLearningPathResponse,
    Error,
    { learnerId: string; subject: string }
  >;
}) {
  const client = getClient(opts?.client);
  const qc = useQueryClient();
  return useMutation<
    InitLearningPathResponse,
    Error,
    { learnerId: string; subject: string }
  >({
    mutationFn: ({ learnerId, subject }: { learnerId: string; subject: string }) =>
      client.initLearningPath(learnerId, subject),
    onSuccess: (
      _data: InitLearningPathResponse,
      vars: { learnerId: string; subject: string },
    ) => {
      qc.invalidateQueries({ queryKey: learningKeys.path(vars.learnerId, vars.subject) });
    },
    ...opts?.mutationOptions,
  });
}

export function useAdvanceLearningPath(opts?: {
  client?: LearningClient;
  mutationOptions?: UseMutationOptions<
    AdvanceLearningPathResponse,
    Error,
    { learnerId: string; subject: string }
  >;
}) {
  const client = getClient(opts?.client);
  const qc = useQueryClient();
  return useMutation<
    AdvanceLearningPathResponse,
    Error,
    { learnerId: string; subject: string }
  >({
    mutationFn: ({ learnerId, subject }: { learnerId: string; subject: string }) =>
      client.advanceLearningPath(learnerId, subject),
    onSuccess: (
      _data: AdvanceLearningPathResponse,
      vars: { learnerId: string; subject: string },
    ) => {
      qc.invalidateQueries({ queryKey: learningKeys.path(vars.learnerId, vars.subject) });
    },
    ...opts?.mutationOptions,
  });
}

export function useUpdateGradebook(opts?: {
  client?: LearningClient;
  mutationOptions?: UseMutationOptions<UpdateGradebookResponse, Error, UpdateGradebookRequest>;
}) {
  const client = getClient(opts?.client);
  const qc = useQueryClient();
  return useMutation<UpdateGradebookResponse, Error, UpdateGradebookRequest>({
    mutationFn: (input: UpdateGradebookRequest) => client.updateGradebook(input),
    onSuccess: (_data: UpdateGradebookResponse, vars: UpdateGradebookRequest) => {
      qc.invalidateQueries({ queryKey: learningKeys.gradebook(vars.learnerId) });
    },
    ...opts?.mutationOptions,
  });
}

export function useSurfaceTelemetry(opts?: {
  client?: LearningClient;
  mutationOptions?: UseMutationOptions<void, Error, SurfaceTelemetryRequest>;
}) {
  const client = getClient(opts?.client);
  return useMutation<void, Error, SurfaceTelemetryRequest>({
    mutationFn: (input: SurfaceTelemetryRequest) => client.surfaceTelemetry(input),
    // Telemetry is best-effort: surface failures only via logger,
    // never disrupt the lesson flow.
    retry: 0,
    ...opts?.mutationOptions,
  });
}

function invalidateLearnerCaches(qc: QueryClient, learnerId: string): void {
  qc.invalidateQueries({ queryKey: learningKeys.sessionList(learnerId) });
  qc.invalidateQueries({ queryKey: learningKeys.gradebook(learnerId) });
}
