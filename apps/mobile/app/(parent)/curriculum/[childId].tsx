import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import {
  useCurriculumUploads,
  useDeleteCurriculumUpload,
  useParseCurriculumPreview,
  useSaveCurriculumUpload,
  type CurriculumParsedFocus,
} from "@/hooks/useCurriculumUploads";

type PickedDoc = { name: string; base64: string; mimeType: string };

async function pickDoc(): Promise<PickedDoc | null> {
  try {
    const DP: any = await import("expo-document-picker");
    const res = await DP.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (res?.canceled) return null;
    const asset = res?.assets?.[0];
    if (!asset?.uri) return null;
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return {
      name: asset.name ?? "document",
      base64,
      mimeType: asset.mimeType ?? "application/pdf",
    };
  } catch {
    return null;
  }
}

/**
 * Parent curriculum upload (MOB-PAR-007) — mirror of web's
 * `/parent/learners/[learnerId]/curriculum`, wired to the REAL tutor-svc
 * weekly-sync pipeline (Wave B): paste text or pick a PDF/photo → AI
 * parse-preview → review → save. Saved uploads are the same
 * `curriculum_uploads` rows lesson generation anchors to, so the next
 * lesson teaches in sync with class.
 */
export default function ParentCurriculumScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const learnerId = childId ?? "";
  const { data: learner } = useLearner(learnerId);

  const uploadsQuery = useCurriculumUploads(learnerId);
  const parseMutation = useParseCurriculumPreview();
  const saveMutation = useSaveCurriculumUpload();
  const deleteMutation = useDeleteCurriculumUpload(learnerId);

  const [text, setText] = useState("");
  const [picked, setPicked] = useState<PickedDoc | null>(null);
  const [preview, setPreview] = useState<CurriculumParsedFocus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const busy = parseMutation.isPending || saveMutation.isPending;

  async function onPick() {
    setError(null);
    const doc = await pickDoc();
    if (doc) {
      setPicked(doc);
      setPreview(null);
    }
  }

  async function onParse() {
    setError(null);
    setPreview(null);
    setSavedFlash(false);
    try {
      const result = await parseMutation.mutateAsync({
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(picked ? { imageBase64: picked.base64, mimeType: picked.mimeType } : {}),
      });
      setPreview(result.parsed);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("parentCurriculum.parseError", "Could not read that — try pasting the text."),
      );
    }
  }

  async function onSave() {
    if (!preview) return;
    setError(null);
    try {
      await saveMutation.mutateAsync({
        learnerId,
        subject: preview.subject ?? "other",
        parsedFocus: preview,
        ...(text.trim() ? { text: text.trim() } : {}),
        ...(picked
          ? { imageBase64: picked.base64, mimeType: picked.mimeType, fileName: picked.name }
          : {}),
        ...(preview.weekStart ? { weekStart: preview.weekStart } : {}),
        ...(preview.weekEnd ? { weekEnd: preview.weekEnd } : {}),
      });
      setText("");
      setPicked(null);
      setPreview(null);
      setSavedFlash(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("parentCurriculum.saveError", "Could not save. Please try again."),
      );
    }
  }

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
            defaultValue: `Paste or photograph this week's class plan so AIVO teaches ${learner?.firstName ?? "your learner"} the same topics as school.`,
          })}
        </Text>

        <TextInput
          multiline
          value={text}
          onChangeText={(v) => {
            setText(v);
            setPreview(null);
          }}
          placeholder={t("parentCurriculum.pastePlaceholder", "Paste this week's plan…")}
          placeholderTextColor={palette.inkMuted}
          style={[styles.textArea, { borderColor: palette.primary, color: palette.ink }]}
          accessibilityLabel={t("parentCurriculum.pasteLabel", "This week's class plan")}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("parentCurriculum.upload", "Upload a document")}
          onPress={onPick}
          disabled={busy}
          style={[styles.uploadBtn, { borderColor: palette.primary }]}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={palette.primary} />
          <Text style={[styles.uploadText, { color: palette.primary }]} numberOfLines={1}>
            {picked ? picked.name : t("parentCurriculum.upload", "Upload a document")}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("parentCurriculum.parse", "Preview with AI")}
          onPress={onParse}
          disabled={busy || (!text.trim() && !picked)}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: palette.primary,
              opacity: busy || (!text.trim() && !picked) ? 0.5 : 1,
            },
          ]}
        >
          {parseMutation.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {t("parentCurriculum.parse", "Preview with AI")}
            </Text>
          )}
        </Pressable>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {savedFlash ? (
          <Text style={[styles.saved, { color: palette.primary }]}>
            {t("parentCurriculum.savedFlash", "Saved — AIVO will teach this week's topics.")}
          </Text>
        ) : null}
      </Card>

      {preview && (
        <Card tone="raised" style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>
            {t("parentCurriculum.previewTitle", "Review what we found")}
          </Text>
          <Text style={[styles.body, { color: palette.ink }]}>
            {preview.title ?? preview.subject ?? ""}
          </Text>
          {(preview.topics ?? []).slice(0, 6).map((topic) => (
            <View key={topic} style={styles.fileRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={palette.primary} />
              <Text style={[styles.fileName, { color: palette.ink }]} numberOfLines={1}>
                {topic}
              </Text>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("parentCurriculum.save", "Save for this week")}
            onPress={onSave}
            disabled={busy}
            style={[
              styles.primaryBtn,
              { backgroundColor: palette.primary, opacity: busy ? 0.5 : 1 },
            ]}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t("parentCurriculum.save", "Save for this week")}
              </Text>
            )}
          </Pressable>
        </Card>
      )}

      {(uploadsQuery.data?.length ?? 0) > 0 && (
        <Card tone="raised" style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>
            {t("parentCurriculum.uploaded", "Saved weekly plans")}
          </Text>
          {uploadsQuery.data!.map((row) => (
            <View key={row.id} style={styles.fileRow}>
              <Ionicons name="document-text-outline" size={18} color={palette.primary} />
              <Text style={[styles.fileName, { color: palette.ink }]} numberOfLines={1}>
                {(row.title ?? row.subject) +
                  (row.weekStart ? ` · ${String(row.weekStart).slice(0, 10)}` : "") +
                  (row.status === "ARCHIVED"
                    ? ` · ${t("parentCurriculum.archived", "archived")}`
                    : "")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("parentCurriculum.remove", "Remove")}
                onPress={() => deleteMutation.mutate({ id: row.id })}
                disabled={deleteMutation.isPending}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={palette.inkMuted} />
              </Pressable>
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
  textArea: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
    textAlignVertical: "top",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  uploadText: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.xl,
    marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  error: { color: colors.error, fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  saved: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileName: { flex: 1, fontSize: 14, fontFamily: fontFamilies.bodySemiBold },
});
