import React from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useConsents, useSetConsent } from "@/hooks/useConsent";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { LoadingState } from "@aivo/mobile-ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

const TYPES = [
  { key: "data_collection", label: "Data collection", desc: "Collect this child's learning data." },
  { key: "ai_personalization", label: "AI personalisation", desc: "Adapt tutoring to this child." },
];

/**
 * Per-learner consent (MOB-PAR-018) — mirror of web's
 * `/parent/consent/[learnerId]`, including the COPPA notice for under-13.
 */
export default function ParentLearnerConsentScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { learnerId } = useLocalSearchParams<{ learnerId: string }>();
  const id = learnerId ?? "";
  const { data: learner } = useLearner(id);
  const { data: consents, isLoading } = useConsents(id);
  const setConsent = useSetConsent();

  const granted = (type: string) => {
    const rec = (consents ?? []).find((c) => c.consentType === type && c.learnerId === id);
    return rec ? !rec.revokedAt : true;
  };

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentConsent.learnerTitle", "Child consent")} />
      {isLoading ? (
        <LoadingState />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={[styles.coppa, { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft, borderColor: palette.border }]}>
            <Ionicons name="information-circle" size={18} color={palette.primary} />
            <Text style={[styles.coppaText, { color: palette.ink }]}>
              {t("parentConsent.coppa", {
                name: learner?.firstName ?? t("parentHub.learner", "your child"),
                defaultValue: `As ${learner?.firstName ?? "your child"}'s parent, you provide verifiable consent on their behalf (COPPA).`,
              })}
            </Text>
          </View>
          {TYPES.map((ct) => (
            <Card key={ct.key} tone="raised" style={styles.row}>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={[styles.label, { color: palette.ink }]}>{t(`parentConsent.${ct.key}`, ct.label)}</Text>
                <Text style={[styles.desc, { color: palette.inkMuted }]}>{t(`parentConsent.${ct.key}Desc`, ct.desc)}</Text>
              </View>
              <Switch
                value={granted(ct.key)}
                disabled={setConsent.isPending}
                onValueChange={(v) => setConsent.mutate({ consentType: ct.key, learnerId: id, granted: v })}
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor={palette.bgRaised}
                accessibilityLabel={t(`parentConsent.${ct.key}`, ct.label)}
              />
            </Card>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  coppa: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 },
  coppaText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.bodySemiBold, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  desc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
