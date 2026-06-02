import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { requireAnonymous } from "@/lib/auth/server";
import { getIdpConfigByTenant } from "@/lib/db/idp-store";
import { SsoAutoRedirect } from "@/components/auth/SsoAutoRedirect";

function safeReturn(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default async function SsoStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ return?: string }>;
}) {
  // Anonymous surface — a signed-in user shouldn't re-enter the SSO dance.
  await requireAnonymous();
  const { tenantId } = await params;
  const { return: ret } = await searchParams;
  const t = await getTranslations("auth.sso_start");

  const config = getIdpConfigByTenant(tenantId);
  const protocol = config?.protocol ?? "saml";
  const idpLabel = config?.idpLabel ?? t("default_idp");
  const returnTo = safeReturn(ret);
  // Mirrors the URL shape returned by /api/auth/discover (identity-svc).
  const ssoUrl = `/api/sso/${protocol}/${encodeURIComponent(tenantId)}/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12 sm:py-16">
        <SsoAutoRedirect url={ssoUrl} />
        <AuthCard
          icon={
            <span
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-iw-card bg-iw-accent-soft text-iw-primary"
            >
              <AivoIcon name="safetyOk" size={22} />
            </span>
          }
          eyebrow={t("eyebrow")}
          title={t("title", { idp: idpLabel })}
          subtitle={t("subtitle")}
          actions={
            <>
              <Button asChild size="lg" className="w-full">
                <a href={ssoUrl}>{t("continue", { idp: idpLabel })}</a>
              </Button>
              <p className="text-center text-sm text-iw-ink-muted">
                <Link href="/login" className="font-semibold text-iw-primary hover:underline">
                  {t("back_to_login")}
                </Link>
              </p>
            </>
          }
        >
          <p className="text-sm text-iw-ink-muted">{t("redirect_note")}</p>
        </AuthCard>
      </main>
      <SiteFooter />
    </>
  );
}
