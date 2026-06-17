import React, { useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useEngagement } from "@/hooks/useEngagement";
import { useLearners } from "@/hooks/useLearners";
import {
  useShopItems,
  useInventory,
  useEquipItem,
  type AvatarItem,
} from "@/hooks/useAvatar";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { SEMANTIC } from "@aivo/brand";
import { Card, Button } from "@/components/ui";
import { AvatarPreview } from "@/src/components/learner/AvatarPreview";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { gridColumns } from "@/src/design/responsive";

const rarityColors: Record<string, string> = {
  common: colors.textSecondary,
  rare: colors.info,
  epic: colors.primary,
  legendary: colors.accent,
};

// Presentational only — keyed by the server's category strings.
const categoryGlyph: Record<string, string> = {
  accessories: "🎩",
  outfits: "👕",
  hair: "💇",
  backgrounds: "🌅",
  emotes: "✨",
  skin_tones: "🧑",
};

function prettyCategory(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Which currency a given item is bought with (coins preferred, else gems). */
function priceFor(item: AvatarItem): { currency: "coins" | "gems"; amount: number } | null {
  if ((item.coinPrice ?? 0) > 0) return { currency: "coins", amount: item.coinPrice ?? 0 };
  if ((item.gemPrice ?? 0) > 0) return { currency: "gems", amount: item.gemPrice ?? 0 };
  return null; // free / default item
}

export default function ShopScreen() {
  const { user } = useAuth();
  const { data: learners } = useLearners();
  const learnerId = user?.role === "LEARNER" ? user.id : learners?.[0]?.id || "";
  const { data: engagement } = useEngagement(learnerId);
  const { data: items, isLoading: itemsLoading, isError: itemsError } = useShopItems();
  const { data: inventory } = useInventory(learnerId);
  const equipMutation = useEquipItem(learnerId);
  const [selectedCat, setSelectedCat] = useState("all");
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [equippingId, setEquippingId] = useState<string | null>(null);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { sizeClass } = useWindowSizeClass();

  const cols = gridColumns(sizeClass);
  const cardWidthPct = `${Math.floor(100 / cols) - 2}%` as const;

  // Category chips derive from the live catalog — no hardcoded list.
  const categories = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((i) => set.add(i.category));
    return ["all", ...Array.from(set).sort()];
  }, [items]);

  const ownedIds = useMemo(
    () => new Set((inventory ?? []).map((row) => row.itemId)),
    [inventory],
  );
  const equippedIds = useMemo(
    () => new Set((inventory ?? []).filter((row) => row.equipped).map((row) => row.itemId)),
    [inventory],
  );

  const filtered = useMemo(() => {
    const list = items ?? [];
    return selectedCat === "all" ? list : list.filter((i) => i.category === selectedCat);
  }, [items, selectedCat]);

  const handlePurchase = useCallback(
    async (item: AvatarItem) => {
      if (!learnerId) {
        Alert.alert(t("common.error"), t("learnerShop.noProfile", "No learner profile found."));
        return;
      }
      const price = priceFor(item);
      const isFree = !price && !!item.isFree;
      if (!price && !isFree) {
        Alert.alert(t("common.error"), t("learnerShop.notForSale", "This item isn't for sale."));
        return;
      }
      // Free/default items are acquired for 0 of either currency — the
      // backend accepts the purchase as long as the item is flagged free.
      const currency = price?.currency ?? "coins";
      if (price) {
        const balance = price.currency === "gems" ? engagement?.gems || 0 : engagement?.coins || 0;
        if (balance < price.amount) {
          Alert.alert(
            t("common.error"),
            t("learnerShop.insufficient", "Not enough {{currency}}. You have {{have}} but need {{need}}.", {
              currency: price.currency,
              have: balance,
              need: price.amount,
            }),
          );
          return;
        }
      }

      const confirmLabel = isFree ? t("learnerShop.get", "Get") : t("common.buy");
      const confirmMessage = isFree
        ? t("learnerShop.confirmFree", "Add {{name}} to your collection?", { name: item.name })
        : `${item.name} — ${price!.amount} ${price!.currency === "coins" ? "🪙" : "💎"}?`;

      Alert.alert(confirmLabel, confirmMessage, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: confirmLabel,
          onPress: async () => {
              setPurchasingId(item.id);
              try {
                const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/shop/purchase", {
                  method: "POST",
                  body: JSON.stringify({
                    learnerId,
                    itemId: item.id,
                    currencyType: currency,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  Alert.alert("🎉", t("learnerShop.purchased", "{{name}} purchased!", { name: item.name }));
                  queryClient.invalidateQueries({ queryKey: ["engagement", learnerId] });
                  queryClient.invalidateQueries({ queryKey: ["inventory", learnerId] });
                } else {
                  Alert.alert(t("common.error"), data.error || t("learnerShop.purchaseFailed", "Purchase failed"));
                }
              } catch {
                Alert.alert(t("common.error"), t("common.networkError", "Network error. Please try again."));
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

  const handleEquip = useCallback(
    async (item: AvatarItem, equip: boolean) => {
      if (!learnerId) return;
      setEquippingId(item.id);
      try {
        await equipMutation.mutateAsync({ itemId: item.id, equipped: equip });
      } catch (err) {
        Alert.alert(
          t("common.error"),
          err instanceof Error ? err.message : t("learnerShop.equipFailed", "Couldn't update your look."),
        );
      } finally {
        setEquippingId(null);
      }
    },
    [learnerId, equipMutation, t],
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

      <Card style={styles.previewCard}>
        <AvatarPreview
          items={items}
          inventory={inventory}
          variant="full"
          size={96}
          emptyLabel={t("learnerShop.noLook", "No look equipped yet — buy and equip an item below.")}
          wearingLabel={t("learnerShop.wearing", "Wearing")}
        />
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        {categories.map((cat) => (
          <Pressable
            accessibilityRole="button"
            key={cat}
            style={[styles.catBtn, selectedCat === cat && styles.catBtnActive]}
            onPress={() => setSelectedCat(cat)}
          >
            <Text style={[styles.catText, selectedCat === cat && styles.catTextActive]}>
              {cat === "all" ? t("learnerShop.all", "All") : prettyCategory(cat)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {itemsLoading && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      )}

      {itemsError && (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>
            {t("learnerShop.loadError", "Couldn't load the shop. Pull to refresh later.")}
          </Text>
        </View>
      )}

      {!itemsLoading && !itemsError && (
        <View style={styles.grid}>
          {filtered.map((item) => {
            const isPurchasing = purchasingId === item.id;
            const isEquipping = equippingId === item.id;
            const owned = ownedIds.has(item.id);
            const equipped = equippedIds.has(item.id);
            const price = priceFor(item);
            return (
              <Card key={item.id} style={[styles.itemCard, { width: cardWidthPct }]}>
                <View style={[styles.rarityDot, { backgroundColor: rarityColors[item.rarity] }]} />
                <View style={styles.itemPreview}>
                  <Text style={{ fontSize: 30 }}>{categoryGlyph[item.category] ?? "🌟"}</Text>
                </View>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.priceRow}>
                  {price ? (
                    <>
                      <Text>{price.currency === "coins" ? "🪙" : "💎"}</Text>
                      <Text style={styles.priceText}>{price.amount}</Text>
                    </>
                  ) : (
                    <Text style={styles.freeText}>{t("learnerShop.free", "Free")}</Text>
                  )}
                </View>

                {isPurchasing || isEquipping ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
                ) : owned ? (
                  equipped ? (
                    <View style={styles.equippedPill}>
                      <Ionicons name="checkmark" size={14} color={colors.primary} />
                      <Text style={styles.equippedText}>{t("learnerShop.equipped", "Equipped")}</Text>
                    </View>
                  ) : (
                    <Button
                      title={t("learnerShop.equip", "Equip")}
                      onPress={() => handleEquip(item, true)}
                      size="sm"
                      variant="outline"
                      style={{ marginTop: 8 }}
                    />
                  )
                ) : (
                  <Button
                    title={price ? t("common.buy") : t("learnerShop.get", "Get")}
                    onPress={() => handlePurchase(item)}
                    size="sm"
                    style={{ marginTop: 8 }}
                  />
                )}
              </Card>
            );
          })}
        </View>
      )}
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
  title: { fontSize: 24, fontFamily: fontFamilies.bodyExtraBold, color: colors.text },
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
  currencyText: { fontSize: 14, fontFamily: fontFamilies.bodyBold, color: colors.text },
  previewCard: { alignItems: "center", paddingVertical: spacing.md, marginBottom: spacing.md },
  catScroll: { marginBottom: spacing.md },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  catBtnActive: { backgroundColor: colors.primary },
  catText: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold, color: colors.textSecondary },
  catTextActive: { color: colors.white },
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
  itemName: { fontSize: 13, fontFamily: fontFamilies.bodyBold, color: colors.text, textAlign: "center" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, minHeight: 18 },
  priceText: { fontSize: 14, fontFamily: fontFamilies.bodyBold, color: colors.text },
  freeText: { fontSize: 13, fontFamily: fontFamilies.bodyBold, color: colors.success },
  equippedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary + "15",
  },
  equippedText: { fontSize: 12, fontFamily: fontFamilies.bodyBold, color: colors.primary },
  errorBlock: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: SEMANTIC.color.feedback.dangerSurface,
    borderRadius: 12,
  },
  errorText: { color: SEMANTIC.color.feedback.danger, fontFamily: fontFamilies.bodySemiBold, fontSize: 14 },
});
