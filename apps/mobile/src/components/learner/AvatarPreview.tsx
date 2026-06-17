import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/constants/colors";
import type { AvatarItem, AvatarInventoryRow } from "@/hooks/useAvatar";

/**
 * Renders the learner's CURRENT look composed from their real equipped
 * cosmetics (engagement-svc inventory). The catalog ships image URLs that
 * don't exist in the native bundle, so we represent each equipped piece
 * with a per-category glyph + rarity tint rather than a missing image.
 *
 * `items` is the live catalog and `inventory` the learner's owned rows;
 * both come straight from the API so nothing here is hardcoded data.
 */

// Presentational only — keyed by the server's category strings.
const CATEGORY_GLYPH: Record<string, string> = {
  accessories: "🎩",
  outfits: "👕",
  hair: "💇",
  backgrounds: "🌅",
  emotes: "✨",
  skin_tones: "🧑",
};

// Order in which equipped pieces are surfaced (most "face-forward" first).
const CATEGORY_PRIORITY = [
  "accessories",
  "hair",
  "outfits",
  "skin_tones",
  "emotes",
  "backgrounds",
];

const RARITY_COLOR: Record<string, string> = {
  common: colors.textSecondary,
  rare: colors.info,
  epic: colors.primary,
  legendary: colors.accent,
};

export interface AvatarPreviewProps {
  items: readonly AvatarItem[] | undefined;
  inventory: readonly AvatarInventoryRow[] | undefined;
  /** Compact = just the circle (profile header); full adds equipped chips. */
  variant?: "compact" | "full";
  size?: number;
  emptyLabel?: string;
  wearingLabel?: string;
}

export function AvatarPreview({
  items,
  inventory,
  variant = "full",
  size = 96,
  emptyLabel = "No look equipped yet",
  wearingLabel = "Wearing",
}: AvatarPreviewProps) {
  const equipped = useMemo(() => {
    if (!items || !inventory) return [] as AvatarItem[];
    const byId = new Map(items.map((i) => [i.id, i]));
    const list = inventory
      .filter((row) => row.equipped)
      .map((row) => byId.get(row.itemId))
      .filter((i): i is AvatarItem => !!i);
    return list.sort(
      (a, b) =>
        CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category),
    );
  }, [items, inventory]);

  const headline = equipped[0];
  const glyph = headline ? (CATEGORY_GLYPH[headline.category] ?? "🌟") : "🙂";
  const ringColor = headline ? (RARITY_COLOR[headline.rarity] ?? colors.primary) : colors.border;

  return (
    <View style={variant === "full" ? styles.full : undefined}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ringColor,
          },
        ]}
        accessibilityRole="image"
        accessibilityLabel={
          equipped.length
            ? `${wearingLabel}: ${equipped.map((e) => e.name).join(", ")}`
            : emptyLabel
        }
      >
        <Text style={{ fontSize: size * 0.42 }}>{glyph}</Text>
      </View>

      {variant === "full" && (
        <View style={styles.chipsWrap}>
          {equipped.length === 0 ? (
            <Text style={styles.empty}>{emptyLabel}</Text>
          ) : (
            <>
              <Text style={styles.wearing}>{wearingLabel}</Text>
              <View style={styles.chips}>
                {equipped.map((item) => (
                  <View key={item.id} style={styles.chip}>
                    <Text style={styles.chipGlyph}>
                      {CATEGORY_GLYPH[item.category] ?? "🌟"}
                    </Text>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.rarityDot,
                        { backgroundColor: RARITY_COLOR[item.rarity] ?? colors.textSecondary },
                      ]}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  full: { alignItems: "center" },
  circle: {
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  chipsWrap: { alignItems: "center", marginTop: spacing.sm, width: "100%" },
  wearing: {
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  chipGlyph: { fontSize: 14 },
  chipText: { fontSize: 12, fontFamily: "Nunito-Bold", color: colors.text, maxWidth: 110 },
  rarityDot: { width: 7, height: 7, borderRadius: 4 },
  empty: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
});
