"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RequestSeatsModal } from "@/components/admin/billing/request-seats-modal";

interface SeatRequest {
  id: string;
  requestedSeats: number;
  justification: string;
  status: "open" | "approved" | "denied";
  createdAt: string;
}

interface DistrictSeatSectionProps {
  districtId: string | null;
  allocated: number;
  used: number;
  requests: SeatRequest[];
}

const REQUEST_STATUS_TONE: Record<string, "warning" | "success" | "danger"> = {
  open: "warning",
  approved: "success",
  denied: "danger",
};

export function DistrictSeatSection({
  districtId,
  allocated,
  used,
  requests,
}: DistrictSeatSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const utilizationPct = allocated > 0 ? Math.round((used / allocated) * 100) : 0;

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-semibold">District Seat Allocation</h2>
      {districtId ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-aivo-ink-soft">
                Your school has{" "}
                <strong>
                  {used} / {allocated}
                </strong>{" "}
                seats used ({utilizationPct}% utilization).
              </p>
              {used > allocated && (
                <p className="text-sm text-aivo-danger">
                  This school is over its allocated seat cap. Request more seats from your district
                  admin.
                </p>
              )}
            </div>
            <Button onClick={() => setModalOpen(true)} size="sm">
              Request more seats
            </Button>
          </div>

          {requests.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Your seat requests</p>
              <table className="w-full text-sm">
                <thead className="bg-aivo-surface-2 text-left">
                  <tr>
                    <th className="p-2">Requested</th>
                    <th className="p-2">Justification</th>
                    <th className="p-2">Submitted</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-aivo-border">
                      <td className="p-2 tabular-nums">{r.requestedSeats}</td>
                      <td className="p-2 text-aivo-ink-soft">
                        {r.justification.length > 60
                          ? r.justification.slice(0, 60) + "…"
                          : r.justification}
                      </td>
                      <td className="p-2 text-aivo-ink-soft">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-2">
                        <Badge tone={REQUEST_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-sm text-aivo-ink-soft">
            This school is not linked to a district. Contact platform support to configure district
            billing.
          </p>
        </Card>
      )}

      <RequestSeatsModal open={modalOpen} onOpenChange={setModalOpen} currentSeats={allocated} />
    </section>
  );
}
