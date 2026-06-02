"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SchoolOption {
  schoolId: string;
  schoolName: string;
  allocated: number;
  used: number;
}

interface PoolState {
  pool: {
    districtId: string;
    total: number;
    allocated: number;
    used: number;
    unallocated: number;
  };
  allocations: SchoolOption[];
  unallocated: number;
}

interface AllocateFormProps {
  districtId: string;
  initialPool: PoolState;
}

export function AllocateForm({ districtId, initialPool }: AllocateFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [poolState, setPoolState] = useState<PoolState>(initialPool);
  const [fromSchoolId, setFromSchoolId] = useState<string>("__unallocated__");
  const [toSchoolId, setToSchoolId] = useState<string>("");
  const [count, setCount] = useState<string>("");
  const [effectiveAt, setEffectiveAt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleSubmit() {
    const countNum = parseInt(count, 10);
    if (!Number.isInteger(countNum) || countNum <= 0) {
      setError("Count must be a positive integer.");
      return;
    }
    if (!toSchoolId) {
      setError("Select a target school.");
      return;
    }
    if (fromSchoolId === toSchoolId) {
      setError("Source and target schools must be different.");
      return;
    }

    setError(null);
    setSuccessMsg(null);

    // Optimistic update
    const optimisticPool = applyOptimistic(poolState, fromSchoolId, toSchoolId, countNum);
    setPoolState(optimisticPool);

    start(async () => {
      const body: Record<string, unknown> = {
        districtId,
        from_tenant_id: fromSchoolId === "__unallocated__" ? null : fromSchoolId,
        to_tenant_id: toSchoolId,
        count: countNum,
      };
      if (effectiveAt) body.effective_at = effectiveAt;

      const res = await fetch("/api/bff/admin/billing/allocate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const json: { ok: boolean; data?: { pool: PoolState }; error?: { message?: string } } =
        await res.json();

      if (!res.ok || !json.ok) {
        // Revert optimistic update on failure
        setPoolState(initialPool);
        setError(json?.error?.message ?? "Allocation failed. Please try again.");
        return;
      }

      if (json.data?.pool) {
        // Reconcile with server response
        const serverPool = json.data.pool;
        setPoolState({
          pool: {
            districtId: serverPool.pool.districtId,
            total: serverPool.pool.total,
            allocated: serverPool.pool.allocated,
            used: serverPool.pool.used,
            unallocated: serverPool.unallocated,
          },
          allocations: serverPool.allocations,
          unallocated: serverPool.unallocated,
        });
      }

      setCount("");
      setEffectiveAt("");
      setSuccessMsg(`Successfully allocated ${countNum} seats.`);
      router.refresh();
    });
  }

  const fromOptions = [
    {
      value: "__unallocated__",
      label: `Unallocated pool (${poolState.unallocated} seats)`,
    },
    ...poolState.allocations.map((s) => ({
      value: s.schoolId,
      label: `${s.schoolName} (${s.allocated} allocated)`,
    })),
  ];

  const toOptions = poolState.allocations
    .filter((s) => s.schoolId !== fromSchoolId)
    .map((s) => ({
      value: s.schoolId,
      label: s.schoolName,
    }));

  return (
    <div className="space-y-6">
      {/* Current allocation state */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-aivo-border px-4 py-3">
          <h3 className="font-display text-base font-semibold">Current Allocations</h3>
          <span className="text-xs text-aivo-ink-soft">
            {poolState.unallocated} of {poolState.pool.total} seats unallocated
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left">
            <tr>
              <th className="p-3">School</th>
              <th className="p-3 text-right">Allocated</th>
              <th className="p-3 text-right">Used</th>
              <th className="p-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {poolState.allocations.map((row) => {
              const overUtilized = row.used > row.allocated;
              const pct = row.allocated > 0 ? Math.round((row.used / row.allocated) * 100) : 0;
              return (
                <tr
                  key={row.schoolId}
                  className={`border-t border-aivo-border ${overUtilized ? "bg-aivo-danger/5" : ""}`}
                >
                  <td className="p-3 font-medium">{row.schoolName}</td>
                  <td className="p-3 text-right tabular-nums">{row.allocated}</td>
                  <td className="p-3 text-right tabular-nums">{row.used}</td>
                  <td className="p-3 text-right">
                    {overUtilized ? (
                      <Badge tone="danger">Over limit</Badge>
                    ) : pct >= 90 ? (
                      <Badge tone="warning">{pct}%</Badge>
                    ) : (
                      <Badge tone="success">{pct}%</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* Unallocated row */}
            <tr className="border-t border-aivo-border bg-aivo-surface-2/50">
              <td className="p-3 italic text-aivo-ink-soft">Unallocated (pool)</td>
              <td className="p-3 text-right tabular-nums">{poolState.unallocated}</td>
              <td className="p-3 text-right text-aivo-ink-soft">—</td>
              <td className="p-3 text-right text-aivo-ink-soft">—</td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Allocation form */}
      <Card className="p-[var(--aivo-density-card-pad)]">
        <h3 className="mb-4 font-display text-base font-semibold">Move Seats</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">From</label>
            <Select value={fromSchoolId} onValueChange={setFromSchoolId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {fromOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">To</label>
            <Select value={toSchoolId} onValueChange={setToSchoolId}>
              <SelectTrigger>
                <SelectValue placeholder="Select target school" />
              </SelectTrigger>
              <SelectContent>
                {toOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No schools available
                  </SelectItem>
                ) : (
                  toOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Seats to move</label>
            <Input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="e.g. 25"
              disabled={pending}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Effective date{" "}
              <span className="font-normal text-aivo-ink-soft">(optional, for future moves)</span>
            </label>
            <Input
              type="date"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-aivo-danger">{error}</p>}
        {successMsg && <p className="mt-3 text-sm text-aivo-success">{successMsg}</p>}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSubmit} disabled={pending || !count || !toSchoolId}>
            {pending ? "Allocating…" : "Allocate seats"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Optimistic update helper — mirrors allocateSeats domain logic
function applyOptimistic(
  state: PoolState,
  fromSchoolId: string,
  toSchoolId: string,
  count: number,
): PoolState {
  const allocs = state.allocations.map((a) => ({ ...a }));
  const from =
    fromSchoolId === "__unallocated__" ? null : allocs.find((a) => a.schoolId === fromSchoolId);
  const to = allocs.find((a) => a.schoolId === toSchoolId);
  if (!to) return state;

  if (from === null) {
    // From unallocated pool
    const newUnallocated = Math.max(0, state.unallocated - count);
    to.allocated += count;
    return {
      ...state,
      allocations: allocs,
      unallocated: newUnallocated,
      pool: { ...state.pool, allocated: state.pool.allocated + count },
    };
  } else if (from) {
    from.allocated = Math.max(0, from.allocated - count);
    to.allocated += count;
    return { ...state, allocations: allocs };
  }
  return state;
}
