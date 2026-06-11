/**
 * District self-serve branding (Sprint B6) — available when the tenant's
 * districtEnterpriseMode flag is on (Sprint B2 resolver). Districts
 * without it see the access policy stated plainly: platform support
 * manages their branding.
 */
import { requirePageRole } from "@aivo/admin-auth";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { BrandingForm } from "@/components/branding-form";
import { districtEnterpriseModeEnabled } from "@/lib/district-flags";
import { getTenantBrandingById } from "@/lib/tenant-branding";

export default async function DistrictBrandingPage() {
  const session = await requirePageRole(["district_admin"]);
  const enabled = await districtEnterpriseModeEnabled();

  if (!enabled) {
    return (
      <AdminPageFrame
        eyebrow="District"
        title="Branding"
        description="Your district's logo and colors across AIVO."
      >
        <AdminCard className="mt-8 p-6" testId="branding-gated">
          <h2 className="text-xl font-black">Managed by AIVO support</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Self-serve branding is part of district enterprise mode, which isn't enabled for your
            district. Contact AIVO support to update your logo, colors, or support link — or to
            enable enterprise mode for self-serve control.
          </p>
        </AdminCard>
      </AdminPageFrame>
    );
  }

  const branding = await getTenantBrandingById(session.tenantId);
  return (
    <AdminPageFrame
      eyebrow="District"
      title="Branding"
      description="Your logo, accent palette, and support link across parent, teacher, and admin surfaces. Contrast is enforced; learner sensory palettes are never changed."
    >
      <BrandingForm
        initial={{
          displayName: branding?.displayName ?? "",
          primaryColor: branding?.primaryColor ?? "",
          secondaryColor: branding?.secondaryColor ?? "",
          supportUrl: branding?.supportUrl ?? "",
          logoUrl: branding?.logoUrl ?? null,
        }}
        saveEndpoint="/district/branding/save"
        logoEndpoint="/district/branding/logo"
      />
    </AdminPageFrame>
  );
}
