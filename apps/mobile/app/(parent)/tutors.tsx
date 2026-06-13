import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { TUTORS } from "@aivo/brand";
import { TutorCard } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

type TutorKey = keyof typeof TUTORS;

export default function TutorStoreScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<"all" | "core" | "expansion">("all");
  const { t } = useTranslation();

  const [selectedTutor, setSelectedTutor] = useState<{
    key: string;
    tutor: (typeof TUTORS)[TutorKey];
  } | null>(null);

  const tutorEntries = Object.entries(TUTORS) as [TutorKey, (typeof TUTORS)[TutorKey]][];
  const filtered =
    filter === "all" ? tutorEntries : tutorEntries.filter(([, t]) => t.tier === filter);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Text style={styles.title}>{t("parentTutors.title")}</Text>
      <Text style={styles.subtitle}>{t("parentTutors.subtitle")}</Text>

      <View style={styles.filters}>
        {(["all", "core", "expansion"] as const).map((f) => (
          <Pressable
            accessibilityRole="button"
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "all"
                ? t("parentTutors.all")
                : f === "core"
                  ? t("parentTutors.core")
                  : t("parentTutors.expansion")}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Every plan includes all 14 tutors — no add-ons, no bundles. */}
      <View style={styles.includedBanner}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <Text style={styles.includedBannerText}>{t("parentTutors.allIncluded")}</Text>
      </View>

      {filtered.map(([key, tutor]) => (
        <TutorCard
          key={key}
          name={tutor.name}
          domain={tutor.domain}
          icon={tutor.icon}
          color={tutor.color}
          subscribed
          onPress={() => setSelectedTutor({ key, tutor })}
        />
      ))}

      <Modal visible={!!selectedTutor} transparent animationType="slide">
        <Pressable
          accessibilityRole="button"
          style={styles.modalOverlay}
          onPress={() => setSelectedTutor(null)}
        >
          <Pressable accessibilityRole="button" style={styles.modalContent} onPress={() => {}}>
            {selectedTutor && (
              <>
                <View
                  style={[
                    styles.tutorIconLarge,
                    { backgroundColor: selectedTutor.tutor.color + "20" },
                  ]}
                >
                  <Text style={{ fontSize: 48 }}>{selectedTutor.tutor.icon}</Text>
                </View>
                <Text style={styles.modalTitle}>{selectedTutor.tutor.name}</Text>
                <Text style={styles.modalDomain}>{selectedTutor.tutor.domain}</Text>
                <View
                  style={[
                    styles.tierBadge,
                    {
                      backgroundColor:
                        selectedTutor.tutor.tier === "core"
                          ? colors.primary + "20"
                          : colors.accent + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tierText,
                      {
                        color: selectedTutor.tutor.tier === "core" ? colors.primary : colors.accent,
                      },
                    ]}
                  >
                    {selectedTutor.tutor.tier === "core" ? "Core Tutor" : "Expansion Tutor"}
                  </Text>
                </View>
                <Text style={styles.tutorDesc}>
                  {selectedTutor.tutor.name} specializes in {selectedTutor.tutor.domain} and adapts
                  to each learner&apos;s unique needs and pace.
                </Text>
                <View style={styles.activeRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.activeText}>Included in your plan</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedTutor(null)}
                  style={{ marginTop: spacing.md }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: "Nunito-SemiBold",
                      color: colors.textSecondary,
                      textAlign: "center",
                    }}
                  >
                    Close
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  filters: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  filterTextActive: { color: "#FFF" },
  includedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    marginBottom: spacing.lg,
  },
  includedBannerText: { flex: 1, fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.text },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: 48,
    alignItems: "center",
  },
  modalTitle: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text, marginTop: 12 },
  modalDomain: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
  },
  tutorIconLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, marginTop: 8 },
  tierText: { fontSize: 12, fontFamily: "Nunito-Bold" },
  tutorDesc: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 20,
  },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md },
  activeText: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.success },
  addTutorBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  addTutorText: { fontSize: 16, fontFamily: "Nunito-Bold", color: "#FFF" },
});
