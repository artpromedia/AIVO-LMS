import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { getDistrictInvoice } from "@/lib/billing/district-pool";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  open: "warning",
  void: "neutral",
  uncollectible: "danger",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageRole(["district_admin"]);
  const districtId = session.tenantId;
  const { id } = await params;

  const invoice = getDistrictInvoice(districtId, id);
  if (!invoice) notFound();

  const pdfHref = `/api/bff/admin/billing/invoices/${invoice.id}?tenantId=${encodeURIComponent(districtId)}`;

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin · Billing · Invoices"
        title={invoice.number}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/district/billing/invoices">Back to invoices</Link>
            </Button>
            <Button asChild size="sm">
              <a href={pdfHref} target="_blank" rel="noopener noreferrer">
                Download PDF
              </a>
            </Button>
          </div>
        }
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              Invoice number
            </p>
            <p className="mt-0.5 font-semibold">{invoice.number}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Status</p>
            <div className="mt-0.5">
              <Badge tone={STATUS_TONE[invoice.status] ?? "neutral"}>{invoice.status}</Badge>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Amount</p>
            <p className="mt-0.5 font-semibold">
              ${(invoice.amountCents / 100).toFixed(2)} {invoice.currency.toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
              Billing period
            </p>
            <p className="mt-0.5">
              {new Date(invoice.periodStart).toLocaleDateString()} –{" "}
              {new Date(invoice.periodEnd).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Issued</p>
            <p className="mt-0.5">{new Date(invoice.issuedAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Paid</p>
            <p className="mt-0.5">
              {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}
            </p>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
