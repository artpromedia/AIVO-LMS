import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearners } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent learners list (MOB-PAR-001) — mirror of web's `/parent/learners`.
 * A dedicated roster of the children on the account, each routing into
 * the learner profile hub. Add-learner kicks off the onboard flow.
 */
export default function ParentLearnersScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data: learners, isLoading } = useLearners();

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={[
            styles.backBtn,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("parentLearners.title", "Learners")}
        </Text>
        <Pressable
          onPress={() => router.push("/(parent)/onboard")}
          accessibilityRole="button"
          accessibilityLabel={t("parent.addChild", "Add a learner")}
          hitSlop={8}
          style={[styles.addBtn, { backgroundColor: palette.primary }]}
        >
          <Ionicons name="add" size={22} color={palette.primaryFg} />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : !learners || learners.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
          title={t("parent.noChildrenTitle", "No learners yet")}
          message={t("parent.noChildrenMessage", "Add your first learner to get started.")}
          actionLabel={t("parent.addChild", "Add a learner")}
          onAction={() => router.push("/(parent)/onboard")}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {learners.map((l) => (
            <Pressable
              key={l.id}
              accessibilityRole="button"
              accessibilityLabel={`${l.firstName} ${l.lastName}`}
              onPress={() => router.push(`/(parent)/learners/${l.id}` as Href)}
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
                  <Text style={[styles.meta, { color: palette.inkMuted }]}>
                    {t("common.grade", {
                      grade: l.gradeLevel,
                      defaultValue: `Grade ${l.gradeLevel}`,
                    })}
                    {l.functioningLevel ? ` · ${l.functioningLevel}` : ""}
                  </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold },
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
