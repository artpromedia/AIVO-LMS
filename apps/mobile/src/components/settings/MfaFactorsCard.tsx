import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { useTranslation } from "@/hooks/useTranslation";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { colors, spacing, radius } from "@/constants/colors";

interface TotpEnrollResponse {
  enrollToken: string;
  otpauthUrl: string;
  base32Secret: string;
  /** Server-rendered data: URL — render directly into <Image>. */
  qrDataUrl?: string;
}

interface MfaStatus {
  mfaEnabled: boolean;
  mfaForced: boolean;
  mfaMethod?: "email" | "totp" | string;
}

interface RecoveryStatus {
  remaining: number;
  total: number;
}

/**
 * MFA factor management card — TOTP authenticator app + recovery codes.
 *
 * Mirrors the web counterparts in `apps/web/src/components/settings/mfa/`
 * (`AuthenticatorTab.tsx`, `RecoveryCodesTab.tsx`). WebAuthn passkeys are
 * intentionally omitted on mobile for now — that flow needs a native passkey
 * module (e.g. `react-native-passkeys`) which is a separate integration.
 *
 * Endpoints (identity-svc):
 *   - GET  /api/auth/mfa/status
 *   - POST /api/auth/mfa/totp/enroll   → { enrollToken, otpauthUrl, base32Secret, qrDataUrl }
 *   - POST /api/auth/mfa/totp/confirm  { enrollToken, code } → { success, recoveryCodes }
 *   - POST /api/auth/mfa/totp/disable  { password }
 *   - GET  /api/auth/mfa/recovery/status
 *   - POST /api/auth/mfa/recovery/regenerate { password } → { recoveryCodes }
 */
