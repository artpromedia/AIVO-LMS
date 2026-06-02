import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ERRORS } from "@/lib/bff/errors";
import { renderInvoicePdf, getDistrictInvoice } from "@/lib/billing/district-pool";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    const roleErr = requireRole(session!, ["platform_admin", "district_admin"], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");

    if (!tenantId) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "tenantId query param is required." },
        requestId,
      );
    }

    // RBAC: platform_admin any; district_admin only own tenant
    if (session!.role !== "platform_admin" && session!.tenantId !== tenantId) {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "Not allowed to view invoices for that tenant." },
        requestId,
      );
    }

    const { id } = await params;

    const invoice = getDistrictInvoice(tenantId, id);
    if (!invoice) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Invoice not found." }, requestId);
    }

    const buffer = renderInvoicePdf(tenantId, id);
    if (!buffer) {
      return fail({ ...ERRORS.NOT_FOUND, message: "PDF could not be rendered." }, requestId);
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="invoice-${invoice.number}.pdf"`,
        "content-length": String(buffer.byteLength),
        "x-request-id": requestId,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
