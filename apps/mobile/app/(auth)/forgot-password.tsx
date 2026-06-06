import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import { requestPasswordReset } from "@/src/api/passwordRecovery";
import { colors, spacing, radius } from "@/constants/colors";
import { AivoButton } from "@aivo/mobile-ui";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError(t("auth.pleaseEnterEmail"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError(t("auth.somethingWentWrong"));
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <View style={styles.card}>
          {sent ? (
            <>
              <Text style={styles.title}>{t("auth.checkYourEmail")}</Text>
              <Text style={styles.message}>{t("auth.resetEmailSent", { email })}</Text>
              <AivoButton
                title={t("auth.backToLogin")}
                onPress={() => router.push("/(auth)/login")}
                size="lg"
                style={{ marginTop: spacing.lg }}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>{t("auth.resetPassword")}</Text>
              <Text style={styles.subtitle}>{t("auth.resetSubtitle")}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t("auth.email")}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <AivoButton
                title={t("auth.sendResetLink")}
                onPress={handleSubmit}
                loading={loading}
                size="lg"
              />
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  backButton: { marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
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
    fontSize: 24,
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
    marginBottom: 20,
  },
  message: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: colors.error + "10",
    padding: 8,
    borderRadius: radius.md,
  },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.text, marginBottom: 6 },
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
});
