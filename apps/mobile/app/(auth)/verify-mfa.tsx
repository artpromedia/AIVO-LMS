import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { colors, spacing, radius } from "@/constants/colors";
import { AivoButton } from "@aivo/mobile-ui";

export default function VerifyMfaScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <View style={styles.card}>
          <Text style={styles.subtitle}>
            {t("auth.sessionExpired") || "Your session has expired."}
          </Text>
          <Pressable onPress={() => router.replace("/(auth)/login")} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary, fontFamily: "Nunito-Bold" }]}>
              {t("auth.backToLogin")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/aivo-logo-purple.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>✉️</Text>
          </View>
          <Text style={styles.title}>{t("auth.checkEmail")}</Text>
          <Text style={styles.subtitle}>{t("auth.codeSentDesc")}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {resendMsg ? <Text style={styles.success}>{resendMsg}</Text> : null}

          <View style={styles.codeRow}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                style={styles.codeInput}
                value={digit}
                onChangeText={(value) => handleChange(i, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          <AivoButton
            title={loading ? t("auth.verifying") : t("auth.verifyCode")}
            onPress={() => handleSubmit()}
            loading={loading}
            disabled={code.some((d) => !d)}
            size="lg"
            style={{ marginTop: spacing.md }}
          />

          <Pressable
            onPress={handleResend}
            disabled={resending || resendCooldown > 0}
            style={styles.resendBtn}
          >
            <Text
              style={[styles.resendText, (resending || resendCooldown > 0) && { opacity: 0.5 }]}
            >
              {resending
                ? t("auth.resending")
                : resendCooldown > 0
                  ? `${t("auth.resendCode")} (${resendCooldown}s)`
                  : t("auth.resendCode")}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>{t("auth.backToLogin")}</Text>
          </Pressable>
        </View>

        <Text style={styles.expireNote}>{t("auth.codeExpires")}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 44,
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
  iconContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
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
  success: {
    color: "#16a34a",
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    textAlign: "center",
    marginBottom: 12,
    backgroundColor: "#dcfce7",
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
    borderColor: colors.border,
    borderRadius: radius.lg,
    textAlign: "center",
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    backgroundColor: colors.surface,
  },
  resendBtn: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.primary,
  },
  backBtn: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  backText: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
  expireNote: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
