/**
 * Email-link verification screen.
 *
 * Reached via the deep link `aivo://verify-email?token=…` (the same token
 * the identity-svc emailed in `${webOrigin}/verify-email?token=…`). Mobile
 * mirror of web `apps/web-v2/app/verify-email/page.tsx`:
 *
 *   • With a token: confirm behind an explicit button (a single tap), then
 *     POST `/api/auth/verify-email` with `{ token }`. We verify on a button
 *     press rather than on mount so an inbox link-scanner that pre-fetches
 *     the URL can't silently burn the single-use token.
 *   • Without a token (or after an expired one): offer to send a fresh link
 *     via `/api/auth/send-verification-email`, which always answers
 *     generically (no account enumeration).
 *
 * Unauthenticated; uses `skipAuth` on the underlying client because the user
 * is proving ownership via the one-time token, not a JWT.
 */
import React, { useState } from "react";
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
import { colors, spacing, radius } from "@/constants/colors";
import { verifyEmail, resendVerificationEmail } from "@/src/api/emailVerification";
import { AivoButton } from "@aivo/mobile-ui";

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (typeof params.token === "string" ? params.token : "").trim();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    setError("");
    if (!token) {
      setError(t("auth.verifyEmailMissingToken"));
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(token);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.verifyEmailExpiredLink"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError(t("auth.verifyEmailResendLabel"));
      return;
    }
    setLoading(true);
    try {
      await resendVerificationEmail(email);
      setNotice(t("auth.verifyEmailResendDone"));
    } catch {
      setError(t("auth.somethingWentWrong"));
    } finally {
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
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/(auth)/login")}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <View style={styles.card}>
          {success ? (
            <>
              <Text style={styles.title}>{t("auth.verifyEmailSuccess")}</Text>
              <AivoButton
                title={t("auth.backToLogin")}
                onPress={() => router.replace("/(auth)/login")}
                size="lg"
                style={{ marginTop: spacing.lg }}
              />
            </>
          ) : token ? (
            <>
              <Text style={styles.title}>{t("auth.verifyEmailTitle")}</Text>
              <Text style={styles.subtitle}>{t("auth.verifyEmailSubtitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <AivoButton
                title={t("auth.verifyEmailSubmit")}
                onPress={handleConfirm}
                loading={loading}
                size="lg"
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>{t("auth.verifyEmailResendTitle")}</Text>
              <Text style={styles.subtitle}>{t("auth.verifyEmailMissingToken")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.verifyEmailResendLabel")}</Text>
                <TextInput
                  accessibilityLabel={t("auth.verifyEmailResendLabel")}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
                <Text style={styles.hint}>{t("auth.verifyEmailResendHelp")}</Text>
              </View>

              <AivoButton
                title={t("auth.verifyEmailResendSubmit")}
                onPress={handleResend}
                loading={loading}
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
  notice: {
    color: colors.primary,
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: colors.primary + "10",
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
  hint: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 6,
  },
});