export function MfaFactorsCard() {
  const { t } = useTranslation();

  // Status
  const [statusLoading, setStatusLoading] = useState(true);
  const [totpEnrolled, setTotpEnrolled] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryStatus | null>(null);

  // Enrollment flow
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<TotpEnrollResponse | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Disable flow
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling, setDisabling] = useState(false);

  // Recovery code regeneration
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  // Codes display (shown both right after enroll-confirm and after regenerate).
  const [latestCodes, setLatestCodes] = useState<string[] | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const [mfaRes, recRes] = await Promise.all([
        apiFetch(API.IDENTITY, "/api/auth/mfa/status"),
        apiFetch(API.IDENTITY, "/api/auth/mfa/recovery/status"),
      ]);
      if (mfaRes.ok) {
        const m = (await mfaRes.json()) as MfaStatus;
        setTotpEnrolled(m.mfaMethod === "totp" && !!m.mfaEnabled);
      }
      if (recRes.ok) {
        const r = (await recRes.json()) as RecoveryStatus;
        setRecovery(r);
      }
    } catch {
      // Leave default state — failure is non-fatal for the rest of settings.
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const startEnroll = useCallback(async () => {
    setEnrolling(true);
    setConfirmError("");
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/totp/enroll", {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as TotpEnrollResponse | { error?: string };
      if (!res.ok || !("enrollToken" in data) || !data.enrollToken) {
        Alert.alert(
          t("common.error"),
          (data as { error?: string }).error || t("mfaFactors.enrollFailed"),
        );
        return;
      }
      setEnrollData(data as TotpEnrollResponse);
      setConfirmCode("");
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
    } finally {
      setEnrolling(false);
    }
  }, [t]);

  const confirmEnroll = useCallback(async () => {
    if (!enrollData || confirmCode.length !== 6) return;
    setConfirming(true);
    setConfirmError("");
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/totp/confirm", {
        method: "POST",
        body: JSON.stringify({
          enrollToken: enrollData.enrollToken,
          code: confirmCode,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        recoveryCodes?: string[];
        error?: string;
      };
      if (!res.ok || !data.success) {
        setConfirmError(data.error || t("mfaFactors.confirmFailed"));
        return;
      }
      setEnrollData(null);
      setConfirmCode("");
      setTotpEnrolled(true);
      // Backend issues a fresh recovery batch on enrollment — show them once.
      if (Array.isArray(data.recoveryCodes) && data.recoveryCodes.length > 0) {
        setLatestCodes(data.recoveryCodes);
        setRecovery({ remaining: data.recoveryCodes.length, total: 10 });
      } else {
        loadStatus();
      }
    } catch {
      setConfirmError(t("auth.somethingWentWrong"));
    } finally {
      setConfirming(false);
    }
  }, [enrollData, confirmCode, t, loadStatus]);

  const disableTotp = useCallback(async () => {
    if (!disablePassword) return;
    setDisabling(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/totp/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        Alert.alert(t("common.error"), data.error || t("mfaFactors.disableFailed"));
        return;
      }
      setShowDisable(false);
      setDisablePassword("");
      setTotpEnrolled(false);
      setLatestCodes(null);
      loadStatus();
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
    } finally {
      setDisabling(false);
    }
  }, [disablePassword, loadStatus, t]);

  const regenerate = useCallback(async () => {
    if (!regenPassword) return;
    setRegenerating(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/mfa/recovery/regenerate", {
        method: "POST",
        body: JSON.stringify({ password: regenPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        recoveryCodes?: string[];
        codes?: string[];
        error?: string;
      };
      if (!res.ok) {
        Alert.alert(t("common.error"), data.error || t("mfaFactors.regenFailed"));
        return;
      }
      const codes = data.recoveryCodes ?? data.codes ?? [];
      setLatestCodes(codes);
      setRecovery({ remaining: codes.length, total: 10 });
      setShowRegenerate(false);
      setRegenPassword("");
    } catch {
      Alert.alert(t("common.error"), t("auth.somethingWentWrong"));
    } finally {
      setRegenerating(false);
    }
  }, [regenPassword, t]);

  const copyCodes = useCallback(async () => {
    if (!latestCodes) return;
    await Clipboard.setStringAsync(latestCodes.join("\n"));
    Alert.alert(t("common.success"), t("mfaFactors.codesCopied"));
  }, [latestCodes, t]);

  const copySecret = useCallback(async () => {
    if (!enrollData) return;
    await Clipboard.setStringAsync(enrollData.base32Secret);
    Alert.alert(t("common.success"), t("mfaFactors.secretCopied"));
  }, [enrollData, t]);

  if (statusLoading) {
    return (
      <AivoCard style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </AivoCard>
    );
  }

  return (
    <AivoCard style={styles.card}>
      {/* TOTP authenticator app section */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("mfaFactors.totpTitle")}</Text>
          <Text style={styles.desc}>{t("mfaFactors.totpDesc")}</Text>
        </View>
        <View style={[styles.badge, totpEnrolled && styles.badgeOn]}>
          <Text style={[styles.badgeText, totpEnrolled && styles.badgeTextOn]}>
            {totpEnrolled ? t("common.on") : t("common.off")}
          </Text>
        </View>
      </View>

      {enrollData ? (
        <View style={styles.section}>
          <Text style={styles.desc}>{t("mfaFactors.scanQr")}</Text>
          {enrollData.qrDataUrl ? (
            <Image
              source={{ uri: enrollData.qrDataUrl }}
              style={styles.qr}
              accessibilityLabel={t("mfaFactors.qrAlt")}
            />
          ) : null}
          <Text style={styles.helper}>{t("mfaFactors.manualEntry")}</Text>
          <Pressable accessibilityRole="button" onPress={copySecret} style={styles.secretRow}>
            <Text style={styles.secretText} selectable>
              {enrollData.base32Secret}
            </Text>
            <Ionicons name="copy-outline" size={18} color={colors.textSecondary} />
          </Pressable>

          <Text style={styles.fieldLabel}>{t("mfaFactors.enterCode")}</Text>
          <TextInput
            style={[styles.codeInput]}
            value={confirmCode}
            onChangeText={(v) => setConfirmCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            accessibilityLabel={t("mfaFactors.enterCode")}
          />
          {confirmError ? <Text style={styles.error}>{confirmError}</Text> : null}
          <View style={styles.btnRow}>
            <AivoButton
              title={confirming ? t("common.saving") : t("common.confirm")}
              onPress={confirmEnroll}
              loading={confirming}
              disabled={confirmCode.length !== 6}
              size="sm"
              style={{ flex: 1 }}
            />
            <Pressable accessibilityRole="button"
              style={styles.cancelBtn}
              onPress={() => {
                setEnrollData(null);
                setConfirmCode("");
                setConfirmError("");
              }}
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      ) : showDisable ? (
        <View style={styles.section}>
          <Text style={styles.desc}>{t("mfaFactors.disableConfirm")}</Text>
          <TextInput accessibilityLabel={t("accountSettings.enterPassword")}
            style={styles.input}
            value={disablePassword}
            onChangeText={setDisablePassword}
            placeholder={t("accountSettings.enterPassword")}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
          />
          <View style={styles.btnRow}>
            <AivoButton
              title={disabling ? t("common.saving") : t("mfaFactors.disable")}
              onPress={disableTotp}
              loading={disabling}
              disabled={!disablePassword}
              variant="outline"
              size="sm"
              style={{ flex: 1 }}
            />
            <Pressable accessibilityRole="button"
              style={styles.cancelBtn}
              onPress={() => {
                setShowDisable(false);
                setDisablePassword("");
              }}
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button"
          style={[styles.cta, totpEnrolled && styles.ctaDanger]}
          onPress={() => (totpEnrolled ? setShowDisable(true) : startEnroll())}
          disabled={enrolling}
        >
          {enrolling ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.ctaText, totpEnrolled && styles.ctaTextDanger]}>
              {totpEnrolled ? t("mfaFactors.disable") : t("mfaFactors.enroll")}
            </Text>
          )}
        </Pressable>
      )}

      {/* Recovery codes section */}
      <View style={styles.divider} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("mfaFactors.recoveryTitle")}</Text>
          <Text style={styles.desc}>
            {recovery
              ? t("mfaFactors.recoveryRemaining", {
                  remaining: recovery.remaining,
                  total: recovery.total,
                })
              : t("mfaFactors.recoveryDesc")}
          </Text>
        </View>
      </View>

      {latestCodes && latestCodes.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.warning}>{t("mfaFactors.codesWarning")}</Text>
          <View style={styles.codesGrid}>
            {latestCodes.map((c) => (
              <Text key={c} style={styles.codeChip} selectable>
                {c}
              </Text>
            ))}
          </View>
          <View style={styles.btnRow}>
            <AivoButton
              title={t("mfaFactors.copyCodes")}
              onPress={copyCodes}
              size="sm"
              variant="outline"
              style={{ flex: 1 }}
            />
            <AivoButton
              title={t("common.done")}
              onPress={() => setLatestCodes(null)}
              size="sm"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : showRegenerate ? (
        <View style={styles.section}>
          <Text style={styles.desc}>{t("mfaFactors.regenConfirm")}</Text>
          <TextInput accessibilityLabel={t("accountSettings.enterPassword")}
            style={styles.input}
            value={regenPassword}
            onChangeText={setRegenPassword}
            placeholder={t("accountSettings.enterPassword")}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
          />
          <View style={styles.btnRow}>
            <AivoButton
              title={regenerating ? t("common.saving") : t("mfaFactors.regen")}
              onPress={regenerate}
              loading={regenerating}
              disabled={!regenPassword}
              size="sm"
              style={{ flex: 1 }}
            />
            <Pressable accessibilityRole="button"
              style={styles.cancelBtn}
              onPress={() => {
                setShowRegenerate(false);
                setRegenPassword("");
              }}
            >
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" style={styles.cta} onPress={() => setShowRegenerate(true)}>
          <Text style={styles.ctaText}>{t("mfaFactors.regen")}</Text>
        </Pressable>
      )}
    </AivoCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  loadingRow: {
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: 2,
  },
  desc: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    lineHeight: 18,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  badgeOn: {
    backgroundColor: colors.success,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  badgeTextOn: {
    color: "#FFF",
  },
  section: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  qr: {
    width: 200,
    height: 200,
    alignSelf: "center",
    backgroundColor: "#FFF",
    borderRadius: radius.md,
    marginVertical: spacing.sm,
  },
  helper: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  secretRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  secretText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    letterSpacing: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    marginTop: 4,
  },
  codeInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    textAlign: "center",
    letterSpacing: 8,
    fontSize: 20,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.error,
    marginTop: 4,
  },
  warning: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.error,
    marginBottom: spacing.xs,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
  },
  cta: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radius.full,
    alignItems: "center",
  },
  ctaDanger: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: "Nunito-Bold",
    color: "#FFF",
  },
  ctaTextDanger: {
    color: colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  codesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: spacing.xs,
  },
  codeChip: {
    fontSize: 13,
    fontFamily: "Menlo",
    color: colors.text,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    letterSpacing: 1,
  },
});
