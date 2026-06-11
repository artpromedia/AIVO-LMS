import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { spacing, radius } from "@/constants/colors";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Button, Card, SensoryToggle } from "@/components/ui";
import { AivoLogo } from "@/components/AivoLogo";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

export default function VerifyMfaScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { verifyMfa, resendMfa } = useAuth();
  const { mfaToken } = useLocalSearchParams<{ mfaToken: string }>();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newCode.every((d) => d !== "")) {
      handleSubmit(newCode.join(""));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (fullCode?: string) => {
    const codeStr = fullCode || code.join("");
    if (codeStr.length !== 6 || !mfaToken) return;
    setError("");
    setLoading(true);
    const result = await verifyMfa(mfaToken, codeStr);
    if (result.success) {
      router.replace("/");
    } else {
      setError(result.error || t("auth.verificationFailed"));
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (!mfaToken || resendCooldown > 0) return;
    setResending(true);
    setResendMsg("");
    setError("");
    const result = await resendMfa(mfaToken);
    if (result.success) {
      setResendMsg(t("auth.codeResent"));
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setResendCooldown(30);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cooldownRef.current = setInterval(
        () =>
          setResendCooldown((v) => {
            if (v <= 1) {
              if (cooldownRef.current) clearInterval(cooldownRef.current);
              cooldownRef.current = null;
              return 0;
            }
            return v - 1;
          }),
        1000,
      );
    } else {
      setError(result.error || t("auth.resendFailed"));
    }
    setResending(false);
  };

  if (!mfaToken) {
    return (
      <View
        style={[styles.container, { paddingTop: insets.top + 40, backgroundColor: palette.bgPage }]}
      >
        <Card>
          <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
            {t("auth.sessionExpired") || "Your session has expired."}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/(auth)/login")} style={styles.backBtn}>
            <Text style={[styles.backText, { color: palette.primary, fontFamily: "Nunito-Bold" }]}>
              {t("auth.backToLogin")}
            </Text>
          </Pressable>
        </Card>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ResponsiveScreen
        maxWidth="auth"
        scroll={false}
        applyTopInset={false}
        background={palette.bgPage}
        style={{ paddingTop: insets.top + 40 }}
        innerStyle={{ flex: 1, justifyContent: "center" }}
      >
        <View style={styles.topRow}>
          <View style={{ flex: 1 }} />
          <SensoryToggle variant="icon" />
        </View>

        <View style={styles.logoContainer}>
          <AivoLogo width={140} variant="purple" />
        </View>

        <Card>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>✉️</Text>
          </View>
          <Text
            style={[styles.title, { color: palette.ink, fontFamily: fontFamilies.displayBold }]}
          >
            {t("auth.checkEmail")}
          </Text>
          <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
            {t("auth.codeSentDesc")}
          </Text>

          {error ? (
            <Text
              style={[
                styles.error,
                {
                  color: INCLUSIVE_WARM_PALETTE.danger,
                  backgroundColor: INCLUSIVE_WARM_PALETTE.dangerSoft,
                },
              ]}
            >
              {error}
            </Text>
          ) : null}
          {resendMsg ? <Text style={styles.success}>{resendMsg}</Text> : null}

          <View style={styles.codeRow}>
            {code.map((digit, i) => (
              <TextInput accessibilityLabel={resendMsg}
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                style={[
                  styles.codeInput,
                  {
                    color: palette.ink,
                    backgroundColor: palette.bgPage,
                    borderColor: digit ? palette.primary : palette.border,
                  },
                ]}
                value={digit}
                onChangeText={(value) => handleChange(i, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          <Button
            title={loading ? t("auth.verifying") : t("auth.verifyCode")}
            onPress={() => handleSubmit()}
            loading={loading}
            disabled={code.some((d) => !d)}
            size="lg"
            fullWidth
            style={{ marginTop: spacing.md }}
          />

          <Pressable accessibilityRole="button"
            onPress={handleResend}
            disabled={resending || resendCooldown > 0}
            style={styles.resendBtn}
          >
            <Text
              style={[
                styles.resendText,
                { color: palette.primary },
                (resending || resendCooldown > 0) && { opacity: 0.5 },
              ]}
            >
              {resending
                ? t("auth.resending")
                : resendCooldown > 0
                  ? `${t("auth.resendCode")} (${resendCooldown}s)`
                  : t("auth.resendCode")}
            </Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: palette.inkMuted }]}>
              {t("auth.backToLogin")}
            </Text>
          </Pressable>
        </Card>

        <Text style={[styles.expireNote, { color: palette.inkMuted }]}>
          {t("auth.codeExpires")}
        </Text>
      </ResponsiveScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
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
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    textAlign: "center",
    marginBottom: 12,
    padding: 8,
    borderRadius: radius.md,
  },
  success: {
    color: INCLUSIVE_WARM_PALETTE.success,
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: INCLUSIVE_WARM_PALETTE.successSoft,
    padding: 8,
    borderRadius: radius.md,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: radius.lg,
    textAlign: "center",
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
  },
  resendBtn: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
  },
  backBtn: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  backText: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
  },
  expireNote: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    textAlign: "center",
    marginTop: spacing.md,
  },
});
