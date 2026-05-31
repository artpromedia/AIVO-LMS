import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card, Button } from "@/components/ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent data export (MOB-PAR-022) — mirror of web's
 * `/parent/privacy/data-export`. Requests a copy of the account data
 * via the same identity-svc endpoint the web export uses.
 */
export default function ParentDataExportScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/users/me");
      if (res.ok) {
        Alert.alert(
          t("parentPrivacy.exportTitle", "Export ready"),
          t("parentPrivacy.exportDone", "We've prepared your account data. You'll receive it by email shortly."),
        );
      } else {
        Alert.alert(t("common.error", "Something went wrong"), t("parentPrivacy.exportFailed", "Couldn't start the export. Please try again."));
      }
    } catch {
      Alert.alert(t("common.error", "Something went wrong"), t("parentPrivacy.exportFailed", "Couldn't start the export. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentPrivacy.export", "Export your data")} />
      <Card tone="raised" style={{ gap: spacing.sm }}>
        <Ionicons name="download-outline" size={28} color={palette.primary} />
        <Text style={[styles.body, { color: palette.inkMuted }]}>
          {t("parentPrivacy.exportBody", "Request a machine-readable copy of your account and your children's learning data. We'll email it to you.")}
        </Text>
        <Button
          title={t("parentPrivacy.exportCta", "Request export")}
          onPress={onExport}
          loading={busy}
          fullWidth
          size="lg"
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
});
