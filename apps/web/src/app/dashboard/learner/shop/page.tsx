"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  ShoppingCart,
  Store,
  Scissors,
  Shirt,
  Sparkles,
  Image as ImageIcon,
  Smile,
  Palette,
  Package,
  type LucideIcon,
} from "lucide-react";

interface AvatarItem {
  id: string;
  name: string;
  category: string;
  rarity: string;
  coinPrice: number;
  gemPrice: number;
  levelRequired: number;
  imageUrl: string;
  isFree: boolean;
}

interface CurrencyBalance {
  coins: number;
  gems: number;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  hair: Scissors,
  outfits: Shirt,
  accessories: Sparkles,
  backgrounds: ImageIcon,
  emotes: Smile,
  skin_tones: Palette,
};

/* eslint-disable no-restricted-syntax -- rarity colors are a semantic gamification palette (common/rare/epic/legendary), shared across the engagement system */
const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8",
  rare: "#3b82f6",
  epic: "#8b5cf6",
  legendary: "#f59e0b",
};
/* eslint-enable no-restricted-syntax */

export default function ShopPage() {
  const { user, accessToken, logout, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("gamification");
  const tCommon = useTranslations("common");
  const tLearner = useTranslations("learner");
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [balance, setBalance] = useState<CurrencyBalance>({ coins: 0, gems: 0 });
  const [category, setCategory] = useState("all");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const fetchData = useCallback(() => {
    if (!accessToken || !user) return;
    fetch("/api/engagement/shop/items", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => {});

    fetch(`/api/engagement/shop/inventory/${user.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((inv: { itemId: string }[]) => setOwned(inv.map((i) => i.itemId)))
      .catch(() => {});

    fetch(`/api/engagement/currency/${user.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { balance: { coins: 0, gems: 0 } }))
      .then((d: { balance: CurrencyBalance }) => setBalance(d.balance))
      .catch(() => {});
  }, [accessToken, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const purchase = async (itemId: string, currencyType: "coins" | "gems") => {
    if (!accessToken || !user) return;
    const res = await fetch("/api/engagement/shop/purchase", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ learnerId: user.id, itemId, currencyType }),
    });
    if (res.ok) fetchData();
  };

  if (loading || !user) return null;

  const categories = ["all", ...new Set(items.map((i) => i.category))];
  const filtered = category === "all" ? items : items.filter((i) => i.category === category);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-yellow-50">
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={100}
          height={30}
          style={{ height: "auto" }}
        />
        <div className="flex items-center gap-4">
          <span className="font-bold text-amber-600">{balance.coins} coins</span>
          <span className="font-bold text-purple-600">{balance.gems} gems</span>
          <button
            onClick={() => router.push("/dashboard/learner")}
            className="text-sm text-primary font-semibold hover:underline"
          >
            {tCommon("back")}
          </button>
          <button
            onClick={logout}
            className="text-sm text-slate-500 hover:text-red-500 font-semibold"
          >
            {tLearner("log_out")}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold text-slate-900 inline-flex items-center justify-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" strokeWidth={2} aria-hidden />
            </span>
            {t("shop")}
          </h1>
          <p className="text-slate-500 font-semibold mt-2">{tLearner("shop_description")}</p>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c] || Package;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition inline-flex items-center gap-1.5 ${
                  category === c
                    ? "bg-primary text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c === "all" ? (
                  "All"
                ) : (
                  <>
                    <Icon className="w-4 h-4" strokeWidth={2} aria-hidden /> {c}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Store className="w-8 h-8" strokeWidth={2} aria-hidden />
            </div>
            <p className="text-slate-500 font-semibold">{tLearner("no_items")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => {
              const isOwned = owned.includes(item.id);
              const ItemIcon = CATEGORY_ICONS[item.category] || Package;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center space-y-2"
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ItemIcon className="w-6 h-6" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="font-heading font-bold text-sm text-slate-900">{item.name}</div>
                  <div
                    className="text-xs font-semibold capitalize"
                    // eslint-disable-next-line no-restricted-syntax -- gamification rarity palette; neutral fallback for unknown rarity
                    style={{ color: RARITY_COLORS[item.rarity] || "#94a3b8" }}
                  >
                    {item.rarity}
                  </div>
                  {isOwned ? (
                    <div className="text-xs font-bold text-green-600 bg-green-50 rounded-full px-3 py-1 inline-block">
                      Owned
                    </div>
                  ) : item.isFree ? (
                    <button
                      onClick={() => purchase(item.id, "coins")}
                      className="px-4 py-1.5 rounded-full bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition"
                    >
                      Free!
                    </button>
                  ) : (
                    <div className="flex gap-2 justify-center">
                      {item.coinPrice > 0 && (
                        <button
                          onClick={() => purchase(item.id, "coins")}
                          className="px-3 py-1.5 rounded-full bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))] text-xs font-bold hover:bg-[hsl(var(--visual-sel)/0.28)] transition"
                        >
                          {item.coinPrice} coins
                        </button>
                      )}
                      {item.gemPrice > 0 && (
                        <button
                          onClick={() => purchase(item.id, "gems")}
                          className="px-3 py-1.5 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] text-xs font-bold hover:bg-[hsl(var(--visual-primary)/0.22)] transition"
                        >
                          {item.gemPrice} gems
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
