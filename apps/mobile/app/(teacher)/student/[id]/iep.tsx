import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { IepDraftCard } from "@/src/components/IepDraftCard";
import { colors, spacing } from "@/constants/colors";

async function pickDoc(): Promise<{ name: string } | null> {
  try {
    const DP: any = await import("expo-document-picker");
    const res = await DP.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (res?.canceled) return null;
    const a = res?.assets?.[0];
    return a ? { name: a.name ?? "document" } : null;
  } catch {
    return null;
  }
}

export default function TeacherIEPUpload() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [uploaded, setUploaded] = useState<string | null>(null);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, gap: spacing.md }}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>
        {t("teacherIEP.title")}
      </Text>
      <Text style={styles.subtitle}>{t("teacherIEP.subtitle")}</Text>

      {/* AI SMART-goal drafts from the student's lowest-scoring skills. */}
      <IepDraftCard learnerId={id ?? ""} />

      <AivoCard style={styles.uploadCard}>
        <Ionicons
          name={uploaded ? "document-text" : "cloud-upload-outline"}
          size={40}
          color={colors.primary}
        />
        <Text style={styles.uploadTitle}>{uploaded ?? t("teacherIEP.uploadDocument")}</Text>
        <Text style={styles.uploadDesc}>{t("teacherIEP.uploadDesc")}</Text>
        <View style={styles.uploadActions}>
          <AivoButton
            title={t("teacherIEP.pdf")}
            onPress={async () => {
              const d = await pickDoc();
              if (d) setUploaded(d.name);
            }}
            size="sm"
            icon={<Ionicons name="document-outline" size={16} color={colors.white} />}
            style={{ flex: 1 }}
          />
        </View>
      </AivoCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  uploadCard: { alignItems: "center" as const, paddingVertical: spacing.xl },
  uploadTitle: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text, marginTop: 12 },
  uploadDesc: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  uploadActions: { flexDirection: "row", width: "100%" },
});
