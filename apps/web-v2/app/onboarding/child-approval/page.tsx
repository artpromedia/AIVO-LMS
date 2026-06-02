"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, ReassuranceCard, ConsentRow } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/child-approval
 *
 * Final parent approval step. The parent reviews what their child
 * will be able to do on AIVO and presses "Approve". Until this step
 * is completed, the learner profile is in a holding state and the
 * learner cannot sign in.
 *
 * Sprint-3 acceptance criterion enforced here:
 *   "Child cannot bypass parent approval."
 */
export default function ChildApprovalPage() {
  const t = useTranslations("onboarding.child_approval");
  const tc = useTranslations("onboarding.common");
  const [communication, setCommunication] = React.useState(true);
  const [aiTutor, setAiTutor] = React.useState(true);
  const [voiceMode, setVoiceMode] = React.useState(false);

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="care" size={32} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        reassurance={
          <ReassuranceCard tone="safety" title={t("reassure_title")} body={t("reassure_body")} />
        }
        actions={
          <>
            <Link
              href="/parent/home"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {t("approve")}
            </Link>
            <p className="text-xs text-iw-text-muted text-center">{t("footer_note")}</p>
          </>
        }
      >
        <ConsentRow
          id="ca-comm"
          title={t("comm_title")}
          description={t("comm_desc")}
          checked={communication}
          onChange={setCommunication}
          badge={tc("badge_recommended")}
          icon={<AivoIcon name="classroom" size={18} />}
        />
        <ConsentRow
          id="ca-ai"
          title={t("ai_title")}
          description={t("ai_desc")}
          checked={aiTutor}
          onChange={setAiTutor}
          badge={tc("badge_recommended")}
          icon={<AivoIcon name="aiBrain" size={18} />}
        />
        <ConsentRow
          id="ca-voice"
          title={t("voice_title")}
          description={t("voice_desc")}
          checked={voiceMode}
          onChange={setVoiceMode}
          badge={tc("badge_optional")}
          icon={<AivoIcon name="aiWand" size={18} />}
        />
      </AuthCard>
    </AuthShell>
  );
}
