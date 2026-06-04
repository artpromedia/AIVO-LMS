import { requireAuditViewer } from "@/lib/bff/audit-guard";
import { queryAudit, type AuditFilter, type AuditEventView } from "@/lib/db/audit-store";

export const dynamic = "force-dynamic";

const CSV_COLUMNS = [
  "id",
  "occurred_at",
  "tenant_id",
  "actor_id",
  "actor_role",
  "actor_ip",
  "action",
  "entity_type",
  "entity_id",
  "outcome",
  "request_id",
  "hash",
] as const;

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(e: AuditEventView): string {
  return [
    e.id,
    e.occurred_at,
    e.tenant_id,
    e.actor.id,
    e.actor.role,
    e.actor.ip,
    e.action,
    e.entity.type,
    e.entity.id,
    e.outcome,
    e.request_id,
    e.hash,
  ]
    .map(cell)
    .join(",");
}

/**
 * GET — streaming export (csv | json | ndjson). Scope is injected; the cap
 * (10k for non-platform) is enforced server-side. Streamed via a
 * ReadableStream so memory stays roughly constant for large exports.
 */
export async function GET(req: Request) {
  const got = await requireAuditViewer(req);
  if ("err" in got) return got.err;
  const { scope } = got;
  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

  const filter: AuditFilter = {
    tenantId: scope.tenantId,
    schoolId: scope.schoolId,
    actorRole: url.searchParams.get("actorRole") ?? undefined,
    action: url.searchParams.getAll("action").length
      ? url.searchParams.getAll("action")
      : undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    limit: scope.exportCap ?? 1_000_000,
  };
  const { events } = queryAudit(filter);

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (format === "csv") {
        controller.enqueue(enc.encode(CSV_COLUMNS.join(",") + "\n"));
        for (const e of events) controller.enqueue(enc.encode(csvRow(e) + "\n"));
      } else if (format === "ndjson") {
        for (const e of events) controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      } else {
        controller.enqueue(enc.encode("["));
        events.forEach((e, i) =>
          controller.enqueue(enc.encode((i ? "," : "") + JSON.stringify(e))),
        );
        controller.enqueue(enc.encode("]"));
      }
      controller.close();
    },
  });

  const ext = format === "json" ? "json" : format === "ndjson" ? "ndjson" : "csv";
  const ctype =
    format === "json"
      ? "application/json"
      : format === "ndjson"
        ? "application/x-ndjson"
        : "text/csv";
  return new Response(stream, {
    headers: {
      "content-type": `${ctype}; charset=utf-8`,
      "content-disposition": `attachment; filename="audit-export.${ext}"`,
    },
  });
}
