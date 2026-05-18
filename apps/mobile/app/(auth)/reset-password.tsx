/**
 * Email-link reset-password screen.
 *
 * Reached via the deep link `aivo://reset-password?token=…` (the same token
 * the identity-svc emailed in `${webOrigin}/reset-password?token=…`). Mirrors
 * the web `apps/web/src/app/reset-password/page.tsx` flow:
 *
 *   1. Read `token` from query params; show an error if missing.
 *   2. Collect a new password + confirmation, with the same client-side
 *      strength heuristic the change-password screen uses.
 *   3. POST `/api/auth/reset-password` with `{ token, newPassword }`. The
 *      server returns 400 + a `reasons[]` array on policy failure so we can
 *      surface human-readable hints.
 *   4. On success, route to login. (The server invalidates all sessions
 *      for the user as part of the reset, so there's nothing else to clear.)
 *
 * Unauthenticated; uses `skipAuth` on `apiFetch` because the user is
 * proving identity via the one-time token, not a JWT.
 */
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { colors, spacing, radius } from "@/constants/colors";
import { estimatePasswordStrength } from "@/lib/passwordStrength";
import { AivoButton } from "@aivo/mobile-ui";

const STRENGTH_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981"];

function reasonText(r: string, t: (k: string) => string): string {
  switch (r) {
    case "too_short":
      return t("auth.changePasswordReasonTooShort");
    case "too_weak":
      return t("auth.changePasswordReasonTooWeak");
    case "breached":
      return t("auth.changePasswordReasonBreached");
    case "reused":
      return t("auth.changePasswordReasonReused");
    case "missing_diversity":
      return t("auth.changePasswordReasonMissingDiversity");
    default:
      return r;
  }
}

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (typeof params.token === "string" ? params.token : "").trim();

  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Same strength heuristic as `change-password.tsx`, lifted into
  // `lib/passwordStrength` so the two screens share one source of truth.
  const { score, reasons } = useMemo(() => estimatePasswordStrength(next), [next]);

  const handleSubmit = async () => {
    setError("");
    if (!token) {
      setError(t("auth.resetPasswordMissingToken"));
      return;
    }
    if (!next || !confirm) {
      setError(t("auth.changePasswordFillAll"));
      return;
    }
    if (next !== confirm) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: next }),
        skipAuth: true,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(data.reasons) && data.reasons.length) {
          setError(data.reasons.map((r: string) => reasonText(r, t)).join(" • "));
        } else {
          setError(data.error || t("auth.resetPasswordExpiredLink"));
        }
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch {
      setError(t("auth.somethingWentWrong"));
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.backButton}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <View style={styles.card}>
          {success ? (
            <>
              <Text style={styles.title}>{t("auth.resetPasswordSuccess")}</Text>
              <AivoButton
                title={t("auth.backToLogin")}
                onPress={() => router.replace("/(auth)/login")}
                size="lg"
                style={{ marginTop: spacing.lg }}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>{t("auth.resetPasswordTitle")}</Text>
              <Text style={styles.subtitle}>{t("auth.resetPasswordSubtitle")}</Text>

              {!token ? (
                <Text style={styles.error}>{t("auth.resetPasswordMissingToken")}</Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.changePasswordNew")}</Text>
                <TextInput
                  style={styles.input}
                  value={next}
                  onChangeText={setNext}
                  placeholder={t("auth.changePasswordNewPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!!token}
                />
                {next.length > 0 && (
                  <View style={styles.strengthRow}>
                    {[0, 1, 2, 3, 4].map((i) => {
                      const filled = score > 0 && i < score;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.strengthSegment,
                            {
                              backgroundColor: filled ? STRENGTH_COLORS[score - 1] : colors.border,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                )}
                {reasons.length > 0 && (
                  <Text style={styles.hint}>
                    {reasons.map((r) => reasonText(r, t)).join(" • ")}
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.confirmPassword")}</Text>
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  editable={!!token}
                />
              </View>

              <AivoButton
                title={t("auth.resetPasswordSubmit")}
                onPress={handleSubmit}
                loading={loading}
                disabled={!token}
                size="lg"
                style={{ marginTop: spacing.sm }}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  backButton: { marginBottom: spacing.md },
  backText: {
    fontSize: 16,
    fontFamily: "Nunito-SemiBold",
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: colors.error + "10",
    padding: 10,
    borderRadius: radius.md,
  },
  inputGroup: { marginBottom: spacing.md },
  label: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
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
  strengthRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 6,
  },
});
