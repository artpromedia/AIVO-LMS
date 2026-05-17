"use client";
import { useState } from "react";
import Link from "next/link";
import { IconWell } from "@/components/discovery/_vi";
import { Receipt } from "lucide-react";

interface Invoice {
  id: string;
  tenantName: string;
  amount: number;
  status: string;
  plan: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  pending: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  overdue: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  void: "vi-surface-soft vi-text-muted",
};

const SAMPLE_INVOICES: Invoice[] = [
  { id: "INV-2026-001", tenantName: "Smith Family", amount: 29, status: "paid", plan: "Family", issuedAt: "2026-04-01", dueAt: "2026-04-15", paidAt: "2026-04-03" },
  { id: "INV-2026-002", tenantName: "Johnson Academy", amount: 199, status: "paid", plan: "Enterprise", issuedAt: "2026-04-01", dueAt: "2026-04-15", paidAt: "2026-04-02" },
  { id: "INV-2026-003", tenantName: "Garcia Family", amount: 49, status: "pending", plan: "Family Plus", issuedAt: "2026-04-01", dueAt: "2026-04-15", paidAt: null },
  { id: "INV-2026-004", tenantName: "Westside District", amount: 499, status: "paid", plan: "Enterprise", issuedAt: "2026-03-01", dueAt: "2026-03-15", paidAt: "2026-03-05" },
  { id: "INV-2026-005", tenantName: "Lee Family", amount: 29, status: "overdue", plan: "Family", issuedAt: "2026-03-01", dueAt: "2026-03-15", paidAt: null },
  { id: "INV-2026-006", tenantName: "Maple School", amount: 149, status: "paid", plan: "Enterprise", issuedAt: "2026-03-01", dueAt: "2026-03-15", paidAt: "2026-03-10" },
];

export default function InvoicesPage() {
  const [invoices] = useState<Invoice[]>(SAMPLE_INVOICES);
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = statusFilter === "all" ? invoices : invoices.filter((i) => i.status === statusFilter);

  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const pendingAmount = invoices.filter((i) => i.status === "pending" || i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link href="/dashboard/admin/billing" className="hover:text-[hsl(var(--visual-primary))] transition">Billing</Link>
        <span>/</span>
        <span className="vi-text font-medium">Invoices</span>
      </div>

      <div className="flex items-center gap-4">
        <IconWell color="primary">
          <Receipt size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Invoices</h1>
          <p className="text-sm vi-text-muted mt-1">View and manage all platform invoices.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border vi-border text-center">
          <p className="text-2xl font-bold text-[hsl(var(--visual-science))]">${totalRevenue}</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Collected Revenue</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border vi-border text-center">
          <p className="text-2xl font-bold text-[hsl(var(--visual-sel))]">${pendingAmount}</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Outstanding</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border vi-border text-center">
          <p className="text-2xl font-bold vi-text">{invoices.length}</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Total Invoices</p>
        </div>
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-4 border-b vi-border flex items-center gap-3">
          <span className="text-sm vi-text-muted">Status:</span>
          {["all", "paid", "pending", "overdue", "void"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                statusFilter === s ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" : "vi-bg vi-text-muted hover:vi-surface-soft"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Invoice</th>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className="px-5 py-3 font-semibold">Plan</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Issued</th>
              <th className="px-5 py-3 font-semibold">Paid</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3 font-mono text-xs vi-text">{inv.id}</td>
                <td className="px-5 py-3 font-medium vi-text">{inv.tenantName}</td>
                <td className="px-5 py-3 vi-text-muted">{inv.plan}</td>
                <td className="px-5 py-3 font-semibold vi-text">${inv.amount}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                </td>
                <td className="px-5 py-3 vi-text-muted">{new Date(inv.issuedAt).toLocaleDateString()}</td>
                <td className="px-5 py-3 vi-text-muted">{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
