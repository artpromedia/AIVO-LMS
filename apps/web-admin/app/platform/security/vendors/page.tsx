import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type VendorCategory,
  type VendorRiskTier,
  VENDOR_CATEGORIES,
  VENDOR_RISK_TIERS,
  createSecurityVendor,
  listSecurityVendors,
  updateSecurityVendor,
} from "@aivo/admin-api/security";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Vendor action failed.";
}

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/platform/security/vendors?error=Name%20is%20required.");
  try {
    await createSecurityVendor(session, {
      name,
      category: String(formData.get("category") || "other") as VendorCategory,
      dataResidency: String(formData.get("dataResidency") || "").trim(),
      processesLearnerData: String(formData.get("processesLearnerData") || "") === "on",
      dpaSigned: String(formData.get("dpaSigned") || "") === "on",
      riskTier: String(formData.get("riskTier") || "tier3") as VendorRiskTier,
    });
  } catch (error) {
    redirect(`/platform/security/vendors?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/security/vendors?notice=Vendor%20added.");
}

async function updateAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/security/vendors?error=Missing%20vendor.");
  try {
    await updateSecurityVendor(session, id, {
      riskTier: String(formData.get("riskTier") || "tier3") as VendorRiskTier,
      approved: String(formData.get("approved") || "") === "approved",
      dpaSigned: String(formData.get("dpaSigned") || "") === "on",
    });
  } catch (error) {
    redirect(`/platform/security/vendors?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/security/vendors?notice=Vendor%20updated.");
}

const TIER_TONE: Record<VendorRiskTier, string> = {
  tier1: "text-red-700",
  tier2: "text-amber-700",
  tier3: "text-slate-500",
};

export default async function SecurityVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const vendors = await listSecurityVendors(session);
  const approved = vendors.filter((v) => v.approved).length;
  const learnerData = vendors.filter((v) => v.processesLearnerData).length;

  return (
    <AdminPageFrame
      eyebrow="Platform · Security"
      title="Vendor register"
      description="Third-party vendor risk management — data residency, DPA status, and tier, persisted in admin-svc (Postgres)."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/security">
          Security overview
        </Link>
      }
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Vendors" value={vendors.length} />
        <AdminKpiCard label="Approved" value={approved} />
        <AdminKpiCard label="Process learner data" value={learnerData} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-lg font-black">Add vendor</h2>
        <form action={createAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input className="admin-input flex-1" name="name" placeholder="Vendor name" required />
          <input className="admin-input w-32" name="dataResidency" placeholder="Residency" />
          <select className="admin-input" name="category" defaultValue="other">
            {VENDOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
          <select className="admin-input" name="riskTier" defaultValue="tier3">
            {VENDOR_RISK_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input name="processesLearnerData" type="checkbox" /> Learner data
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="dpaSigned" type="checkbox" /> DPA signed
          </label>
          <button className="admin-button" type="submit">
            Add
          </button>
        </form>
      </AdminCard>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Category</th>
                <th>Residency</th>
                <th>Learner data</th>
                <th>DPA</th>
                <th>Tier</th>
                <th>Approved</th>
                <th>Reviewed</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr key={vendor.id}>
                  <td className="font-bold">{vendor.name}</td>
                  <td className="text-sm">{vendor.category.replace("_", " ")}</td>
                  <td className="text-sm">{vendor.dataResidency || "—"}</td>
                  <td className="text-sm">{vendor.processesLearnerData ? "yes" : "no"}</td>
                  <td className="text-sm">{vendor.dpaSigned ? "signed" : "—"}</td>
                  <td className={`font-bold uppercase ${TIER_TONE[vendor.riskTier]}`}>
                    {vendor.riskTier}
                  </td>
                  <td>
                    <span className="admin-status">{vendor.approved ? "approved" : "pending"}</span>
                  </td>
                  <td className="text-sm">{formatDateTime(vendor.lastReviewedAt)}</td>
                  <td>
                    <form action={updateAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={vendor.id} />
                      <select className="admin-input" name="riskTier" defaultValue={vendor.riskTier}>
                        {VENDOR_RISK_TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <select
                        className="admin-input"
                        name="approved"
                        defaultValue={vendor.approved ? "approved" : "pending"}
                      >
                        <option value="approved">approved</option>
                        <option value="pending">pending</option>
                      </select>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          name="dpaSigned"
                          type="checkbox"
                          defaultChecked={vendor.dpaSigned}
                        />
                        DPA
                      </label>
                      <button className="admin-action" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={9}>
                    No vendors in the register yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
