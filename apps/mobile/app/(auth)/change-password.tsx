/**
 * Forced password change screen.
 *
 * Reached from the root index router when the auth state's
 * `mustChangePassword` flag is true (the user was flagged on creation
 * with `must_change_password` or rotation is past due for their role).
 * Mirrors the web `dashboard/change-password` flow: collects current
 * + new password, posts to PUT `/api/auth/password`, and on success
 * fully logs the user out (server invalidates all sessions) so they
 * re-authenticate with the new credentials.
 *
 * The back gesture is disabled in `(auth)/_layout.tsx` so the user
 * can't bypass the gate by swiping away.
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
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

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { logout } = useAuth();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { score, reasons } = useMemo(() => estimatePasswordStrength(next), [next]);

  const handleSubmit = async () => {
    setError("");
    if (!current || !next || !confirm) {
      setError(t("auth.changePasswordFillAll"));
      return;
    }
    if (next !== confirm) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(API.IDENTITY, "/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(data.reasons) && data.reasons.length) {
          setError(data.reasons.map((r: string) => reasonText(r, t)).join(" • "));
        } else {
          setError(data.error || t("auth.changePasswordFailed"));
        }
        setLoading(false);
        return;
      }
      // Server invalidated all sessions on success — wipe local tokens
      // and bounce to login so the user re-authenticates.
      await logout();
      router.replace("/(auth)/login");
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
        <View style={styles.card}>
          <Text style={styles.title}>{t("auth.changePasswordTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.changePasswordSubtitle")}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.changePasswordCurrent")}</Text>
            <TextInput accessibilityLabel={t("auth.passwordPlaceholder")}
              style={styles.input}
              value={current}
              onChangeText={setCurrent}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.changePasswordNew")}</Text>
            <TextInput accessibilityLabel={t("auth.changePasswordNewPlaceholder")}
              style={styles.input}
              value={next}
              onChangeText={setNext}
              placeholder={t("auth.changePasswordNewPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
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
                        { backgroundColor: filled ? STRENGTH_COLORS[score - 1] : colors.border },
                      ]}
                    />
                  );
                })}
              </View>
            )}
            {reasons.length > 0 && (
              <Text style={styles.hint}>{reasons.map((r) => reasonText(r, t)).join(" • ")}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.confirmPassword")}</Text>
            <TextInput accessibilityLabel={t("auth.confirmPasswordPlaceholder")}
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          </View>

          <AivoButton
            title={t("auth.changePasswordSubmit")}
            onPress={handleSubmit}
            loading={loading}
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    shadowColor: colors.black,
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
    marginTop: 6,
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
});
