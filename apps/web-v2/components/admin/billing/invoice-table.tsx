import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface DistrictInvoice {
  id: string;
  number: string;
  status: "paid" | "open" | "void" | "uncollectible";
  amountCents: number;
  currency: "usd";
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  paidAt: string | null;
}

interface InvoiceTableProps {
  invoices: DistrictInvoice[];
  districtId: string;
  /** Optional: show a link to the full invoices list */
  viewAllHref?: string;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  open: "warning",
  void: "neutral",
  uncollectible: "danger",
};

export function InvoiceTable({ invoices, districtId, viewAllHref }: InvoiceTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-aivo-border px-4 py-3">
        <h3 className="font-display text-base font-semibold">Invoices</h3>
        {viewAllHref && (
          <a href={viewAllHref} className="text-xs font-medium text-aivo-primary hover:underline">
            View all
          </a>
        )}
      </div>
      {invoices.length === 0 ? (
        <p className="p-6 text-center text-sm text-aivo-ink-soft">No invoices found.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-iw-raised text-left">
            <tr>
              <th className="p-3">Number</th>
              <th className="p-3">Period</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-aivo-border">
                <td className="p-3 font-medium">
                  <a
                    href={`/admin/district/billing/invoices/${inv.id}`}
                    className="hover:underline"
                  >
                    {inv.number}
                  </a>
                </td>
                <td className="p-3 text-aivo-ink-soft">
                  {new Date(inv.periodStart).toLocaleDateString()} –{" "}
                  {new Date(inv.periodEnd).toLocaleDateString()}
                </td>
                <td className="p-3 text-right tabular-nums">
                  ${(inv.amountCents / 100).toFixed(2)}
                </td>
                <td className="p-3">
                  <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge>
                </td>
                <td className="p-3 text-right">
                  <a
                    href={`/api/bff/admin/billing/invoices/${inv.id}?tenantId=${encodeURIComponent(districtId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-aivo-primary hover:underline"
                  >
                    Download PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
