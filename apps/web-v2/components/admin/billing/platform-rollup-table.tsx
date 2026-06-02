"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface RollupRow {
  districtId: string;
  districtName: string;
  plan: string;
  status: string;
  seatsTotal: number;
  seatsAllocated: number;
  seatsUsed: number;
  utilizationPct: number;
  mrrCents: number;
  arrCents: number;
  churnRisk: "low" | "medium" | "high";
}

type SortKey = keyof RollupRow;

const CHURN_TONE: Record<string, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function PlatformRollupTable({ rows }: { rows: RollupRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("districtName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIndicator({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function Th({
    label,
    k,
    align = "left",
  }: {
    label: string;
    k: SortKey;
    align?: "left" | "right";
  }) {
    return (
      <th
        className={`cursor-pointer select-none p-3 text-${align} hover:text-aivo-primary`}
        onClick={() => handleSort(k)}
      >
        {label}
        <SortIndicator k={k} />
      </th>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-aivo-border px-4 py-3">
        <h3 className="font-display text-base font-semibold">District Rollup</h3>
      </div>
      {sorted.length === 0 ? (
        <p className="p-6 text-center text-sm text-aivo-ink-soft">No district tenants found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <Th label="District" k="districtName" />
                <Th label="Plan" k="plan" />
                <Th label="Status" k="status" />
                <Th label="Total" k="seatsTotal" align="right" />
                <Th label="Allocated" k="seatsAllocated" align="right" />
                <Th label="Used" k="seatsUsed" align="right" />
                <Th label="Utilization" k="utilizationPct" align="right" />
                <Th label="MRR" k="mrrCents" align="right" />
                <Th label="ARR" k="arrCents" align="right" />
                <Th label="Churn risk" k="churnRisk" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.districtId} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">{row.districtName}</td>
                  <td className="p-3 text-aivo-ink-soft">{row.plan}</td>
                  <td className="p-3">
                    <Badge
                      tone={
                        row.status === "active"
                          ? "success"
                          : row.status === "past_due"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right tabular-nums">{row.seatsTotal}</td>
                  <td className="p-3 text-right tabular-nums">{row.seatsAllocated}</td>
                  <td className="p-3 text-right tabular-nums">{row.seatsUsed}</td>
                  <td className="p-3 text-right tabular-nums">{row.utilizationPct}%</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(row.mrrCents)}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(row.arrCents)}</td>
                  <td className="p-3">
                    <Badge tone={CHURN_TONE[row.churnRisk] ?? "neutral"}>{row.churnRisk}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
