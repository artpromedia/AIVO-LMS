import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { requireAnonymous } from "@/lib/auth/server";
import { getIdpConfigByTenant } from "@/lib/db/idp-store";
import { SsoAutoRedirect } from "@/components/auth/SsoAutoRedirect";
import {
  AuthSplitLayout,
  AuthSidePanel,
  AuthTrustCard,
  AuthSecureFooter,
} from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";

function safeReturn(raw: string | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * District Access (SSO start) — redesigned onto the shared auth split layout
 * with the cloud-mascot headset panel. The IdP card, auto-redirect, and the
 * `ssoUrl` / `returnTo` wiring are unchanged.
 */
export default async function SsoStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ return?: string; noredirect?: string }>;
}) {
  // Anonymous surface — a signed-in user shouldn't re-enter the SSO dance.
  await requireAnonymous();
  const { tenantId } = await params;
  const { return: ret, noredirect } = await searchParams;
  const t = await getTranslations("auth.sso_start");
  const ts = await getTranslations("auth.shell");

  const config = getIdpConfigByTenant(tenantId);
  const protocol = config?.protocol ?? "saml";
  const idpLabel = config?.idpLabel ?? t("default_idp");
  const districtName = idpLabel;
  const returnTo = safeReturn(ret);
  // Mirrors the URL shape returned by /api/auth/discover (identity-svc).
  const ssoUrl = `/api/sso/${protocol}/${encodeURIComponent(tenantId)}/login?returnTo=${encodeURIComponent(returnTo)}`;
  // Auto-redirect is the default; `?noredirect=1` lets a user who navigated
  // back to this page (or an automated a11y check) land without bouncing.
  const autoRedirect = noredirect !== "1" && noredirect !== "true";

  return (
    <AuthSplitLayout
      panel={
        <AuthSidePanel
          variant="headset"
          title={t("panel_title")}
          accent={t("panel_accent")}
          body={t("panel_body")}
        >
          <AuthTrustCard>{ts("trust_districts")}</AuthTrustCard>
        </AuthSidePanel>
      }
    >
      {autoRedirect ? <SsoAutoRedirect url={ssoUrl} /> : null}
      <div className="flex flex-col gap-6">
        <AivoBrandMark sublabel={ts("wordmark_schools")} />

        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-iw-primary">
            {t("eyebrow")}
          </p>
          <h1 className="mt-1 font-iw-display text-2xl font-bold text-iw-ink">
            {t("title", { idp: idpLabel })}
          </h1>
          <p className="mt-1.5 text-sm text-iw-ink-muted">{t("subtitle")}</p>
        </div>

        {/* District identity card — surfaces who the SSO request is for. */}
        <div className="flex items-center gap-3 rounded-iw-card border border-iw-border bg-iw-card p-4">
          <span
            aria-hidden="true"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-iw-control bg-iw-accent-soft text-iw-primary"
          >
            <AivoIcon name="rosterDistrict" size={22} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-iw-ink">{districtName}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-iw-primary">
              <AivoIcon name="safetyOk" size={14} aria-hidden="true" />
              {t("verified")}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <a href={ssoUrl}>{t("continue", { idp: idpLabel })}</a>
          </Button>
          <div className="flex items-center gap-3 text-xs font-medium text-iw-ink-muted">
            <span className="h-px flex-1 bg-iw-border" />
            {ts("or")}
            <span className="h-px flex-1 bg-iw-border" />
          </div>
          <p className="text-center text-sm text-iw-ink-muted">
            <Link
              href="/login"
              className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
            >
              {t("back_to_login")}
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-iw-ink-muted">{t("redirect_note")}</p>

        <AuthSecureFooter lead={ts("secure_signin")} sub={ts("encrypted")} />
      </div>
    </AuthSplitLayout>
  );
}
