import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/hooks/useAuth";
import { isBiometricUnlockArmed, getBiometricSupport } from "@/lib/biometric";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Button } from "@/components/ui";
import { AivoLogo } from "@/components/AivoLogo";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

WebBrowser.maybeCompleteAuthSession();

// Env-driven (EAS / .env), with the dev client id as a fallback so local
// Google sign-in keeps working without extra setup.
const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  "373030578076-ftkmofvss349u7qecvsjmiqavq4mt3hs.apps.googleusercontent.com";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { login, loginWithGoogle, unlockWithBiometric } = useAuth();
  const palette = useSensoryPalette();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [consentModal, setConsentModal] = useState(false);
  const [pendingIdToken, setPendingIdToken] = useState<string | null>(null);
  const [coppaConsent, setCoppaConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [biometric, setBiometric] = useState<{
    armed: boolean;
    email: string | null;
    label: string;
  }>({ armed: false, email: null, label: "" });
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<"learner" | "adult">("adult");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [armed, support] = await Promise.all([isBiometricUnlockArmed(), getBiometricSupport()]);
      if (cancelled) return;
      setBiometric({
        armed: armed.armed && support.available && support.enrolled,
        email: armed.email,
        label: support.label,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBiometricUnlock = async () => {
    setError("");
    setBiometricLoading(true);
    try {
      const result = await unlockWithBiometric();
      if (!result.success) {
        if (result.error === "biometric_token_invalid") {
          // Helper wiped the gated copy; hide the button until next opt-in.
          setBiometric({ armed: false, email: null, label: biometric.label });
          setError(
            t(
              "auth.biometricSessionExpired",
              "Your saved session has expired. Sign in again to re-enable biometric unlock.",
            ),
          );
        } else {
          setError(t("auth.biometricUnlockFailed", "Biometric unlock failed."));
        }
        return;
      }
      router.replace("/");
    } finally {
      setBiometricLoading(false);
    }
  };

  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri: AuthSession.makeRedirectUri({ scheme: "aivo" }),
      usePKCE: false,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const inputStyle = {
    height: 52,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: 9999,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontFamily: fontFamilies.bodyRegular,
    color: palette.ink,
    backgroundColor: palette.bgRaised,
  } as const;

  const biometricLabelText = biometric.label || "biometrics";
  let biometricButtonLabel: string;
  if (biometricLoading) {
    biometricButtonLabel = t("auth.unlocking", "Unlocking…");
  } else if (biometric.email) {
    biometricButtonLabel = t("auth.unlockAs", {
      label: biometricLabelText,
      email: biometric.email,
      defaultValue: `Unlock with ${biometricLabelText} as ${biometric.email}`,
    });
  } else {
    biometricButtonLabel = t("auth.unlockWithBiometric", {
      label: biometricLabelText,
      defaultValue: `Unlock with ${biometricLabelText}`,
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bgPage }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ResponsiveScreen
        maxWidth="auth"
        background={palette.bgPage}
        contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: 32 }}
      >
        <View style={styles.logoContainer}>
          <AivoLogo variant="dark" width={160} />
          <Text style={[styles.tagline, { color: palette.inkMuted }]}>
            {t("auth.aiPoweredLearning")}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: palette.bgRaised,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: palette.ink }]}>{t("auth.welcomeBack")}</Text>
          <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
            {t("auth.signInSubtitle")}
          </Text>

          <View style={[styles.modeToggle, { borderColor: palette.border, backgroundColor: palette.bgPage }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoginMode("learner");
                router.push("/(auth)/learner-login" as Href);
              }}
              style={[
                styles.modeButton,
                loginMode === "learner" ? { backgroundColor: palette.primary } : null,
              ]}
            >
              <Text style={[styles.modeText, { color: loginMode === "learner" ? "#ffffff" : palette.inkMuted }]}>Learner — PIN only</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setLoginMode("adult")}
              style={[
                styles.modeButton,
                loginMode === "adult" ? { backgroundColor: palette.primary } : null,
              ]}
            >
              <Text style={[styles.modeText, { color: loginMode === "adult" ? "#ffffff" : palette.inkMuted }]}>All other users</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: "rgba(220, 38, 38, 0.08)" }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: palette.ink }]}>{t("auth.email")}</Text>
            <TextInput accessibilityLabel={t("auth.emailPlaceholder")}
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={palette.inkMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: palette.ink }]}>{t("auth.password")}</Text>
            <TextInput accessibilityLabel={t("auth.passwordPlaceholder")}
              style={inputStyle}
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={palette.inkMuted}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={[styles.forgotLink, { color: palette.primary }]}>
              {t("auth.forgotPassword")}
            </Text>
          </Pressable>

          <Button
            title={t("auth.signIn")}
            onPress={handleLogin}
            loading={loading}
            size="lg"
            fullWidth
            style={{ marginTop: spacing.sm }}
          />

          {biometric.armed ? (
            <Pressable
              style={[
                styles.biometricButton,
                { borderColor: palette.primary, backgroundColor: palette.bgRaised },
              ]}
              onPress={handleBiometricUnlock}
              disabled={biometricLoading}
              accessibilityRole="button"
              accessibilityLabel={t("auth.unlockWithBiometric", {
                label: biometric.label || "biometrics",
                defaultValue: `Unlock with ${biometric.label || "biometrics"}`,
              })}
            >
              <Text style={[styles.biometricButtonText, { color: palette.primary }]}>
                {biometricButtonLabel}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
            <Text style={[styles.dividerText, { color: palette.inkMuted }]}>{t("common.or")}</Text>
            <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
          </View>

          <Pressable
            style={[
              styles.googleButton,
              { borderColor: palette.border, backgroundColor: palette.bgRaised },
            ]}
            onPress={() => promptAsync()}
            disabled={!request || googleLoading}
            accessibilityRole="button"
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={[styles.googleButtonText, { color: palette.ink }]}>
              {googleLoading ? t("auth.signingIn") : t("auth.continueWithGoogle")}
            </Text>
          </Pressable>

          <Text style={[styles.pinHint, { color: palette.inkMuted }]}>
            {t("auth.learnerUseToggle", "Learners use the PIN-only tab above.")}
          </Text>
        </View>

        <Pressable accessibilityRole="button"
          onPress={() => router.push("/(onboarding)/welcome" as Href)}
          style={styles.signupLink}
        >
          <Text style={[styles.signupText, { color: palette.inkMuted }]}>
            {t("auth.noAccount")}{" "}
            <Text style={[styles.signupBold, { color: palette.primary }]}>{t("auth.signUp")}</Text>
          </Text>
        </Pressable>
      </ResponsiveScreen>

      <Modal visible={consentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: palette.bgRaised }]}>
            <Text style={[styles.modalTitle, { color: palette.ink }]}>
              {t("auth.consentTitle")}
            </Text>
            <Text style={[styles.modalSubtitle, { color: palette.inkMuted }]}>
              {t("auth.consentSubtitle")}
            </Text>
            <View style={styles.switchRow}>
              <Switch
                value={coppaConsent}
                onValueChange={setCoppaConsent}
                trackColor={{ false: palette.border, true: palette.accentSoft }}
                thumbColor={coppaConsent ? palette.primary : "#f4f3f4"}
              />
              <Text style={[styles.switchLabel, { color: palette.inkMuted }]}>
                {t("auth.coppaConsent")}
              </Text>
            </View>
            <View style={styles.switchRow}>
              <Switch
                value={termsAccepted}
                onValueChange={setTermsAccepted}
                trackColor={{ false: palette.border, true: palette.accentSoft }}
                thumbColor={termsAccepted ? palette.primary : "#f4f3f4"}
              />
              <Text style={[styles.switchLabel, { color: palette.inkMuted }]}>
                {t("auth.termsConsent")}
              </Text>
            </View>
            <Button
              title={t("auth.continue")}
              onPress={handleConsentConfirm}
              disabled={!coppaConsent || !termsAccepted}
              size="lg"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
            <Pressable accessibilityRole="button"
              onPress={() => {
                setConsentModal(false);
                setPendingIdToken(null);
              }}
              style={{ marginTop: spacing.sm, alignItems: "center" }}
            >
              <Text style={[styles.forgotLink, { color: palette.primary }]}>
                {t("common.cancel")}
              </Text>
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
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  tagline: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
    marginTop: 8,
  },
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontFamily: fontFamilies.displayBold,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  errorBox: {
    padding: 10,
    borderRadius: radius.lg,
    marginBottom: 12,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    fontFamily: fontFamilies.bodySemiBold,
    textAlign: "center",
  },
  inputGroup: { marginBottom: spacing.md },
  label: {
    fontSize: 13,
    fontFamily: fontFamilies.bodyBold,
    marginBottom: 6,
    marginLeft: 4,
  },
  forgotLink: {
    fontSize: 13,
    fontFamily: fontFamilies.bodyBold,
    textAlign: "right",
    marginBottom: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.md,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontSize: 12,
    fontFamily: fontFamilies.bodySemiBold,
    marginHorizontal: 12,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 9999,
    borderWidth: 1.5,
    gap: 10,
  },
  googleIcon: {
    fontSize: 18,
    fontFamily: fontFamilies.displayBold,
    color: "#4285F4",
  },
  googleButtonText: {
    fontSize: 15,
    fontFamily: fontFamilies.bodyBold,
  },
  modeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 9999,
    padding: 4,
    marginBottom: spacing.md,
  },
  modeButton: { flex: 1, borderRadius: 9999, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  modeText: { fontFamily: fontFamilies.bodyBold, fontSize: 13, textAlign: "center" },
  pinHint: { fontFamily: fontFamilies.bodyRegular, fontSize: 12, textAlign: "center" },
  pinButton: {
    marginTop: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  pinButtonText: {
    fontSize: 15,
    fontFamily: fontFamilies.bodyBold,
  },
  biometricButton: {
    marginTop: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  biometricButtonText: {
    fontSize: 15,
    fontFamily: fontFamilies.bodyBold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: fontFamilies.displayBold,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
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
    fontFamily: fontFamilies.bodyRegular,
  },
  signupLink: { marginTop: spacing.lg, alignItems: "center" },
  signupText: { fontSize: 14, fontFamily: fontFamilies.bodyRegular },
  signupBold: { fontFamily: fontFamilies.bodyBold },
});
