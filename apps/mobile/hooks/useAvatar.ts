import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

/**
 * Avatar shop data layer.
 *
 * Everything here reads the live engagement-svc catalog + per-learner
 * inventory — there is NO hardcoded item list. The shop screen and the
 * gamification profile both compose the learner's equipped look from this
 * same data so the preview stays in sync after a purchase or equip.
 */

export interface AvatarItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly rarity: string;
  readonly coinPrice: number | null;
  readonly gemPrice: number | null;
  readonly levelRequired: number | null;
  readonly imageUrl: string;
  readonly isFree: boolean | null;
  readonly isDefault: boolean | null;
}

export interface AvatarInventoryRow {
  readonly id: string;
  readonly learnerId: string;
  readonly itemId: string;
  readonly equipped: boolean | null;
  readonly purchasedAt: string;
}

/** Live cosmetic catalog (server-owned). */
export function useShopItems() {
  return useQuery<AvatarItem[]>({
    queryKey: ["shop-items"],
    queryFn: async () => {
      const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/shop/items");
      if (!res.ok) throw new Error("Failed to fetch shop items");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** The learner's owned items + which one is currently equipped. */
export function useInventory(learnerId: string) {
  return useQuery<AvatarInventoryRow[]>({
    queryKey: ["inventory", learnerId],
    queryFn: async () => {
      const res = await apiFetch(
        API.ENGAGEMENT,
        `/api/engagement/shop/inventory/${learnerId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
    enabled: !!learnerId,
    staleTime: 30 * 1000,
  });
}

/**
 * Equip (or unequip) an owned item. The server enforces single-active
 * state (equipping one item clears the previously equipped one), so we
 * just invalidate the learner's inventory on success.
 */
export function useEquipItem(learnerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, equipped }: { itemId: string; equipped: boolean }) => {
      const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/shop/equip", {
        method: "POST",
        body: JSON.stringify({ learnerId, itemId, equipped }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Failed to equip item");
      }
      return res.json() as Promise<{ equipped: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", learnerId] });
    },
  });
}
