"use client";
import * as React from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthCard,
  ReassuranceCard,
  ConsentRow,
  StepperHeader,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { useTranslations } from "next-intl";

const STEPS = [
  { label: "about_you" },
  { label: "role" },
  { label: "family" },
  { label: "consent" },
] as const;

export default function DevicePermissionsPage() {
  const t = useTranslations("onboarding.permissions");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const [mic, setMic] = React.useState(false);
  const [cam, setCam] = React.useState(false);
  const [notifs, setNotifs] = React.useState(true);

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader
          steps={STEPS.map((s) => ({ label: ts(s.label) }))}
          current={3}
        />
        <AuthCard
          icon={<AivoIcon name="safetyOk" size={32} />}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          reassurance={
            <ReassuranceCard
              tone="safety"
              title={t("reassure_title")}
              body={t("reassure_body")}
            />
          }
          actions={
            <Link
              href="/onboarding/pin"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {t("continue")}
            </Link>
          }
        >
          <ConsentRow
            id="p-mic"
            title={t("mic_title")}
            description={t("mic_desc")}
            checked={mic}
            onChange={setMic}
            badge={tc("badge_optional")}
            icon={<AivoIcon name="aiWand" size={18} />}
          />
          <ConsentRow
            id="p-cam"
            title={t("cam_title")}
            description={t("cam_desc")}
            checked={cam}
            onChange={setCam}
            badge={tc("badge_optional")}
            icon={<AivoIcon name="curriculum" size={18} />}
          />
          <ConsentRow
            id="p-notifs"
            title={t("notifs_title")}
            description={t("notifs_desc")}
            checked={notifs}
            onChange={setNotifs}
            badge={tc("badge_recommended")}
            icon={<AivoIcon name="safetyOk" size={18} />}
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
