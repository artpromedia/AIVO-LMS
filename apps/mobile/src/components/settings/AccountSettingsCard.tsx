/**
 * Shared role-agnostic account settings card.
 *
 * Provides the standard self-service account actions that every role
 * needs from a Settings screen:
 *   - Read-only profile chip (avatar initial, name, email)
 *   - Optional avatar upload (opt in via `enableAvatarUpload`) backed by
 *     POST/DELETE /api/users/me/avatar
 *   - Edit account details (name + email) via PUT /api/auth/profile
 *   - "Change password" link → routes to (auth)/change-password
 *   - Two-factor authentication toggle (email-code MFA)
 *   - Log out (with confirmation)
 *   - Delete account via DELETE /api/auth/account (password-confirmed)
 *
 * Intentionally excludes role-specific concerns (parent PIN management,
 * language selection, data export) so the card can be safely reused across
 * roles. Roles that need those flows compose them around the shared card.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, getToken } from "@/lib/api";
import { API } from "@/constants/api";
import { colors, spacing, radius } from "@/constants/colors";
import { MfaFactorsCard } from "./MfaFactorsCard";

interface AccountSettingsCardProps {
  /** Single character used for the placeholder avatar (e.g. 'T' for teacher). */
  avatarInitial?: string;
  /**
   * When true, the avatar becomes a tap target that lets the user pick a new
   * profile image (validated for type/size and uploaded to identity-svc). A
   * long-press removes the image. When false, the avatar is a static initial.
   */
  enableAvatarUpload?: boolean;
}

/**
 * Shape React Native's `FormData.append` accepts for file uploads. The DOM
 * `Blob`/`File` types do not match what RN's bridge serializes, so we keep
 * a local interface and `Blob`-cast at the append site rather than reaching
 * for `as any`.
 */
interface RNFormDataFilePart {
  uri: string;
  name: string;
  type: string;
}

