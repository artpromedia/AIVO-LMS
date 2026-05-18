"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconWell } from "@/components/discovery/_vi";
import { Users } from "lucide-react";

interface Family {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string;
  learners: { id: string; name: string }[];
  learnerCount: number;
}

export default function DistrictFamiliesPage() {
  const { accessToken } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/district/families${qs}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : { families: [] }))
      .then((data) => setFamilies(data.families || []))
      .catch(() => setFamilies([]))
      .finally(() => setLoading(false));
  }, [accessToken, search]);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center gap-4">
        <IconWell color="math">
          <Users size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Parents & Families</h1>
          <p className="text-sm vi-text-muted mt-1">
            View parent accounts and their linked learners across the district.
          </p>
        </div>
      </header>

      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl border vi-border text-sm w-80 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
        />
        <span className="text-sm vi-text-muted">{families.length} families</span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      ) : families.length === 0 ? (
        <div className="vi-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]">
            <Users size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="vi-text-muted font-medium">No families found</p>
          <p className="text-sm vi-text-muted mt-1">
            Parent accounts will appear here once learners are enrolled.
          </p>
        </div>
      ) : (
        <div className="vi-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left vi-text-muted vi-bg/50 border-b vi-border">
                <th className="px-5 py-3 font-semibold">Parent</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Learners</th>
                <th className="px-5 py-3 font-semibold">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.id} className="border-b vi-border hover:vi-surface-soft transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[hsl(var(--visual-math))] flex items-center justify-center text-white text-xs font-bold">
                        {f.name?.charAt(0) || "?"}
                      </div>
                      <span className="font-medium vi-text">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 vi-text-muted">{f.email}</td>
                  <td className="px-5 py-3">
                    {f.learners.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {f.learners.map((l) => (
                          <Link
                            key={l.id}
                            href={`/dashboard/district/learners/${l.id}`}
                            className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-medium hover:bg-violet-200"
                          >
                            {l.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs vi-text-muted">No learners</span>
                    )}
                  </td>
                  <td className="px-5 py-3 vi-text-muted text-xs">
                    {f.lastLoginAt ? new Date(f.lastLoginAt).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
