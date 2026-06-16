/**
 * Per-tenant white-label branding (Sprint B6) — platform admins set a
 * district's logo, accent palette, and support link with live WCAG
 * contrast verdicts from @aivo/brand's guard (the identity-svc write
 * route enforces the same checks server-side).
 */
import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { getAdminTenant } from "@aivo/admin-api/platform";
import { AdminPageFrame } from "@aivo/admin-ui";
import { BrandingForm } from "@/components/branding-form";
import { getTenantBrandingById } from "@/lib/tenant-branding";

export default async function TenantBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const { id } = await params;
  // Validates the tenant exists and the admin may access it (throws otherwise).
  await getAdminTenant(session, id);
  const branding = await getTenantBrandingById(id);

  return (
    <AdminPageFrame
      title="White-label branding"
      description="Logo, accent palette, and support link shown to this district's signed-in users. Contrast is enforced — branding can never degrade accessibility. Learner sensory palettes are not affected."
      action={
        <Link className="admin-button admin-button-secondary" href={`/platform/tenants/${id}`}>
          Back to tenant
        </Link>
      }
    >
      <BrandingForm
        initial={{
          displayName: branding?.displayName ?? "",
          primaryColor: branding?.primaryColor ?? "",
          secondaryColor: branding?.secondaryColor ?? "",
          supportUrl: branding?.supportUrl ?? "",
          logoUrl: branding?.logoUrl ?? null,
        }}
        saveEndpoint={`/platform/tenants/${id}/branding/save`}
        logoEndpoint={`/platform/tenants/${id}/branding/logo`}
      />
    </AdminPageFrame>
  );
}
