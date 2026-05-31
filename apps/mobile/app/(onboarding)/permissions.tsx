import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { OnboardingStepper } from "@/src/components/onboarding/OnboardingStepper";
import { Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

type PermState = "idle" | "granted" | "denied";

async function requestNotifications(): Promise<boolean> {
  try {
    const N: any = await import("expo-notifications");
    const res = await N.requestPermissionsAsync();
    return res?.granted ?? res?.status === "granted";
  } catch {
    return false;
  }
}
async function requestCamera(): Promise<boolean> {
  try {
    const C: any = await import("expo-camera");
    const fn = C.requestCameraPermissionsAsync ?? C.Camera?.requestCameraPermissionsAsync;
    const res = fn ? await fn() : null;
    return res?.granted ?? res?.status === "granted";
  } catch {
    return false;
  }
}
async function requestMic(): Promise<boolean> {
  try {
    const AV: any = await import("expo-av");
    const res = await AV.Audio.requestPermissionsAsync();
    return res?.granted ?? res?.status === "granted";
  } catch {
    return false;
  }
}

interface PermItem {
  key: "notifications" | "camera" | "microphone";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  request: () => Promise<boolean>;
}

/**
 * Permission priming (MOB-ONB-008) — mirror of web's
 * `/onboarding/permissions`. Explains why each device permission helps
 * before the OS prompt, and lets the user grant them up front.
 * Permissions are optional: "Continue" proceeds either way.
 */
export default function PermissionsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [state, setState] = useState<Record<PermItem["key"], PermState>>({
    notifications: "idle",
    camera: "idle",
    microphone: "idle",
  });

  const ITEMS: PermItem[] = [
    {
      key: "notifications",
      icon: "notifications",
      title: t("onboarding.permissions.notifTitle", "Notifications"),
      desc: t("onboarding.permissions.notifDesc", "Gentle reminders and progress updates."),
      request: requestNotifications,
    },
    {
      key: "camera",
      icon: "camera",
      title: t("onboarding.permissions.cameraTitle", "Camera"),
      desc: t("onboarding.permissions.cameraDesc", "Snap a homework page for the helper."),
      request: requestCamera,
    },
    {
      key: "microphone",
      icon: "mic",
      title: t("onboarding.permissions.micTitle", "Microphone"),
      desc: t("onboarding.permissions.micDesc", "Answer out loud in language and reading."),
      request: requestMic,
    },
  ];

  const ask = async (item: PermItem) => {
    const granted = await item.request();
    setState((s) => ({ ...s, [item.key]: granted ? "granted" : "denied" }));
  };

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.permissions.eyebrow", "Step 2 of 3")}
      title={t("onboarding.permissions.title", "A few permissions")}
      subtitle={t(
        "onboarding.permissions.subtitle",
        "All optional — you can change these later in Settings.",
      )}
      onBack={() => router.back()}
      footer={
        <Button
          title={t("onboarding.common.continue", "Continue")}
          onPress={() =>
            router.push({ pathname: "/(auth)/signup", params: { role: role ?? "parent" } })
          }
          fullWidth
          size="lg"
        />
      }
    >
      <OnboardingStepper steps={3} current={1} />
      <View style={{ gap: spacing.md }}>
        {ITEMS.map((item) => {
          const st = state[item.key];
          return (
            <View
              key={item.key}
              style={[
                styles.row,
                { borderColor: palette.border, backgroundColor: palette.bgRaised },
              ]}
            >
              <View
                style={[styles.iconWrap, { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft }]}
              >
                <Ionicons name={item.icon} size={20} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: palette.ink }]}>{item.title}</Text>
                <Text style={[styles.desc, { color: palette.inkMuted }]}>{item.desc}</Text>
              </View>
              {st === "granted" ? (
                <View style={styles.statusRow}>
                  <Ionicons name="checkmark-circle" size={22} color={palette.primary} />
                </View>
              ) : (
                <Pressable
                  onPress={() => ask(item)}
                  accessibilityRole="button"
                  accessibilityLabel={t("onboarding.permissions.allow", "Allow")}
                  style={[styles.allowBtn, { borderColor: palette.primary }]}
                >
                  <Text style={[styles.allowText, { color: palette.primary }]}>
                    {st === "denied"
                      ? t("onboarding.permissions.retry", "Retry")
                      : t("onboarding.permissions.allow", "Allow")}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  desc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  statusRow: { width: 64, alignItems: "flex-end" },
  allowBtn: {
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  allowText: { fontSize: 13, fontFamily: fontFamilies.bodyBold },
});
