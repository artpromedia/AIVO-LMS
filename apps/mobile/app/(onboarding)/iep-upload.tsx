import React, { useState } from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { OnboardingScaffold } from "@/src/components/onboarding/OnboardingScaffold";
import { Button } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

async function pickPdf(): Promise<{ name: string } | null> {
  try {
    const DP: any = await import("expo-document-picker");
    const res = await DP.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (res?.canceled) return null;
    const a = res?.assets?.[0];
    return a ? { name: a.name ?? "IEP.pdf" } : null;
  } catch {
    return null;
  }
}

/**
 * IEP upload (MOB-ONB-011) — mirror of web's /onboarding/iep-upload.
 * Optional PDF upload for extraction; skippable.
 */
export default function IepUploadScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [file, setFile] = useState<string | null>(null);

  return (
    <OnboardingScaffold
      eyebrow={t("onboarding.iep.eyebrow", "Optional")}
      title={t("onboarding.iep.title", "Upload an IEP or 504")}
      subtitle={t(
        "onboarding.iep.subtitle",
        "If you have one, AIVO can read goals and accommodations to personalise faster. You can do this later.",
      )}
      onBack={() => router.back()}
      footer={
        <>
          <Button
            title={
              file
                ? t("onboarding.common.continue", "Continue")
                : t("onboarding.iep.skip", "Skip for now")
            }
            onPress={() => router.push("/(onboarding)/permissions" as Href)}
            fullWidth
            size="lg"
          />
        </>
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("onboarding.iep.pick", "Choose a PDF")}
        onPress={async () => {
          const f = await pickPdf();
          if (f) setFile(f.name);
        }}
        style={[styles.drop, { borderColor: palette.primary, backgroundColor: palette.bgRaised }]}
      >
        <Ionicons
          name={file ? "document-text" : "cloud-upload-outline"}
          size={32}
          color={palette.primary}
        />
        <Text style={[styles.dropText, { color: palette.ink }]}>
          {file ?? t("onboarding.iep.pick", "Choose a PDF")}
        </Text>
        {file ? (
          <Text style={[styles.dropHint, { color: colors.success }]}>
            {t("onboarding.iep.ready", "Ready to upload")}
          </Text>
        ) : (
          <Text style={[styles.dropHint, { color: palette.inkMuted }]}>
            {t("onboarding.iep.hint", "PDF up to 10MB")}
          </Text>
        )}
      </Pressable>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  drop: {
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  dropText: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  dropHint: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
});
