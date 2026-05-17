"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import { Building2, School, Users, ClipboardList, Plus, type LucideIcon } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  settings?: any;
}

const TYPE_CONFIG: Record<string, { label: string; Icon: LucideIcon; color: string; well: string }> = {
  B2C_FAMILY: { label: "Family", Icon: Users, color: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]", well: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" },
  B2B_SCHOOL: { label: "School", Icon: School, color: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]", well: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" },
  B2B_DISTRICT: { label: "District", Icon: Building2, color: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]", well: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" },
};

export default function AdminTenantsPage() {
  const { user, accessToken } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [districtName, setDistrictName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createResult, setCreateResult] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const isPlatformAdmin = user?.role === "PLATFORM_ADMIN";

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/tenants", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTenants(Array.isArray(data) ? data : []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateResult(null);
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/create-district", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ districtName, adminName, adminEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create district");
      } else {
        setCreateResult(data);
        setDistrictName("");
        setAdminName("");
        setAdminEmail("");
        fetch("/api/admin-svc/tenants", { headers: { Authorization: `Bearer ${accessToken}` } })
          .then((r) => r.ok ? r.json() : [])
          .then((d) => setTenants(Array.isArray(d) ? d : []))
          .catch(() => {});
      }
    } catch {
      setCreateError("Network error. Please try again.");
    }
    setCreateLoading(false);
  };

  const typeCounts = Object.keys(TYPE_CONFIG).reduce((acc, type) => {
    acc[type] = tenants.filter((t) => t.type === type).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = typeFilter === "ALL" ? tenants : tenants.filter((t) => t.type === typeFilter);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedTenants = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [typeFilter]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="primary">
            <Building2 size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">{t("tenants")}</h1>
            <p className="text-sm vi-text-muted mt-1">Manage organizations, schools, and family accounts.</p>
          </div>
        </div>
        {isPlatformAdmin && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-5 py-2.5 rounded-xl bg-[hsl(var(--visual-primary))] text-white font-semibold text-sm hover:opacity-90 transition shadow-sm flex items-center gap-2"
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            Create District
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Object.entries(TYPE_CONFIG).map(([type, config]) => {
          const Icon = config.Icon;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? "ALL" : type)}
              className={`p-5 rounded-2xl border transition text-left ${
                typeFilter === type ? "border-purple-300 vi-surface-soft shadow-sm" : "vi-border bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <StatIconWell wellClass={config.well}>
                  <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
                </StatIconWell>
                <div>
                  <p className="text-2xl font-bold vi-text">{typeCounts[type] || 0}</p>
                  <p className="text-xs vi-text-muted font-semibold">{config.label} Accounts</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showCreate && isPlatformAdmin && (
        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-1">Create District Account</h2>
          <p className="text-sm vi-text-muted mb-5">Set up an enterprise district subscription with a district admin account.</p>

          {createResult && (
            <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200">
              <h4 className="font-semibold text-[hsl(var(--visual-science))] mb-2">District created successfully</h4>
              <div className="text-sm text-[hsl(var(--visual-science))] space-y-1">
                <p><span className="font-medium">District:</span> {createResult.district?.name}</p>
                <p><span className="font-medium">Admin:</span> {createResult.admin?.name} ({createResult.admin?.email})</p>
                <div className="mt-3 p-3 bg-white rounded-lg border border-green-300">
                  <p className="text-xs vi-text-muted mb-1">Send these credentials to the district administrator:</p>
                  <p className="font-mono text-sm"><span className="font-medium">Email:</span> {createResult.admin?.email}</p>
                  <p className="font-mono text-sm"><span className="font-medium">Password:</span> {createResult.temporaryPassword}</p>
                </div>
              </div>
            </div>
          )}

          {createError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">{createError}</div>}

          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="district-name" className="block text-sm font-medium vi-text mb-1">District Name</label>
              <input id="district-name" type="text" value={districtName} onChange={(e) => setDistrictName(e.target.value)} required
                placeholder="e.g. Fairfax County Public Schools"
                className="w-full px-4 py-2.5 rounded-lg border vi-border focus:border-primary focus:ring-2 focus:ring-purple-100 outline-none text-sm" />
            </div>
            <div>
              <label htmlFor="admin-name" className="block text-sm font-medium vi-text mb-1">Admin Name</label>
              <input id="admin-name" type="text" value={adminName} onChange={(e) => setAdminName(e.target.value)} required
                placeholder="e.g. Dr. Jane Smith"
                className="w-full px-4 py-2.5 rounded-lg border vi-border focus:border-primary focus:ring-2 focus:ring-purple-100 outline-none text-sm" />
            </div>
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium vi-text mb-1">Admin Email</label>
              <input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required
                placeholder="e.g. admin@district.edu"
                className="w-full px-4 py-2.5 rounded-lg border vi-border focus:border-primary focus:ring-2 focus:ring-purple-100 outline-none text-sm" />
            </div>
            <div className="md:col-span-3">
              <button type="submit" disabled={createLoading}
                className="px-6 py-2.5 rounded-lg bg-[hsl(var(--visual-primary))] text-white font-semibold hover:opacity-90 transition disabled:opacity-50 text-sm">
                {createLoading ? "Creating..." : "Create District Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg vi-text">
            {typeFilter === "ALL" ? "All Tenants" : `${TYPE_CONFIG[typeFilter]?.label} Tenants`}
          </h2>
          <p className="text-sm vi-text-muted">{filtered.length} tenants</p>
        </div>
        {loading ? (
          <div className="p-10 text-center vi-text-muted animate-pulse">Loading tenants...</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
                  <th className="px-5 py-3 font-semibold">Organization</th>
                  <th className="px-5 py-3 font-semibold">{tc("type")}</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTenants.map((t) => {
                  const tc = TYPE_CONFIG[t.type] || { label: t.type, Icon: ClipboardList, color: "vi-surface-soft vi-text-muted", well: "vi-surface-soft vi-text-muted" };
                  const RowIcon = tc.Icon;
                  return (
                    <tr key={t.id} className="border-b vi-border hover:vi-bg/50 transition">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${tc.well}`}>
                            <RowIcon size={16} strokeWidth={2.5} aria-hidden="true" />
                          </div>
                          <Link href={`/dashboard/admin/tenants/${t.id}`} className="font-medium text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))]">{t.name}</Link>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${tc.color}`}>{tc.label}</span>
                      </td>
                      <td className="px-5 py-3 vi-text-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
                {paginatedTenants.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-10 text-center vi-text-muted">No tenants found</td></tr>
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </div>
    </div>
  );
}
