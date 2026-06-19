import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { buildIepReportData, renderIepReportPdf } from "@/lib/parent/iep-report";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** ASCII-safe, filesystem-safe filename stem. */
function safeStem(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "Learner"
  );
}

/**
 * Parent / caregiver IEP progress report download (PDF).
 *
 * Renders a real, single-page PDF from the learner's truthful report data
 * (the same KPIs the IEP card shows). Scoped with `requireLearnerScope`,
 * audited, and returned as an attachment. The "Download PDF" affordance on the
 * parent-home IEP card links here.
 */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
    if (roleErr) return roleErr;
    const scopeErr = await requireLearnerScope(session!, learnerId, requestId);
    if (scopeErr) return scopeErr;

    const data = await buildIepReportData(learnerId, session!.tenantId);
    const pdf = renderIepReportPdf(data);

    audit(session!, "parent.iep_report.download", requestId, { learnerId });

    const filename = `IEP-Report-${safeStem(data.learnerName)}-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-length": String(pdf.byteLength),
        "x-request-id": requestId,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
