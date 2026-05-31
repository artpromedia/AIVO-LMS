import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { AccessibilitySettings } from "@/src/components/settings/AccessibilitySettings";

/**
 * Parent per-learner accessibility (MOB-PAR-017) — mirror of web's
 * `/parent/learners/[learnerId]/accessibility`. Reuses the shared
 * accessibility settings body, framed for one learner.
 */
export default function ParentLearnerAccessibilityScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { data: learner } = useLearner(childId ?? "");
  const name = learner?.firstName ?? t("parentHub.learner", "your learner");

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("a11y.title", "Accessibility")} />
      <AccessibilitySettings
        scopeNote={t("parentA11y.scope", {
          name,
          defaultValue: `How AIVO looks, sounds, and moves for ${name}.`,
        })}
      />
    </ResponsiveScreen>
  );
}
