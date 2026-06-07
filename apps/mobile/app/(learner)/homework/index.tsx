import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
// SDK 54 ships expo-file-system v19's "next-gen" File API by default;
// the back-compat readAsStringAsync used here lives at /legacy until we migrate.
import * as FileSystem from "expo-file-system/legacy";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import {
  useHomeworkAssignments,
  useStartHomeworkSession,
  useUploadHomework,
  type HomeworkAssignment,
} from "@/hooks/useHomework";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PROCESSING: { bg: "#FEF3C7", fg: "#B45309" },
  READY: { bg: "#DCFCE7", fg: "#166534" },
  IN_PROGRESS: { bg: "#DBEAFE", fg: "#1D4ED8" },
  COMPLETED: { bg: "#EDE9FE", fg: "#6D28D9" },
  FAILED: { bg: "#FEE2E2", fg: "#B91C1C" },
};

const SUBJECT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  math: "calculator",
  science: "flask",
  reading: "book",
  writing: "create",
  history: "time",
  geography: "earth",
  art: "color-palette",
  music: "musical-notes",
  other: "document-text",
};

function statusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: colors.surface, fg: colors.textSecondary };
}

function subjectIconName(subject: string | undefined): keyof typeof Ionicons.glyphMap {
  if (!subject) return SUBJECT_ICONS.other;
  return SUBJECT_ICONS[subject.toLowerCase()] ?? SUBJECT_ICONS.other;
}

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export default function HomeworkScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: assignments, isLoading } = useHomeworkAssignments(user?.id ?? "");
  const startSession = useStartHomeworkSession();
  const uploadHomework = useUploadHomework();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { sizeClass, width: winWidth, isTablet } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  // Larger capture preview on tablets so the camera frame doesn't feel
  // like a phone-sized strip stranded in the middle of a 12.9" canvas.
  const previewHeight = pickBySizeClass(sizeClass, { compact: 200, medium: 320, expanded: 420 });
  const contentWidth = Math.min(
    winWidth - hPad * 2,
    isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth,
  );

  const onAssignmentPress = async (a: HomeworkAssignment) => {
    if (a.status !== "READY" && a.status !== "IN_PROGRESS") {
      const statusLabel = t(`learnerHomework.status.${a.status}`, {
        defaultValue: a.status,
      });
      Alert.alert(
        t("learnerHomework.title"),
        t("learnerHomework.statusUnavailable", {
          status: statusLabel,
          defaultValue: `This homework is currently ${statusLabel}.`,
        }),
      );
      return;
    }
    if (!user?.id) return;
    try {
      const result = await startSession.mutateAsync({
        assignmentId: a.id,
        learnerId: user.id,
      });
      router.push(`/(learner)/homework/${result.sessionId}` as Href);
    } catch {
      Alert.alert(
        t("learnerHomework.title"),
        t("learnerHomework.sessionStartFailed", {
          defaultValue: "We couldn't start this homework session. Please try again.",
        }),
      );
    }
  };

  const submitImage = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (!user?.id) return;
      setUploadError(null);
      const base64 = asset.base64;
      if (!base64) {
        setUploadError(t("learnerHomework.uploadFailed"));
        return;
      }
      const mime = asset.mimeType || "image/jpeg";
      try {
        const result = await uploadHomework.mutateAsync({
          learnerId: user.id,
          imageBase64: base64,
          mimeType: mime,
        });
        if (result.locked) {
          Alert.alert(
            t("learnerHomework.subscriptionRequiredTitle"),
            t("learnerHomework.subscriptionRequiredBody", {
              subject: (result.detectedSubject || "").toLowerCase() || "—",
            }),
          );
        }
      } catch (err: any) {
        setUploadError(err?.message || t("learnerHomework.uploadFailed"));
      }
    },
    [t, uploadHomework, user?.id],
  );

  const onTakePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("learnerHomework.title"), t("learnerHomework.cameraPermissionDenied"));
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    await submitImage(picked.assets[0]);
  }, [submitImage, t]);

  const onPickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("learnerHomework.title"), t("learnerHomework.galleryPermissionDenied"));
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    await submitImage(picked.assets[0]);
  }, [submitImage, t]);

  const onPickPdf = useCallback(async () => {
    if (!user?.id) return;
    setUploadError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    // Cap to keep base64 payloads small enough for the JSON upload endpoint.
    if (typeof asset.size === "number" && asset.size > MAX_PDF_SIZE_BYTES) {
      setUploadError(t("learnerHomework.pdfTooLarge"));
      return;
    }
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await uploadHomework.mutateAsync({
        learnerId: user.id,
        imageBase64: base64,
        mimeType: asset.mimeType || "application/pdf",
      });
    } catch (err: any) {
      setUploadError(err?.message || t("learnerHomework.uploadFailed"));
    }
  }, [t, uploadHomework, user?.id]);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16, paddingHorizontal: hPad }]}
      contentContainerStyle={{ paddingBottom: 32, alignItems: "center" }}
    >
      <View style={{ width: contentWidth }}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <Text style={styles.title}>{t("learnerHomework.title")}</Text>
        <Text style={styles.subtitle}>{t("learnerHomework.subtitle")}</Text>

        <Text style={styles.sectionTitle}>{t("learnerHomework.yourHomework")}</Text>
        {isLoading ? (
          <AivoCard style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
          </AivoCard>
        ) : !assignments || assignments.length === 0 ? (
          <AivoCard style={styles.emptyCard}>
            <Ionicons name="document-outline" size={32} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t("learnerHomework.noAssignments")}</Text>
          </AivoCard>
        ) : (
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            {assignments.map((a) => {
              const sub = (a.detectedSubject || a.subject || "other").toLowerCase();
              const sStyle = statusStyle(a.status);
              const statusLabel = t(`learnerHomework.status.${a.status}`, {
                defaultValue: a.status,
              });
              return (
                <Pressable
                  key={a.id}
                  onPress={() => onAssignmentPress(a)}
                  accessibilityRole="button"
                  accessibilityLabel={`${sub} ${statusLabel}`}
                >
                  <AivoCard style={styles.assignmentCard}>
                    <View style={styles.assignmentRow}>
                      <View style={styles.subjectIcon}>
                        <Ionicons name={subjectIconName(sub)} size={22} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignmentSubject}>{sub}</Text>
                        <Text style={styles.assignmentMeta}>
                          {t("learnerHomework.problems", { count: a.problemCount })}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: sStyle.bg }]}>
                        <Text style={[styles.statusText, { color: sStyle.fg }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  </AivoCard>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={isTablet ? styles.captureRow : undefined}>
          <AivoCard style={[styles.captureCard, isTablet && styles.captureCardTablet]}>
            <View style={[styles.cameraPreview, { height: previewHeight }]}>
              {uploadHomework.isPending ? (
                <>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.cameraText}>{t("learnerHomework.uploading")}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="camera" size={48} color={colors.textSecondary} />
                  <Text style={styles.cameraText}>{t("learnerHomework.centerHomework")}</Text>
                </>
              )}
            </View>

            {uploadError ? <Text style={styles.uploadErrorText}>{uploadError}</Text> : null}

            <View style={styles.captureActions}>
              <AivoButton
                title={t("learnerHomework.takePhoto")}
                onPress={onTakePhoto}
                size="lg"
                disabled={uploadHomework.isPending}
                icon={<Ionicons name="camera-outline" size={20} color="#FFF" />}
                style={{ flex: 1, marginRight: 8 }}
              />
              <AivoButton
                title={t("learnerHomework.gallery")}
                onPress={onPickFromGallery}
                variant="outline"
                size="lg"
                disabled={uploadHomework.isPending}
                icon={<Ionicons name="images-outline" size={20} color={colors.primary} />}
                style={{ flex: 1 }}
              />
            </View>
          </AivoCard>

          <AivoCard style={[styles.uploadCard, isTablet && styles.uploadCardTablet]}>
            <Ionicons name="document-outline" size={32} color={colors.secondary} />
            <Text style={styles.uploadTitle}>{t("learnerHomework.uploadPDF")}</Text>
            <Text style={styles.uploadDesc}>{t("learnerHomework.uploadPDFDesc")}</Text>
            <AivoButton
              title={t("learnerHomework.chooseFile")}
              onPress={onPickPdf}
              variant="secondary"
              size="sm"
              disabled={uploadHomework.isPending}
              style={{ marginTop: spacing.sm }}
            />
          </AivoCard>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  loadingCard: { alignItems: "center", paddingVertical: spacing.lg, marginBottom: spacing.md },
  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
  },
  assignmentCard: { padding: spacing.sm },
  assignmentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  assignmentSubject: {
    fontSize: 15,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    textTransform: "capitalize",
  },
  assignmentMeta: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 11, fontFamily: "Nunito-Bold" },
  captureCard: { marginBottom: spacing.md },
  captureRow: { flexDirection: "row", gap: spacing.md, alignItems: "stretch" },
  captureCardTablet: { flex: 2 },
  uploadCardTablet: { flex: 1, justifyContent: "center" },
  cameraPreview: {
    height: 200,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  cameraText: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 8,
  },
  uploadErrorText: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  captureActions: { flexDirection: "row" },
  uploadCard: { alignItems: "center" as const, paddingVertical: spacing.lg },
  uploadTitle: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text, marginTop: 8 },
  uploadDesc: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
  },
});
