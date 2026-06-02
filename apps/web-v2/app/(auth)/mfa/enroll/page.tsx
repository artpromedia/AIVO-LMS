import { getTranslations } from "next-intl/server";
import { AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { requirePageRole } from "@/lib/auth/server";
import type { Role } from "@/lib/auth/types";
import { getMfaStatus } from "@/lib/db/mfa-store";
import { TotpEnrollForm } from "@/components/auth/TotpEnrollForm";

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

export default async function MfaEnrollPage() {
  const session = await requirePageRole(ALL_ROLES);
  const t = await getTranslations("auth.mfa_enroll");
  const status = getMfaStatus(session.userId);

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
          <TotpEnrollForm alreadyEnrolled={status.totpEnrolled} />
        </AuthCard>
      </main>
      <SiteFooter />
    </>
  );
}
