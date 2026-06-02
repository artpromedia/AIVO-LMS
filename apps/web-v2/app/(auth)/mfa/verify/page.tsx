import { getTranslations } from "next-intl/server";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { requirePageRole } from "@/lib/auth/server";
import type { Role } from "@/lib/auth/types";
import { MfaVerifyForm } from "@/components/auth/MfaVerifyForm";

const ALL_ROLES: Role[] = [
  "parent",
  "learner",
  "teacher",
  "caregiver",
  "therapist",
  "school_admin",
  "district_admin",
  "platform_admin",
];

export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  await requirePageRole(ALL_ROLES);
  const { return: ret } = await searchParams;
  const t = await getTranslations("auth.mfa_verify");

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12 sm:py-16">
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
          title={t("title")}
          subtitle={t("subtitle")}
        >
          <MfaVerifyForm returnTo={ret} />
        </AuthCard>
      </main>
      <SiteFooter />
    </>
  );
}
