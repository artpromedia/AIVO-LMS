/**
 * Typed fetch client for `learning-svc`.
 *
 * In the lesson player we never call `learning-svc` directly — the BFF
 * at `/api/bff/...` proxies through, adds the auth/tenant guards, and
 * shapes the URL. This client therefore accepts a `baseUrl` so the same
 * code can target either the BFF (browser) or learning-svc directly
 * (server jobs, tests).
 */
import {
  AdvanceLearningPathResponse,
  CompleteSessionRequest,
  CompleteSessionResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  ErrorEnvelope,
  GetGradebookResponse,
  GetLearningPathResponse,
  GetSessionByIdResponse,
  InitLearningPathResponse,
  ListSessionsResponse,
  SurfaceTelemetryRequest,
  UpdateGradebookRequest,
  UpdateGradebookResponse,
} from "./schemas.js";
import type { z, ZodTypeAny } from "zod";

export interface LearningClientOptions {
  /** Base URL for HTTP calls. Defaults to "" (relative — for the BFF). */
  baseUrl?: string;
  /** Fetch implementation, defaults to global `fetch`. */
  fetch?: typeof fetch;
  /** Extra headers (auth, etc). */
  headers?: HeadersInit;
}

export class LearningClientError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `learning-svc request failed with HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function parseResponse<S extends ZodTypeAny>(
  res: Response,
  schema: S,
): Promise<z.infer<S>> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const errParse = ErrorEnvelope.safeParse(body);
    const msg = errParse.success ? errParse.data.error : undefined;
    throw new LearningClientError(res.status, body, msg);
  }
  if (res.status === 204) {
    return undefined as z.infer<S>;
  }
  const data = (await res.json()) as unknown;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new LearningClientError(
      res.status,
      { issues: parsed.error.issues },
      "learning-svc response failed schema validation",
    );
  }
  return parsed.data;
}

function buildUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  if (baseUrl.endsWith("/") && path.startsWith("/")) {
    return baseUrl + path.slice(1);
  }
  if (!baseUrl.endsWith("/") && !path.startsWith("/")) {
    return `${baseUrl}/${path}`;
  }
  return baseUrl + path;
}

export function createLearningClient(opts: LearningClientOptions = {}) {
  const baseUrl = opts.baseUrl ?? "";
  const f = opts.fetch ?? fetch;
  const baseHeaders = opts.headers;

  async function call<S extends ZodTypeAny>(
    method: string,
    path: string,
    schema: S,
    body?: unknown,
  ): Promise<z.infer<S>> {
    const init: RequestInit = {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(baseHeaders ?? {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };
    const res = await f(buildUrl(baseUrl, path), init);
    return parseResponse(res, schema);
  }

  return {
    /** POST /api/learning/sessions */
    createSession(input: CreateSessionRequest) {
      const parsed = CreateSessionRequest.parse(input);
      return call("POST", "/api/learning/sessions", CreateSessionResponse, parsed);
    },
    /** POST /api/learning/sessions/:sessionId/complete */
    completeSession(sessionId: string, input: CompleteSessionRequest = {}) {
      const parsed = CompleteSessionRequest.parse(input);
      return call(
        "POST",
        `/api/learning/sessions/${encodeURIComponent(sessionId)}/complete`,
        CompleteSessionResponse,
        parsed,
      );
    },
    /**
     * "Advance" semantics on the player: there is no dedicated `/advance`
     * route for a single lesson session — the player simply records a
     * step transition by calling the BFF step endpoint. We expose this
     * as a generic advance() so the player code reads cleanly.
     */
    advanceSession(
      sessionId: string,
      step: {
        stepKind: string;
        stepRefId?: string | null;
        response?: string;
        isCorrect?: boolean;
      },
    ) {
      return call(
        "POST",
        `/api/learning/sessions/${encodeURIComponent(sessionId)}/advance`,
        CompleteSessionResponse,
        step,
      );
    },
    /** GET /api/learning/sessions?learnerId=... */
    listSessions(learnerId: string) {
      return call(
        "GET",
        `/api/learning/sessions?learnerId=${encodeURIComponent(learnerId)}`,
        ListSessionsResponse,
      );
    },
    /** GET /api/learning/sessions/:sessionId */
    getSession(sessionId: string) {
      return call(
        "GET",
        `/api/learning/sessions/${encodeURIComponent(sessionId)}`,
        GetSessionByIdResponse,
      );
    },
    /** POST /api/learning/gradebook/update */
    updateGradebook(input: UpdateGradebookRequest) {
      const parsed = UpdateGradebookRequest.parse(input);
      return call(
        "POST",
        "/api/learning/gradebook/update",
        UpdateGradebookResponse,
        parsed,
      );
    },
    /** GET /api/learning/gradebook/:learnerId */
    getGradebook(learnerId: string) {
      return call(
        "GET",
        `/api/learning/gradebook/${encodeURIComponent(learnerId)}`,
        GetGradebookResponse,
      );
    },
    /** GET /api/learning/path/:learnerId/:subject */
    getLearningPath(learnerId: string, subject: string) {
      return call(
        "GET",
        `/api/learning/path/${encodeURIComponent(learnerId)}/${encodeURIComponent(subject)}`,
        GetLearningPathResponse,
      );
    },
    /** POST /api/learning/path/:learnerId/:subject/init */
    initLearningPath(learnerId: string, subject: string) {
      return call(
        "POST",
        `/api/learning/path/${encodeURIComponent(learnerId)}/${encodeURIComponent(subject)}/init`,
        InitLearningPathResponse,
      );
    },
    /** POST /api/learning/path/:learnerId/:subject/advance */
    advanceLearningPath(learnerId: string, subject: string) {
      return call(
        "POST",
        `/api/learning/path/${encodeURIComponent(learnerId)}/${encodeURIComponent(subject)}/advance`,
        AdvanceLearningPathResponse,
      );
    },
    /** POST /api/learning/surface-telemetry */
    async surfaceTelemetry(input: SurfaceTelemetryRequest) {
      const parsed = SurfaceTelemetryRequest.parse(input);
      const res = await f(buildUrl(baseUrl, "/api/learning/surface-telemetry"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(baseHeaders ?? {}),
        },
        body: JSON.stringify(parsed),
      });
      if (!res.ok && res.status !== 204) {
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          // ignore
        }
        throw new LearningClientError(res.status, body);
      }
    },
  };
}

export type LearningClient = ReturnType<typeof createLearningClient>;