export function AccountSettingsCard({
  avatarInitial,
  enableAvatarUpload = false,
}: AccountSettingsCardProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editEmail, setEditEmail] = useState(user?.email || "");
  const [savingAccount, setSavingAccount] = useState(false);

  // Avatar upload (opt-in)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  useEffect(() => {
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user]);

  const uploadAvatar = useCallback(
    async (uri: string, mime: string) => {
      setAvatarBusy(true);
      try {
        const token = await getToken();
        if (!token) {
          Alert.alert(t("common.error"), t("common.error"));
          return;
        }
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const fd = new FormData();
        const filePart: RNFormDataFilePart = {
          uri,
          name: `avatar.${ext}`,
          type: mime,
        };
        // RN's FormData accepts `{ uri, name, type }` parts; the DOM
        // typings disagree, so cast to Blob for the append signature only.
        fd.append("file", filePart as unknown as Blob);
        const res = await fetch(`${API.IDENTITY}/api/users/me/avatar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          Alert.alert(t("common.error"), data?.error || t("accountSettings.avatarUploadFailed"));
          return;
        }
        const newUrl: string = data.avatarUrl;
        // The API returns a path like /api/avatars/...; <Image> needs an
        // absolute URL pointing at identity-svc.
        const absolute = newUrl.startsWith("http") ? newUrl : `${API.IDENTITY}${newUrl}`;
        setAvatarUrl(`${absolute}?v=${Date.now()}`);
      } catch {
        Alert.alert(t("common.error"), t("accountSettings.avatarUploadFailed"));
      } finally {
        setAvatarBusy(false);
      }
    },
    [t],
  );

  const handlePickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("common.error"), t("accountSettings.avatarPermissionDenied"));
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const mime = asset.mimeType || "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      Alert.alert(t("common.error"), t("accountSettings.avatarInvalidType"));
      return;
    }
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert(t("common.error"), t("accountSettings.avatarTooLarge"));
      return;
    }
    await uploadAvatar(asset.uri, mime);
  }, [t, uploadAvatar]);

  const handleRemoveAvatar = useCallback(() => {
    Alert.alert(t("accountSettings.avatarRemove"), t("accountSettings.avatarRemoveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("accountSettings.avatarRemove"),
        style: "destructive",
        onPress: async () => {
          setAvatarBusy(true);
          try {
            const res = await apiFetch(API.IDENTITY, "/api/users/me/avatar", { method: "DELETE" });
            if (res.ok || res.status === 204) {
              setAvatarUrl(null);
            }
          } finally {
            setAvatarBusy(false);
          }
        },
      },
    ]);
  }, [t]);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Two-factor authentication (email-code MFA) state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaForced, setMfaForced] = useState(false);
  const [mfaPassword, setMfaPassword] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMsg, setMfaMsg] = useState("");
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [mfaEnableToken, setMfaEnableToken] = useState("");
  const [mfaEnableCode, setMfaEnableCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/status");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setMfaEnabled(!!data.mfaEnabled);
          setMfaForced(!!data.mfaForced);
        }
      } catch {
        // network error — leave MFA section in default off state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMfaToggle = useCallback(async () => {
    if (!mfaPassword) return;
    setMfaLoading(true);
    setMfaMsg("");
    try {
      if (mfaEnabled) {
        const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/disable", {
          method: "POST",
          body: JSON.stringify({ password: mfaPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setMfaEnabled(false);
          setMfaMsg(t("accountSettings.mfaDisabled"));
          setShowMfaInput(false);
          setMfaPassword("");
        } else {
          setMfaMsg(data?.error || t("common.error"));
        }
      } else {
        const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/enable", {
          method: "POST",
          body: JSON.stringify({ password: mfaPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setMfaEnableToken(data.mfaToken);
          setMfaPassword("");
        } else {
          setMfaMsg(data?.error || t("common.error"));
        }
      }
    } catch {
      setMfaMsg(t("common.error"));
    }
    setMfaLoading(false);
  }, [mfaEnabled, mfaPassword, t]);

  const handleMfaConfirmEnable = useCallback(async () => {
    if (mfaEnableCode.length !== 6) return;
    setMfaLoading(true);
    setMfaMsg("");
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/confirm-enable", {
        method: "POST",
        body: JSON.stringify({ mfaToken: mfaEnableToken, code: mfaEnableCode }),
        skipAuth: true,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMfaEnabled(true);
        setMfaMsg(t("accountSettings.mfaEnabled"));
        setMfaEnableToken("");
        setMfaEnableCode("");
        setShowMfaInput(false);
      } else {
        setMfaMsg(data?.error || t("common.error"));
        setMfaEnableCode("");
      }
    } catch {
      setMfaMsg(t("common.error"));
    }
    setMfaLoading(false);
  }, [mfaEnableCode, mfaEnableToken, t]);

  const openAccountModal = useCallback(() => {
    setEditName(user?.name || "");
    setEditEmail(user?.email || "");
    setAccountModalVisible(true);
  }, [user?.name, user?.email]);

  const handleSaveAccount = useCallback(async () => {
    if (!editName.trim()) {
      Alert.alert(t("common.error"), t("accountSettings.nameRequired"));
      return;
    }
    setSavingAccount(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });
      if (res.ok) {
        Alert.alert(t("common.success"), t("accountSettings.accountUpdated"));
        setAccountModalVisible(false);
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert(t("common.error"), data?.error || t("accountSettings.accountUpdateFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
    } finally {
      setSavingAccount(false);
    }
  }, [editName, editEmail, t]);

  const handleChangePassword = useCallback(() => {
    // `as Href` is the documented expo-router escape hatch for routes
    // whose typed-routes entry hasn't been regenerated yet — the
    // `(auth)/change-password.tsx` file exists, but `.expo/types/router.d.ts`
    // is regenerated only on dev/build, not on commit.
    router.push("/(auth)/change-password" as Href);
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(t("common.logOut"), t("common.logOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.logOut"), style: "destructive", onPress: logout },
    ]);
  }, [t, logout]);

  const openDeleteModal = useCallback(() => {
    setDeletePassword("");
    setDeleteModalVisible(true);
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (!deletePassword) {
      Alert.alert(t("common.error"), t("accountSettings.deletePasswordRequired"));
      return;
    }
    setDeleting(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res.ok) {
        setDeleteModalVisible(false);
        await logout();
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert(t("common.error"), data?.error || t("accountSettings.deleteFailed"));
      }
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
    } finally {
      setDeleting(false);
    }
  }, [deletePassword, t, logout]);

  const initial =
    (avatarInitial && avatarInitial[0]) ||
    user?.name?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "?";

  return (
    <View>
      <AivoCard style={styles.profileCard}>
        <View style={styles.profileRow}>
          {enableAvatarUpload ? (
            <Pressable
              onPress={handlePickAvatar}
              onLongPress={avatarUrl ? handleRemoveAvatar : undefined}
              disabled={avatarBusy}
              style={styles.avatar}
              accessibilityLabel={t("accountSettings.avatarChange")}
            >
              {avatarBusy ? (
                <ActivityIndicator color={colors.white} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name || ""}
            </Text>
            {!!user?.email && (
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            )}
            {enableAvatarUpload && (
              <Pressable accessibilityRole="button" onPress={handlePickAvatar} disabled={avatarBusy}>
                <Text style={styles.avatarLink}>
                  {avatarUrl ? t("accountSettings.avatarChange") : t("accountSettings.avatarAdd")}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </AivoCard>

      <Pressable accessibilityRole="button" onPress={openAccountModal}>
        <AivoCard style={styles.row}>
          <Ionicons name="person-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>{t("accountSettings.accountDetails")}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </AivoCard>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={handleChangePassword}>
        <AivoCard style={styles.row}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>{t("accountSettings.changePassword")}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </AivoCard>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={openDeleteModal}>
        <AivoCard style={styles.row}>
          <Ionicons name="trash-outline" size={22} color={colors.error} />
          <Text style={[styles.rowLabel, { color: colors.error }]}>
            {t("accountSettings.deleteAccount")}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.error} />
        </AivoCard>
      </Pressable>

      <AivoCard style={styles.mfaCard}>
        <View style={styles.mfaHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mfaTitle}>{t("accountSettings.twoFactorAuth")}</Text>
            <Text style={styles.mfaDesc}>{t("accountSettings.mfaDesc")}</Text>
          </View>
          <View style={[styles.mfaBadge, mfaEnabled && styles.mfaBadgeOn]}>
            <Text style={[styles.mfaBadgeText, mfaEnabled && styles.mfaBadgeTextOn]}>
              {mfaEnabled ? t("common.on") : t("common.off")}
            </Text>
          </View>
        </View>
        {mfaMsg ? <Text style={styles.mfaMsg}>{mfaMsg}</Text> : null}
        {mfaEnableToken ? (
          <View style={styles.mfaInputSection}>
            <Text style={styles.mfaDesc}>{t("accountSettings.enterCode")}</Text>
            <TextInput accessibilityLabel={t("accountSettings.enterCode")}
              style={[
                styles.mfaInput,
                {
                  textAlign: "center",
                  letterSpacing: 8,
                  fontSize: 20,
                  fontFamily: "Nunito-Bold",
                },
              ]}
              value={mfaEnableCode}
              onChangeText={(v) => setMfaEnableCode(v.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
            />
            <View style={styles.mfaBtnRow}>
              <AivoButton
                title={mfaLoading ? t("common.saving") : t("common.confirm")}
                onPress={handleMfaConfirmEnable}
                loading={mfaLoading}
                disabled={mfaEnableCode.length !== 6}
                size="sm"
                style={{ flex: 1 }}
              />
              <Pressable accessibilityRole="button"
                style={styles.mfaCancelBtn}
                onPress={() => {
                  setMfaEnableToken("");
                  setMfaEnableCode("");
                  setShowMfaInput(false);
                }}
              >
                <Text style={styles.mfaCancelText}>{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </View>
        ) : !showMfaInput ? (
          <Pressable accessibilityRole="button"
            style={[styles.mfaToggleBtn, mfaEnabled && styles.mfaToggleBtnDanger]}
            onPress={() => setShowMfaInput(true)}
            disabled={mfaForced && mfaEnabled}
          >
            <Text style={[styles.mfaToggleText, mfaEnabled && styles.mfaToggleTextDanger]}>
              {mfaEnabled ? t("accountSettings.disableMfa") : t("accountSettings.enableMfa")}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.mfaInputSection}>
            <TextInput accessibilityLabel={t("accountSettings.enterPassword")}
              style={styles.mfaInput}
              value={mfaPassword}
              onChangeText={setMfaPassword}
              placeholder={t("accountSettings.enterPassword")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
            />
            <View style={styles.mfaBtnRow}>
              <AivoButton
                title={mfaLoading ? t("common.saving") : t("common.confirm")}
                onPress={handleMfaToggle}
                loading={mfaLoading}
                disabled={!mfaPassword}
                size="sm"
                style={{ flex: 1 }}
              />
              <Pressable accessibilityRole="button"
                style={styles.mfaCancelBtn}
                onPress={() => {
                  setShowMfaInput(false);
                  setMfaPassword("");
                }}
              >
                <Text style={styles.mfaCancelText}>{t("common.cancel")}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </AivoCard>

      <MfaFactorsCard />

      <Pressable accessibilityRole="button" style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>{t("common.logOut")}</Text>
      </Pressable>

      {/* Account details modal */}
      <Modal
        visible={accountModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAccountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("accountSettings.accountDetails")}</Text>

            <Text style={styles.label}>{t("accountSettings.fullName")}</Text>
            <TextInput accessibilityLabel={t("accountSettings.fullName")}
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder={t("accountSettings.fullName")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />

            <Text style={styles.label}>{t("auth.email")}</Text>
            <TextInput accessibilityLabel={t("auth.emailPlaceholder")}
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button"
                style={styles.modalCancel}
                onPress={() => setAccountModalVisible(false)}
                disabled={savingAccount}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </Pressable>
              <AivoButton
                title={savingAccount ? t("common.saving") : t("common.save")}
                onPress={handleSaveAccount}
                loading={savingAccount}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete account modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("accountSettings.deleteAccount")}</Text>
            <Text style={styles.modalBody}>{t("accountSettings.deleteWarning")}</Text>

            <Text style={styles.label}>{t("auth.password")}</Text>
            <TextInput accessibilityLabel={t("auth.passwordPlaceholder")}
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
            />

            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button"
                style={styles.modalCancel}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button"
                style={[styles.dangerBtn, deleting && { opacity: 0.6 }]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                <Text style={styles.dangerBtnText}>
                  {deleting ? t("common.loading") : t("accountSettings.confirmDelete")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: { marginBottom: spacing.md },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarLink: {
    color: colors.primary,
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    marginTop: 6,
  },
  avatarText: { fontSize: 20, fontFamily: "Nunito-ExtraBold", color: colors.white },
  name: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text },
  email: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.textSecondary },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.error,
    marginTop: spacing.lg,
  },
  logoutText: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.error },

  mfaCard: { marginTop: spacing.sm, padding: 0 },
  mfaHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  mfaTitle: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  mfaDesc: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  mfaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  mfaBadgeOn: { backgroundColor: colors.successSoft },
  mfaBadgeText: {
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
  },
  mfaBadgeTextOn: { color: colors.success },
  mfaMsg: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.primary,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  mfaToggleBtn: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  mfaToggleBtnDanger: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  mfaToggleText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.white },
  mfaToggleTextDanger: { color: colors.error },
  mfaInputSection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 8,
  },
  mfaInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.text,
  },
  mfaBtnRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  mfaCancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  mfaCancelText: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalBody: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    backgroundColor: colors.surface,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: spacing.lg,
    alignItems: "center",
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
  },
  dangerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerBtnText: {
    fontSize: 15,
    fontFamily: "Nunito-Bold",
    color: colors.white,
  },
});
