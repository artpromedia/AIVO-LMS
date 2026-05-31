import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { AccountSettingsCard } from "@/src/components/settings/AccountSettingsCard";

/**
 * Parent account settings (MOB-PAR-023) — mirror of web's
 * `/parent/settings/account`. Reuses the shared AccountSettingsCard
 * (display name, avatar, password, MFA, sign out) on a dedicated route.
 */
export default function ParentAccountSettingsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("accountSettings.title", "Account")} />
      <AccountSettingsCard avatarInitial="P" enableAvatarUpload />
    </ResponsiveScreen>
  );
}
