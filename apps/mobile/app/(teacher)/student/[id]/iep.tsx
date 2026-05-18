import React from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function TeacherIEPUpload() {
  const { t } = useTranslation();
  const type = useResponsiveType();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- route param reserved for future use
  const { id: _id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>{t("teacherIEP.title")}</Text>
      <Text style={styles.subtitle}>{t("teacherIEP.subtitle")}</Text>

      <AivoCard style={styles.uploadCard}>
        <Ionicons name="cloud-upload-outline" size={40} color={colors.primary} />
        <Text style={styles.uploadTitle}>{t("teacherIEP.uploadDocument")}</Text>
        <Text style={styles.uploadDesc}>{t("teacherIEP.uploadDesc")}</Text>
        <View style={styles.uploadActions}>
          <AivoButton
            title={t("teacherIEP.camera")}
            onPress={() => Alert.alert(t("teacherIEP.camera"), t("common.comingSoon"))}
            size="sm"
            icon={<Ionicons name="camera-outline" size={16} color="#FFF" />}
            style={{ flex: 1, marginRight: 8 }}
          />
          <AivoButton
            title={t("teacherIEP.pdf")}
            onPress={() => Alert.alert(t("teacherIEP.pdf"), t("common.comingSoon"))}
            variant="outline"
            size="sm"
            icon={<Ionicons name="document-outline" size={16} color={colors.primary} />}
            style={{ flex: 1 }}
          />
        </View>
      </AivoCard>
    </View>
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
