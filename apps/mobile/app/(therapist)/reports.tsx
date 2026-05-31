import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { MasteryDistributionCard } from "@/src/components/MasteryDistributionCard";

/**
 * Therapist cross-client reports (MOB-THR-001) — mirror of web's
 * /therapist/reports. A caseload-wide mastery distribution roll-up,
 * complementing the per-client reports.
 */
export default function TherapistReportsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("therapistReports.title", "Caseload reports")} />
      <MasteryDistributionCard title={t("therapistReports.distribution", "Caseload mastery")} />
    </ResponsiveScreen>
  );
}
