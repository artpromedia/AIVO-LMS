import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/useAuth";
import { colors, spacing } from "@/constants/colors";

export default function PinScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { loginWithPin } = useAuth();
  const [parentId, setParentId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [step, setStep] = useState<"parent" | "pin">("parent");

  const handleParentSubmit = useCallback(() => {
    if (!parentId.trim()) {
      setError(t("auth.pleaseEnterParentEmail"));
      return;
    }
    setError("");
    setStep("pin");
  }, [parentId, t]);

  const handlePress = useCallback(
    async (digit: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newPin = pin + digit;
      setPin(newPin);
      setError("");

      if (newPin.length === 4) {
        const result = await loginWithPin(newPin, parentId.trim());
        if (result.success) {
          router.replace("/");
        } else {
          setAttempts((prev) => prev + 1);
          setPin("");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          if (attempts >= 4) {
            setError(t("auth.tooManyAttempts"));
          } else {
            setError(t("auth.incorrectPin"));
          }
        }
      }
    },
    [pin, attempts, loginWithPin, parentId, t],
  );

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  if (step === "parent") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>{t("common.back")}</Text>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarEmoji}>🎓</Text>
            </View>
            <Text style={styles.title}>{t("auth.learnerLogin")}</Text>
            <Text style={styles.subtitle}>{t("auth.enterParentEmail")}</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t("auth.parentEmailPlaceholder")}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={parentId}
              onChangeText={setParentId}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.continueBtn, !parentId.trim() && styles.continueBtnDisabled]}
              onPress={handleParentSubmit}
              disabled={!parentId.trim()}
            >
              <Text style={styles.continueBtnText}>{t("auth.continueToPin")}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <Pressable
        onPress={() => {
          setStep("parent");
          setPin("");
          setError("");
        }}
        style={styles.back}
      >
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>🎓</Text>
        </View>
        <Text style={styles.title}>{t("auth.enterYourPin")}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              pin.length > i && styles.dotFilled,
              error && pin.length === 0 && styles.dotError,
            ]}
          />
        ))}
      </View>

      <View style={styles.pad}>
        {digits.map((d, i) => {
          if (d === "") return <View key={i} style={styles.padKey} />;
          if (d === "del") {
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.padKey, pressed && styles.padKeyPressed]}
                onPress={handleDelete}
                disabled={pin.length === 0}
              >
                <Text style={[styles.padKeyText, { fontSize: 20 }]}>⌫</Text>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.padKey, pressed && styles.padKeyPressed]}
              onPress={() => handlePress(d)}
              disabled={pin.length >= 4}
            >
              <Text style={styles.padKeyText}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  back: {
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  backText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontFamily: "Nunito-SemiBold",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  error: {
    color: colors.error,
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    marginTop: 8,
  },
  inputContainer: {
    width: "100%",
    maxWidth: 320,
    marginTop: 16,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontFamily: "Nunito-Regular",
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    fontSize: 16,
    fontFamily: "Nunito-Bold",
    color: "#FFFFFF",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 40,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
  },
  dotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dotError: {
    borderColor: colors.error,
  },
  pad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    width: 280,
    gap: 12,
  },
  padKey: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  padKeyPressed: {
    backgroundColor: colors.primary,
    transform: [{ scale: 0.95 }],
  },
  padKeyText: {
    fontSize: 28,
    fontFamily: "Nunito-ExtraBold",
    color: "#FFFFFF",
  },
});
