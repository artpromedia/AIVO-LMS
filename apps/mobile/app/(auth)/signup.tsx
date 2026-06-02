import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { colors, spacing, radius } from "@/constants/colors";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Button as InclusiveButton, SensoryToggle } from "@/components/ui";
import { AivoLogo } from "@/components/AivoLogo";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

async function getAsyncStorage(): Promise<any> {
  try {
    // Optional native dep — gracefully degrades when not installed.

    return (await import("@react-native-async-storage/async-storage")).default;
  } catch {
    return null;
  }
}

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = "373030578076-ftkmofvss349u7qecvsjmiqavq4mt3hs.apps.googleusercontent.com";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { signup, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [coppaConsent, setCoppaConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [couponState, setCouponState] = useState<null | {
    valid: boolean;
    couponType?: string;
    discountPct?: number;
    description?: string | null;
    reason?: string;
  }>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const couponDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!couponCode || couponCode.length < 3) {
      setCouponState(null);
      return;
    }
    if (couponDebounceRef.current) clearTimeout(couponDebounceRef.current);
    couponDebounceRef.current = setTimeout(async () => {
      setCouponChecking(true);
      try {
        const res = await apiFetch(API.BILLING, "/api/billing/coupons/validate", {
          method: "POST",
          body: JSON.stringify({ code: couponCode }),
          skipAuth: true,
        });
        const data = await res.json();
        setCouponState(data);
      } catch {
        setCouponState({ valid: false, reason: "network_error" });
      } finally {
        setCouponChecking(false);
      }
    }, 400);
    return () => {
      if (couponDebounceRef.current) clearTimeout(couponDebounceRef.current);
    };
  }, [couponCode]);

  const handleGoogleResponse = async (idToken: string) => {
    if (!coppaConsent || !termsAccepted) {
      setError(t("auth.acceptCoppaGoogle"));
      return;
    }
    setGoogleLoading(true);
    setError("");
    const result = await loginWithGoogle(idToken, { coppaConsent: true, termsAccepted: true });
    if (result.success) {
      router.replace("/");
    } else if (result.error === "requiresConsent") {
      setError(t("auth.acceptTerms"));
    } else {
      setError(result.error || t("auth.googleSignUpFailed"));
    }
    setGoogleLoading(false);
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password) {
      setError(t("auth.fillAllFields"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (!coppaConsent || !termsAccepted) {
      setError(t("auth.acceptTerms"));
      return;
    }

    setLoading(true);
    setError("");
    const result = await signup({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    });
    if (result.success) {
      if (couponState?.valid && couponCode) {
        try {
          const AsyncStorage = await getAsyncStorage();
          if (AsyncStorage) {
            await AsyncStorage.setItem("pending_coupon", couponCode);
            if (couponState.couponType === "PROVISIONING") {
              await AsyncStorage.setItem("pending_coupon_type", "PROVISIONING");
            }
          }
        } catch {}
      }
      router.replace("/");
    } else {
      setError(result.error || t("auth.registrationFailed"));
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ResponsiveScreen
        maxWidth="auth"
        background={palette.bgPage}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 32 }}
      >
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <Text style={[styles.backText, { color: palette.primary }]}>{t("common.back")}</Text>
          </Pressable>
          <SensoryToggle variant="icon" />
        </View>

        <View style={styles.logoContainer}>
          <AivoLogo width={160} variant="purple" />
        </View>

        <Text style={[styles.title, { color: palette.ink, fontFamily: fontFamilies.displayBold }]}>
          {t("auth.createAccount")}
        </Text>
        <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
          {t("auth.createAccountSubtitle")}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={styles.googleButton}
          onPress={() => promptAsync()}
          disabled={!request || googleLoading}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleButtonText}>
            {googleLoading ? t("auth.signingUp") : t("auth.signUpWithGoogle")}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("auth.orSignUpWithEmail")}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View
          style={[styles.card, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.fullName")}</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => updateField("name", v)}
              placeholder={t("auth.fullNamePlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoComplete="name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.email")}</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(v) => updateField("email", v)}
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
              value={form.password}
              onChangeText={(v) => updateField("password", v)}
              placeholder={t("auth.atLeast8Chars")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t("auth.confirmPassword")}</Text>
            <TextInput
              style={styles.input}
              value={form.confirmPassword}
              onChangeText={(v) => updateField("confirmPassword", v)}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />
          </View>

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

          {/* Coupon / Access Code */}
          <Pressable onPress={() => setCouponExpanded((v) => !v)} style={styles.couponToggle}>
            <Text style={styles.couponToggleText}>
              {couponExpanded ? "▴" : "▾"} Have a coupon or access code?
            </Text>
          </Pressable>

          {couponExpanded && (
            <View style={styles.couponSection}>
              <TextInput
                style={styles.input}
                value={couponCode}
                onChangeText={(v) => setCouponCode(v.toUpperCase())}
                placeholder="ENTER CODE"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {couponChecking && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
              )}
              {couponState &&
                !couponChecking &&
                (couponState.valid ? (
                  <Text style={styles.couponValid}>
                    ✓ {couponCode}
                    {couponState.description ? ` — ${couponState.description}` : ""}
                    {couponState.couponType === "DISCOUNT" && couponState.discountPct
                      ? ` — ${couponState.discountPct}% off`
                      : ""}
                    {couponState.couponType === "PROVISIONING" && !couponState.description
                      ? " — Access code applied"
                      : ""}
                  </Text>
                ) : (
                  <Text style={styles.couponInvalid}>
                    ✗{" "}
                    {couponState.reason === "not_found"
                      ? "Code not found"
                      : couponState.reason === "expired"
                        ? "Code expired"
                        : couponState.reason === "exhausted"
                          ? "Code has reached its usage limit"
                          : couponState.reason === "inactive"
                            ? "Code is no longer active"
                            : couponState.reason === "network_error"
                              ? "Unable to validate — please try again"
                              : "Invalid code"}
                  </Text>
                ))}
            </View>
          )}

          <InclusiveButton
            title={t("auth.createAccountBtn")}
            onPress={handleSignup}
            loading={loading}
            variant="primary"
            style={{ marginTop: spacing.md }}
          />
        </View>

        <Pressable onPress={() => router.push("/(auth)/login")} style={styles.loginLink}>
          <Text style={styles.loginText}>
            {t("auth.haveAccount")} <Text style={styles.loginBold}>{t("auth.signIn")}</Text>
          </Text>
        </Pressable>
      </ResponsiveScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backButton: {},
  backText: {
    fontSize: 16,
    fontFamily: "Nunito-SemiBold",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
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
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 10,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
  card: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
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
  loginLink: {
    marginTop: spacing.lg,
    alignItems: "center",
    paddingBottom: 40,
  },
  loginText: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
  loginBold: {
    fontFamily: "Nunito-Bold",
    color: colors.primary,
  },
  couponToggle: {
    marginBottom: spacing.sm,
    paddingVertical: 6,
  },
  couponToggleText: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.primary,
  },
  couponSection: {
    marginBottom: spacing.md,
  },
  couponValid: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: INCLUSIVE_WARM_PALETTE.success,
    backgroundColor: INCLUSIVE_WARM_PALETTE.successSoft,
    padding: 8,
    borderRadius: radius.md,
  },
  couponInvalid: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: INCLUSIVE_WARM_PALETTE.danger,
    backgroundColor: INCLUSIVE_WARM_PALETTE.dangerSoft,
    padding: 8,
    borderRadius: radius.md,
  },
});
