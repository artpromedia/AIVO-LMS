import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useEngagement } from "@/hooks/useEngagement";
import { AivoCard, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, gridColumns, pickBySizeClass } from "@/src/design/responsive";

const rarityColors: Record<string, string> = {
  common: colors.textSecondary,
  rare: colors.info,
  epic: colors.primary,
  legendary: colors.accent,
};

const CARD_GAP = 10;

export default function BadgesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: engagement } = useEngagement(user?.id || "");
  const { t } = useTranslation();
  const { sizeClass, width: winWidth, isTablet } = useWindowSizeClass();

  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const maxContentWidth = isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth;
  const contentWidth = Math.min(winWidth - hPad * 2, maxContentWidth);
  const cols = gridColumns(sizeClass);
  const cardWidth = Math.floor((contentWidth - CARD_GAP * (cols - 1)) / cols);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: hPad,
        alignItems: "center",
      }}
    >
      <View style={{ width: contentWidth }}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
        <Text style={styles.title}>{t("learnerBadges.title")}</Text>
        <Text style={styles.subtitle}>
          {t("learnerBadges.earned", { count: engagement?.badges?.length || 0 })}
        </Text>

        {!engagement?.badges?.length ? (
          <EmptyState
            icon={<Ionicons name="ribbon-outline" size={48} color={colors.textSecondary} />}
            title={t("learnerBadges.noBadgesTitle")}
            message={t("learnerBadges.noBadgesMessage")}
          />
        ) : (
          <View style={[styles.grid, { gap: CARD_GAP }]}>
            {engagement.badges.map((badge) => (
              <AivoCard
                key={badge.id}
                style={[styles.badgeCard, { width: cardWidth }]}
              >
                <View style={[styles.badgeBorder, { borderColor: rarityColors[badge.rarity] }]}>
                  <Ionicons name="ribbon" size={32} color={rarityColors[badge.rarity]} />
                </View>
                <Text style={styles.badgeName}>{badge.name}</Text>
                <Text style={[styles.badgeRarity, { color: rarityColors[badge.rarity] }]}>
                  {badge.rarity}
                </Text>
              </AivoCard>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  badgeCard: { alignItems: "center" as const, padding: spacing.sm },
  badgeBorder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  badgeName: { fontSize: 12, fontFamily: "Nunito-Bold", color: colors.text, textAlign: "center" },
  badgeRarity: {
    fontSize: 10,
    fontFamily: "Nunito-SemiBold",
    textTransform: "capitalize",
    marginTop: 2,
  },
});
