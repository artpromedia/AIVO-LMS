import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface S {
  id: string;
  firstName?: string;
  lastName?: string;
  gradeLevel?: string;
}

/**
 * Caregiver learners (MOB-CGV-001) — mirror of web's
 * /caregiver/learners. The children this caregiver supports, each
 * routing into the child detail.
 */
export default function CaregiverLearnersScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data, isLoading } = useConnectedLearners();
  const learners = (data as S[] | undefined) ?? [];

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("caregiverLearners.title", "Children")} />
      {isLoading ? (
        <LoadingState />
      ) : learners.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
          title={t("caregiverLearners.emptyTitle", "No children yet")}
          message={t("caregiverLearners.emptyBody", "Children you support will appear here.")}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {learners.map((l) => (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityLabel={`${l.firstName ?? ""} ${l.lastName ?? ""}`}
              onPress={() => router.push(`/(caregiver)/child/${l.id}` as Href)}
            >
              <Card tone="raised" style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
                  <Text style={[styles.initial, { color: palette.accent }]}>
                    {l.firstName?.[0] ?? "?"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: palette.ink }]}>
                    {l.firstName} {l.lastName}
                  </Text>
                  {l.gradeLevel ? (
                    <Text style={[styles.meta, { color: palette.inkMuted }]}>
                      {t("common.grade", {
                        grade: l.gradeLevel,
                        defaultValue: `Grade ${l.gradeLevel}`,
                      })}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  name: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
