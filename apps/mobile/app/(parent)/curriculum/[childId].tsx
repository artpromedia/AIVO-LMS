import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

async function pickDoc(): Promise<{ name: string } | null> {
  try {
    const DP: any = await import("expo-document-picker");
    const res = await DP.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (res?.canceled) return null;
    const asset = res?.assets?.[0];
    return asset ? { name: asset.name ?? "document" } : null;
  } catch {
    return null;
  }
}

/**
 * Parent curriculum upload (MOB-PAR-007) — mirror of web's
 * `/parent/learners/[learnerId]/curriculum`. Upload school lessons so
 * AIVO can teach in sync with class.
 */
export default function ParentCurriculumScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { data: learner } = useLearner(childId ?? "");
  const [picked, setPicked] = useState<string[]>([]);

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentCurriculum.title", "Curriculum")} />
      <Card tone="raised" style={{ gap: spacing.sm }}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("parentCurriculum.heading", "Sync with school")}
        </Text>
        <Text style={[styles.body, { color: palette.inkMuted }]}>
          {t("parentCurriculum.body", {
            name: learner?.firstName ?? t("parentHub.learner", "your learner"),
            defaultValue: `Upload class materials so AIVO can align ${learner?.firstName ?? "your learner"}'s tutoring with what's taught at school.`,
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("parentCurriculum.upload", "Upload a document")}
          onPress={async () => {
            const doc = await pickDoc();
            if (doc) setPicked((p) => [doc.name, ...p]);
          }}
          style={[styles.uploadBtn, { borderColor: palette.primary }]}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={palette.primary} />
          <Text style={[styles.uploadText, { color: palette.primary }]}>
            {t("parentCurriculum.upload", "Upload a document")}
          </Text>
        </Pressable>
      </Card>

      {picked.length > 0 && (
        <Card tone="raised" style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>
            {t("parentCurriculum.uploaded", "Selected files")}
          </Text>
          {picked.map((name, i) => (
            <View key={`${name}-${i}`} style={styles.fileRow}>
              <Ionicons name="document-text-outline" size={18} color={palette.primary} />
              <Text style={[styles.fileName, { color: palette.ink }]} numberOfLines={1}>{name}</Text>
            </View>
          ))}
        </Card>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 20 },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: radius.xl, borderWidth: 1.5, marginTop: spacing.sm,
  },
  uploadText: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileName: { flex: 1, fontSize: 14, fontFamily: fontFamilies.bodySemiBold },
});
