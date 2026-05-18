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
import { spacing } from "@/constants/colors";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette, useSensoryMode } from "@/context/SensoryModeProvider";
import { Button, SensoryToggle } from "@/components/ui";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH } from "@/src/design/responsive";

// The learner PIN screen keeps the dark capsule chrome by design
// (it's a kid-friendly lock screen), but the *accent* color, dot
// fill, and key-press feedback now flow from the active sensory
// palette so calm + high-contrast modes still re-skin the surface.

export default function PinScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { width: winWidth } = useWindowSizeClass();
  const authWidth = Math.min(winWidth - 32, CONTENT_MAX_WIDTH.auth);
  const { mode } = useSensoryMode();
  const { loginWithPin } = useAuth();
  const [parentId, setParentId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [step, setStep] = useState<"parent" | "pin">("parent");

  // In calm mode the haptics are noisier than the user wants; suppress
  // to "light" only. High-contrast keeps the medium feedback.
  const tapHaptic = useCallback(() => {
    Haptics.impactAsync(
      mode === "calm" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
    );
  }, [mode]);

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
      tapHaptic();
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
    [pin, attempts, loginWithPin, parentId, t, tapHaptic],
  );

  const handleDelete = useCallback(() => {
    tapHaptic();
    setPin((prev) => prev.slice(0, -1));
  }, [tapHaptic]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  // Accent color used for dots/keypress/avatar bubble. In high-contrast
  // mode the palette.primary already swaps to the higher-contrast token.
  const accent = palette.primary;
  const errorTint = INCLUSIVE_WARM_PALETTE.danger;

  if (step === "parent") {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
          <View style={{ width: authWidth, alignSelf: "center", flex: 1 }}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={12}>
              <Text style={styles.backText}>{t("common.back")}</Text>
            </Pressable>
            <SensoryToggle variant="icon" />
          </View>

          <View style={styles.header}>
            <View style={[styles.avatarCircle, { backgroundColor: accent }]}>
              <Text style={styles.avatarEmoji}>🎓</Text>
            </View>
            <Text style={[styles.title, { fontFamily: fontFamilies.displayBold }]}>
              {t("auth.learnerLogin")}
            </Text>
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
            {error ? <Text style={[styles.error, { color: errorTint }]}>{error}</Text> : null}
            <Button
              title={t("auth.continueToPin")}
              onPress={handleParentSubmit}
              disabled={!parentId.trim()}
              size="lg"
              fullWidth
              style={{ marginTop: 16 }}
            />
          </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <View style={{ width: authWidth, alignSelf: "center", flex: 1, alignItems: "center" }}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => {
            setStep("parent");
            setPin("");
            setError("");
          }}
          style={styles.back}
          hitSlop={12}
        >
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
        <SensoryToggle variant="icon" />
      </View>

      <View style={styles.header}>
        <View style={[styles.avatarCircle, { backgroundColor: accent }]}>
          <Text style={styles.avatarEmoji}>🎓</Text>
        </View>
        <Text style={[styles.title, { fontFamily: fontFamilies.displayBold }]}>
          {t("auth.enterYourPin")}
        </Text>
        {error ? <Text style={[styles.error, { color: errorTint }]}>{error}</Text> : null}
      </View>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              pin.length > i && { backgroundColor: accent, borderColor: accent },
              error && pin.length === 0 && { borderColor: errorTint },
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
                style={({ pressed }) => [
                  styles.padKey,
                  pressed && { backgroundColor: accent, transform: [{ scale: 0.95 }] },
                ]}
                onPress={handleDelete}
                disabled={pin.length === 0}
                accessibilityLabel="Delete"
              >
                <Text style={[styles.padKeyText, { fontSize: 20 }]}>⌫</Text>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [
                styles.padKey,
                pressed && { backgroundColor: accent, transform: [{ scale: 0.95 }] },
              ]}
              onPress={() => handlePress(d)}
              disabled={pin.length >= 4}
              accessibilityLabel={`Digit ${d}`}
            >
              <Text style={styles.padKeyText}>{d}</Text>
            </Pressable>
          );
        })}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: INCLUSIVE_WARM_PALETTE.darkSurface,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  back: {},
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 24,
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  error: {
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
  padKeyText: {
    fontSize: 28,
    fontFamily: "Nunito-ExtraBold",
    color: "#FFFFFF",
  },
});
