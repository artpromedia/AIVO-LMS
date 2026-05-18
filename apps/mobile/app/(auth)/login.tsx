import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Switch,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/hooks/useAuth";
import { colors, spacing, radius } from "@/constants/colors";
import { AivoButton } from "@aivo/mobile-ui";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = "373030578076-ftkmofvss349u7qecvsjmiqavq4mt3hs.apps.googleusercontent.com";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [consentModal, setConsentModal] = useState(false);
  const [pendingIdToken, setPendingIdToken] = useState<string | null>(null);
  const [coppaConsent, setCoppaConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri: AuthSession.makeRedirectUri({ scheme: "aivo" }),
      usePKCE: false, // implicit flow (IdToken) does not support PKCE
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.params.id_token;
      if (idToken) {
        handleGoogleResponse(idToken);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleGoogleResponse is intentionally invoked only when response changes
  }, [response]);

  const handleGoogleResponse = async (
    idToken: string,
    consent?: { coppaConsent: boolean; termsAccepted: boolean },
  ) => {
    setGoogleLoading(true);
    setError("");
    const result = await loginWithGoogle(idToken, consent);
    if (result.success) {
      router.replace("/");
    } else if (result.mfaPending && result.mfaToken) {
      router.push({ pathname: "/(auth)/verify-mfa", params: { mfaToken: result.mfaToken } });
    } else if (result.requiresConsent) {
      setPendingIdToken(idToken);
      setConsentModal(true);
    } else {
      setError(result.error || t("auth.googleSignInFailed"));
    }
    setGoogleLoading(false);
  };

  const handleConsentConfirm = async () => {
    if (!coppaConsent || !termsAccepted || !pendingIdToken) return;
    setConsentModal(false);
    await handleGoogleResponse(pendingIdToken, { coppaConsent: true, termsAccepted: true });
    setPendingIdToken(null);
    setCoppaConsent(false);
    setTermsAccepted(false);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t("auth.enterEmailPassword"));
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(email.trim(), password);
    if (result.success) {
      router.replace("/");
    } else if (result.mfaPending && result.mfaToken) {
      router.push({ pathname: "/(auth)/verify-mfa", params: { mfaToken: result.mfaToken } });
    } else {
      setError(result.error || t("auth.loginFailed"));
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/aivo-logo-purple.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>{t("auth.aiPoweredLearning")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{t("auth.welcomeBack")}</Text>
          <Text style={styles.subtitle}>{t("auth.signInSubtitle")}</Text>

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
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.password")}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={styles.forgotLink}>{t("auth.forgotPassword")}</Text>
          </Pressable>

          <AivoButton
            title={t("auth.signIn")}
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={{ marginTop: spacing.md }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("common.or")}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.googleButton}
            onPress={() => promptAsync()}
            disabled={!request || googleLoading}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>
              {googleLoading ? t("auth.signingIn") : t("auth.continueWithGoogle")}
            </Text>
          </Pressable>

          <Pressable style={styles.pinButton} onPress={() => router.push("/(auth)/pin")}>
            <Text style={styles.pinButtonText}>{t("auth.learnerPinLogin")}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push("/(auth)/signup")} style={styles.signupLink}>
          <Text style={styles.signupText}>
            {t("auth.noAccount")} <Text style={styles.signupBold}>{t("auth.signUp")}</Text>
          </Text>
        </Pressable>
      </ScrollView>

      <Modal visible={consentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("auth.consentTitle")}</Text>
            <Text style={styles.modalSubtitle}>{t("auth.consentSubtitle")}</Text>
            <View style={styles.switchRow}>
              <Switch
                value={coppaConsent}
                onValueChange={setCoppaConsent}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={coppaConsent ? colors.primary : "#f4f3f4"}
              />
              <Text style={styles.switchLabel}>{t("auth.coppaConsent")}</Text>
            </View>
            <View style={styles.switchRow}>
              <Switch
                value={termsAccepted}
                onValueChange={setTermsAccepted}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={termsAccepted ? colors.primary : "#f4f3f4"}
              />
              <Text style={styles.switchLabel}>{t("auth.termsConsent")}</Text>
            </View>
            <AivoButton
              title={t("auth.continue")}
              onPress={handleConsentConfirm}
              disabled={!coppaConsent || !termsAccepted}
              size="lg"
              style={{ marginTop: spacing.md }}
            />
            <Pressable
              onPress={() => {
                setConsentModal(false);
                setPendingIdToken(null);
              }}
              style={{ marginTop: spacing.sm, alignItems: "center" }}
            >
              <Text style={styles.forgotLink}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 180,
    height: 60,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: "Nunito-Regular",
    marginTop: 8,
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
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: colors.error + "10",
    padding: 8,
    borderRadius: radius.md,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
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
  forgotLink: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: "Nunito-SemiBold",
    textAlign: "right",
    marginBottom: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  googleIcon: {
    fontSize: 20,
    fontFamily: "Nunito-ExtraBold",
    color: "#4285F4",
  },
  googleButtonText: {
    fontSize: 15,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
  },
  pinButton: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.secondary,
  },
  pinButtonText: {
    fontSize: 15,
    fontFamily: "Nunito-Bold",
    color: colors.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  switchLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
  signupLink: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  signupText: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
  signupBold: {
    fontFamily: "Nunito-Bold",
    color: colors.primary,
  },
});
