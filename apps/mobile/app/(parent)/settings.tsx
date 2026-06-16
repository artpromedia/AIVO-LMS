import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { useTranslation } from "@/hooks/useTranslation";
import { AccountSettingsCard } from "@/src/components/settings/AccountSettingsCard";
import { colors, spacing, radius } from "@/constants/colors";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";

interface ParentLearner {
  id: string;
  name: string;
}

/**
 * Parent settings screen.
 *
 * Universal account flows (profile chip, edit name/email, change password,
 * MFA, delete account, log out, avatar upload) live in the shared
 * `AccountSettingsCard`. This screen only owns the parent-specific extras:
 *   - Manage learner PIN (PUT /api/users/learners/:id { pin }) — per-learner
 *     selection, mirroring the parent's view of every learner on the account.
 *   - Export account data (GET /api/users/me)
 */
export default function ParentSettings() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [learners, setLearners] = useState<ParentLearner[] | null>(null);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);

  const [exportingData, setExportingData] = useState(false);

  // Lazily fetch the parent's learners the first time the manage-PIN modal
  // is opened. Web's parent flow already returns the full list from
  // /api/users/learners; we mirror that and let the parent pick which
  // learner's PIN to update instead of silently picking the first one.
  const loadLearners = useCallback(async () => {
    setLearnersLoading(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/users/learners");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        Alert.alert(t("common.error"), data?.error || t("parentSettings.pinLoadFailed"));
        setLearners([]);
        return;
      }
      const list = await res.json();
      const normalized: ParentLearner[] = Array.isArray(list)
        ? list
            .filter((l: any) => l && typeof l.id === "string")
            .map((l: any) => ({ id: l.id as string, name: (l.name as string) || "" }))
        : [];
      setLearners(normalized);
      // Default selection — first learner — but only if the parent hasn't
      // already chosen one in a previous open.
      setSelectedLearnerId((prev) =>
        prev && normalized.some((l) => l.id === prev) ? prev : (normalized[0]?.id ?? null),
      );
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
      setLearners([]);
    } finally {
      setLearnersLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (pinModalVisible && learners === null) {
      loadLearners();
    }
  }, [pinModalVisible, learners, loadLearners]);

  const handleSavePin = useCallback(async () => {
    if (newPin.length !== 4) {
      Alert.alert(t("common.error"), t("parentSettings.pinLengthError"));
      return;
    }
    if (!selectedLearnerId || !learners || learners.length === 0) {
      Alert.alert(t("common.error"), t("parentSettings.pinNoLearners"));
      return;
    }
    const target = learners.find((l) => l.id === selectedLearnerId);
    if (!target) {
      Alert.alert(t("common.error"), t("parentSettings.pinNoLearners"));
      return;
    }
    setSavingPin(true);
    try {
      const updateRes = await apiFetch(API.IDENTITY, `/api/users/learners/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ pin: newPin }),
      });
      if (updateRes.ok) {
        Alert.alert(t("common.success"), t("parentSettings.pinUpdated", { name: target.name }));
        setPinModalVisible(false);
        setNewPin("");
      } else {
        const data = await updateRes.json().catch(() => ({}));
        Alert.alert(t("common.error"), data?.error || t("parentSettings.pinUpdateFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
    } finally {
      setSavingPin(false);
    }
  }, [newPin, selectedLearnerId, learners, t]);

  const handleExportData = useCallback(async () => {
    setExportingData(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/users/me");
      if (res.ok) {
        const data = await res.json();
        Alert.alert(
          t("parentSettings.exportData"),
          t("parentSettings.exportSummary", {
            name: data.name,
            email: data.email,
            role: data.role,
          }),
        );
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert(t("common.error"), data?.error || t("parentSettings.exportFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
    } finally {
      setExportingData(false);
    }
  }, [t]);

  const parentRows: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress: () => void;
    loading?: boolean;
  }[] = [
    {
      icon: "key-outline",
      label: t("parentSettings.managePins"),
      onPress: () => setPinModalVisible(true),
    },
    {
      icon: "download-outline",
      label: t("parentSettings.exportData"),
      onPress: handleExportData,
      loading: exportingData,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
      }}
    >
      <Text style={styles.title}>{t("parentSettings.title")}</Text>

      <AccountSettingsCard enableAvatarUpload />

      <AivoCard style={styles.parentCard}>
        {parentRows.map((row, i) => (
          <Pressable accessibilityRole="button"
            key={row.label}
            style={[styles.row, i < parentRows.length - 1 && styles.rowBorder]}
            onPress={row.onPress}
            disabled={row.loading}
          >
            <Ionicons name={row.icon} size={22} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            )}
          </Pressable>
        ))}
      </AivoCard>

      <Text style={styles.version}>{t("common.appVersion")}</Text>

      <Modal visible={pinModalVisible} transparent animationType="slide">
        <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setPinModalVisible(false)}>
          <Pressable accessibilityRole="button" style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t("parentSettings.managePins")}</Text>

            {learnersLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : learners && learners.length > 0 ? (
              <>
                <Text style={styles.fieldLabel}>{t("parentSettings.pinSelectLearner")}</Text>
                <View style={styles.learnerChips}>
                  {learners.map((l) => {
                    const selected = l.id === selectedLearnerId;
                    return (
                      <Pressable
                        key={l.id}
                        onPress={() => setSelectedLearnerId(l.id)}
                        style={[styles.learnerChip, selected && styles.learnerChipSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text
                          style={[
                            styles.learnerChipText,
                            selected && styles.learnerChipTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {l.name || t("parentSettings.unnamedLearner")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : learners && learners.length === 0 ? (
              <Text style={styles.modalEmpty}>{t("parentSettings.pinNoLearners")}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>{t("parentSettings.newPinLabel")}</Text>
            <TextInput accessibilityLabel={t("parentSettings.newPinLabel")}
              style={[
                styles.modalInput,
                {
                  textAlign: "center",
                  letterSpacing: 12,
                  fontSize: 24,
                  fontFamily: "Nunito-ExtraBold",
                },
              ]}
              value={newPin}
              onChangeText={(v) => setNewPin(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="• • • •"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              editable={!!selectedLearnerId}
            />
            <View style={styles.modalActions}>
              <AivoButton
                title={t("common.cancel")}
                onPress={() => {
                  setPinModalVisible(false);
                  setNewPin("");
                }}
                variant="outline"
                size="sm"
                style={styles.modalButton}
              />
              <AivoButton
                title={savingPin ? t("common.saving") : t("common.save")}
                onPress={handleSavePin}
                loading={savingPin}
                size="sm"
                style={styles.modalButton}
                disabled={!selectedLearnerId || newPin.length !== 4 || savingPin}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  parentCard: { marginTop: spacing.sm, padding: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
  },
  version: {
    marginTop: spacing.xl,
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  modalInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: "Nunito-Regular",
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.md,
  },
  modalButton: { flex: 1 },
  modalLoading: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  modalEmpty: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
  learnerChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.sm,
  },
  learnerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    maxWidth: "100%",
  },
  learnerChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  learnerChipText: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
  },
  learnerChipTextSelected: {
    color: colors.white,
  },
});
