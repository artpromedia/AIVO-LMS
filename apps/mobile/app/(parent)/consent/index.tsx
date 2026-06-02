import React from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useConsents, useSetConsent } from "@/hooks/useConsent";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { LoadingState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

const TYPES: { key: string; label: string; desc: string }[] = [
  {
    key: "data_processing",
    label: "Data processing",
    desc: "Store and process learning data to personalise lessons.",
  },
  {
    key: "personalization",
    label: "Personalisation",
    desc: "Use mastery + activity to tailor tutoring.",
  },
  {
    key: "analytics",
    label: "Product analytics",
    desc: "Aggregate, de-identified usage to improve AIVO.",
  },
  { key: "marketing", label: "Product updates", desc: "Occasional emails about new features." },
];

/**
 * Parent consent center (MOB-PAR-018) — mirror of web's
 * `/parent/consent`. Account-level consent toggles with their current
 * grant state from family-svc.
 */
export default function ParentConsentScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data: consents, isLoading } = useConsents();
  const setConsent = useSetConsent();

  const isGranted = (type: string) => {
    const rec = (consents ?? []).find((c) => c.consentType === type && !c.learnerId);
    return rec ? !rec.revokedAt : type === "data_processing" || type === "personalization";
  };

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentConsent.title", "Consent & approvals")} />
      {isLoading ? (
        <LoadingState />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.reassure}>
            <Ionicons name="shield-checkmark" size={18} color={palette.primary} />
            <Text style={[styles.reassureText, { color: palette.inkMuted }]}>
              {t(
                "parentConsent.note",
                "You can change these at any time. Some are required to run AIVO.",
              )}
            </Text>
          </View>
          {TYPES.map((ct) => {
            const granted = isGranted(ct.key);
            const required = ct.key === "data_processing";
            return (
              <Card key={ct.key} tone="raised" style={styles.row}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Text style={[styles.label, { color: palette.ink }]}>
                    {t(`parentConsent.${ct.key}`, ct.label)}
                    {required ? ` · ${t("parentConsent.required", "required")}` : ""}
                  </Text>
                  <Text style={[styles.desc, { color: palette.inkMuted }]}>
                    {t(`parentConsent.${ct.key}Desc`, ct.desc)}
                  </Text>
                </View>
                <Switch
                  value={granted}
                  disabled={required || setConsent.isPending}
                  onValueChange={(v) => setConsent.mutate({ consentType: ct.key, granted: v })}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor={palette.bgRaised}
                  accessibilityLabel={t(`parentConsent.${ct.key}`, ct.label)}
                />
              </Card>
            );
          })}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  reassure: { flexDirection: "row", alignItems: "center", gap: 8 },
  reassureText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  row: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  desc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
