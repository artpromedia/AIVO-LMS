import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useEngagement } from "@/hooks/useEngagement";
import { useLearners } from "@/hooks/useLearners";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { gridColumns } from "@/src/design/responsive";

const categoryKeys = [
  "all",
  "hats",
  "outfits",
  "pets",
  "backgrounds",
  "effects",
  "special",
] as const;
const categoryOriginals = ["All", "Hats", "Outfits", "Pets", "Backgrounds", "Effects", "Special"];
const shopItems = [
  {
    id: "1",
    name: "Wizard Hat",
    category: "Hats",
    price: 50,
    currency: "coins" as const,
    rarity: "common",
  },
  {
    id: "2",
    name: "Space Suit",
    category: "Outfits",
    price: 150,
    currency: "coins" as const,
    rarity: "rare",
  },
  {
    id: "3",
    name: "Dragon Pet",
    category: "Pets",
    price: 25,
    currency: "gems" as const,
    rarity: "epic",
  },
  {
    id: "4",
    name: "Galaxy BG",
    category: "Backgrounds",
    price: 100,
    currency: "coins" as const,
    rarity: "rare",
  },
  {
    id: "5",
    name: "Sparkle Trail",
    category: "Effects",
    price: 75,
    currency: "coins" as const,
    rarity: "common",
  },
  {
    id: "6",
    name: "Crown",
    category: "Hats",
    price: 50,
    currency: "gems" as const,
    rarity: "legendary",
  },
  {
    id: "7",
    name: "Ninja Outfit",
    category: "Outfits",
    price: 200,
    currency: "coins" as const,
    rarity: "epic",
  },
  {
    id: "8",
    name: "Robot Pet",
    category: "Pets",
    price: 30,
    currency: "gems" as const,
    rarity: "rare",
  },
];

const rarityColors: Record<string, string> = {
  common: colors.textSecondary,
  rare: colors.info,
  epic: colors.primary,
  legendary: colors.accent,
};

export default function ShopScreen() {
  const { user } = useAuth();
  const { data: learners } = useLearners();
  const learnerId = user?.role === "LEARNER" ? user.id : learners?.[0]?.id || "";
  const { data: engagement } = useEngagement(learnerId);
  const [selectedCat, setSelectedCat] = useState("All");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { sizeClass } = useWindowSizeClass();

  // Cosmetic tiles are a true grid: 2 columns on phones, 3 on small
  // tablets, 4 on large tablets — driven by the shared size-class ladder
  // instead of the old hard-coded 2-up tile width.
  const cols = gridColumns(sizeClass);
  const cardWidthPct = `${Math.floor(100 / cols) - 2}%` as const;

  const filtered =
    selectedCat === "All" ? shopItems : shopItems.filter((i) => i.category === selectedCat);

  const handlePurchase = useCallback(
    async (item: (typeof shopItems)[0]) => {
      if (!learnerId) {
        Alert.alert(t("common.error"), "No learner profile found.");
        return;
      }

      const balance = item.currency === "gems" ? engagement?.gems || 0 : engagement?.coins || 0;
      if (balance < item.price) {
        Alert.alert(
          t("common.error"),
          `Not enough ${item.currency}. You have ${balance} but need ${item.price}.`,
        );
        return;
      }

      Alert.alert(
        t("common.buy"),
        `Buy ${item.name} for ${item.price} ${item.currency === "coins" ? "🪙" : "💎"}?`,
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.buy"),
            onPress: async () => {
              setPurchasingId(item.id);
              try {
                const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/shop/purchase", {
                  method: "POST",
                  body: JSON.stringify({
                    learnerId,
                    itemId: item.id,
                    currencyType: item.currency,
                  }),
                });
                const data = await res.json();
                if (res.ok) {
                  Alert.alert("🎉", `${item.name} purchased!`);
                  queryClient.invalidateQueries({ queryKey: ["engagement", learnerId] });
                } else {
                  Alert.alert(t("common.error"), data.error || "Purchase failed");
                }
              } catch {
                Alert.alert(t("common.error"), "Network error. Please try again.");
              } finally {
                setPurchasingId(null);
              }
            },
          },
        ],
      );
    },
    [learnerId, engagement, t, queryClient],
  );

  return (
    <ResponsiveScreen maxWidth="dashboard">
      <View style={styles.header}>
        <Text style={styles.title}>{t("learnerShop.title")}</Text>
        <View style={styles.currencyRow}>
          <View style={styles.currencyBadge}>
            <Text>🪙</Text>
            <Text style={styles.currencyText}>{engagement?.coins || 0}</Text>
          </View>
          <View style={styles.currencyBadge}>
            <Text>💎</Text>
            <Text style={styles.currencyText}>{engagement?.gems || 0}</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        {categoryKeys.map((key, idx) => (
          <Pressable accessibilityRole="button"
            key={key}
            style={[styles.catBtn, selectedCat === categoryOriginals[idx] && styles.catBtnActive]}
            onPress={() => setSelectedCat(categoryOriginals[idx])}
          >
            <Text
              style={[
                styles.catText,
                selectedCat === categoryOriginals[idx] && styles.catTextActive,
              ]}
            >
              {t(`learnerShop.${key}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {filtered.map((item) => {
          const isPurchasing = purchasingId === item.id;
          return (
            <AivoCard key={item.id} style={[styles.itemCard, { width: cardWidthPct }]}>
              <View style={[styles.rarityDot, { backgroundColor: rarityColors[item.rarity] }]} />
              <View style={styles.itemPreview}>
                <Ionicons name="shirt-outline" size={32} color={colors.textSecondary} />
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              <View style={styles.priceRow}>
                <Text>{item.currency === "coins" ? "🪙" : "💎"}</Text>
                <Text style={styles.priceText}>{item.price}</Text>
              </View>
              {isPurchasing ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
              ) : (
                <AivoButton
                  title={t("common.buy")}
                  onPress={() => handlePurchase(item)}
                  size="sm"
                  style={{ marginTop: 8 }}
                />
              )}
            </AivoCard>
          );
        })}
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  currencyRow: { flexDirection: "row", gap: 8 },
  currencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  currencyText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
  catScroll: { marginBottom: spacing.md },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  catBtnActive: { backgroundColor: colors.primary },
  catText: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  catTextActive: { color: "#FFF" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  itemCard: { alignItems: "center" as const, padding: spacing.sm },
  rarityDot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 8, right: 8 },
  itemPreview: {
    width: 64,
    height: 64,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  itemName: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.text, textAlign: "center" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  priceText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
});
