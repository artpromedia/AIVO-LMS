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
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent data deletion (MOB-PAR-022) — mirror of web's
 * `/parent/privacy/delete-data`. Submits a deletion request (a
 * reviewed, reversible-window workflow — not an instant wipe).
 */
export default function ParentDeleteDataScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    Alert.alert(
      t("parentPrivacy.deleteConfirmTitle", "Request data deletion?"),
      t(
        "parentPrivacy.deleteConfirmBody",
        "We'll begin a reviewed deletion of your account data. This can't be undone once it completes.",
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("parentPrivacy.deleteConfirmCta", "Request deletion"),
          style: "destructive",
          onPress: submit,
        },
      ],
    );
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/users/me/deletion-request", {
        method: "POST",
        body: JSON.stringify({}),
      });
      Alert.alert(
        res.ok
          ? t("parentPrivacy.deleteSubmitted", "Request submitted")
          : t("common.error", "Something went wrong"),
        res.ok
          ? t(
              "parentPrivacy.deleteSubmittedBody",
              "We've logged your deletion request and will confirm by email.",
            )
          : t("parentPrivacy.deleteFailed", "Couldn't submit the request. Please contact support."),
      );
    } catch {
      Alert.alert(
        t("common.error", "Something went wrong"),
        t("parentPrivacy.deleteFailed", "Couldn't submit the request. Please contact support."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentPrivacy.delete", "Delete data")} />
      <Card tone="raised" style={{ gap: spacing.sm }}>
        <View style={[styles.warn, { backgroundColor: colors.error + "1A", borderColor: colors.error + "66" }]}>
          <Ionicons name="warning-outline" size={20} color={colors.error} />
          <Text style={[styles.warnText, { color: palette.ink }]}>
            {t("parentPrivacy.deleteWarn", "Deletion is permanent once the review window passes.")}
          </Text>
        </View>
        <Text style={[styles.body, { color: palette.inkMuted }]}>
          {t(
            "parentPrivacy.deleteBody",
            "You can request deletion of your account and your children's data. We process requests in line with COPPA, FERPA, and applicable privacy laws.",
          )}
        </Text>
        <Button
          title={t("parentPrivacy.deleteCta", "Request deletion")}
          onPress={confirm}
          loading={busy}
          variant="outline"
          fullWidth
          size="lg"
          style={{ marginTop: spacing.sm }}
        />
      </Card>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  warn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  warnText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.bodyBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
});
