"use client";
import { Suspense } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { useTranslations } from "next-intl";

interface TutorCatalogItem {
  key: string;
  sku: string;
  name: string;
  domain: string;
  color: string;
  tier: string;
  avatar: string;
  price: number;
}

interface Bundle {
  name: string;
  price: number;
  tutors: string[];
}

interface ActiveSub {
  tutorSku: string;
  status: string;
}

function StoreLoadingSkeleton() {
  return (
    <div className="vi-bg">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-4 w-32 vi-surface-soft rounded animate-pulse" />
          <div className="h-9 w-28 vi-surface-soft rounded animate-pulse" />
        </div>
        <div className="h-7 w-24 vi-surface-soft rounded-full animate-pulse" />
      </header>
      <main className="max-w-6xl mx-auto px-8 py-8 space-y-10">
        <div className="text-center space-y-2">
          <div className="h-8 w-48 vi-surface-soft rounded animate-pulse mx-auto" />
          <div className="h-4 w-64 vi-surface-soft rounded animate-pulse mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="vi-card p-6">
              <div className="h-5 w-32 vi-surface-soft rounded animate-pulse mb-2" />
              <div className="h-4 w-24 vi-surface-soft rounded animate-pulse mb-3" />
              <div className="h-8 w-20 vi-surface-soft rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="vi-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full vi-surface-soft animate-pulse" />
                <div>
                  <div className="h-4 w-20 vi-surface-soft rounded animate-pulse mb-1" />
                  <div className="h-3 w-16 vi-surface-soft rounded animate-pulse" />
                </div>
              </div>
              <div className="h-9 w-full vi-surface-soft rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function TutorStorePageWrapper() {
  return (
    <Suspense fallback={<StoreLoadingSkeleton />}>
      <TutorStoreContent />
    </Suspense>
  );
}

function TutorStoreContent() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("parent");
  const tc = useTranslations("common");
  const highlightTutor = searchParams.get("tutor");
  const [catalog, setCatalog] = useState<TutorCatalogItem[]>([]);
  const [bundles, setBundles] = useState<Record<string, Bundle>>({});
  const [activeSubs, setActiveSubs] = useState<ActiveSub[]>([]);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [learners, setLearners] = useState<{ id: string; name: string }[]>([]);
  const [selectedLearner, setSelectedLearner] = useState<string>("");
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "PARENT" && user.role !== "PLATFORM_ADMIN")
      router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/tutors/catalog", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((data) => {
        setCatalog(Array.isArray(data?.tutors) ? data.tutors : []);
        setBundles(data && typeof data.bundles === "object" ? data.bundles : {});
      })
      .catch((err: unknown) => {
        console.error("Failed to load catalog:", err);
      });
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && user) {
      fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json())
        .then((data) => setLearners(Array.isArray(data) ? data : []))
        .catch((err: unknown) => {
          console.error("Failed to load learners:", err);
        });
      fetch(`/api/tutors/active/${user.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => r.json())
        .then((data) => setActiveSubs(Array.isArray(data) ? data : []))
        .catch((err: unknown) => {
          console.error("Failed to load subs:", err);
        });
    }
  }, [accessToken, user]);

  useEffect(() => {
    if (highlightTutor && catalog.length > 0 && !scrolledRef.current) {
      scrolledRef.current = true;
      setTimeout(() => {
        const el = document.getElementById(`tutor-card-${highlightTutor}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-4", "ring-[hsl(var(--visual-primary))]", "ring-offset-2");
          setTimeout(
            () =>
              el.classList.remove("ring-4", "ring-[hsl(var(--visual-primary))]", "ring-offset-2"),
            3000,
          );
        }
      }, 300);
    }
  }, [highlightTutor, catalog]);

  const isActive = (sku: string) =>
    activeSubs.some((s) => s.tutorSku === sku && s.status === "active");

  // All tutor purchases route through billing-svc → Stripe. The legacy
  // /api/tutors/subscribe path is service-only now.
  const subscribe = async (sku: string) => {
    if (!user || !accessToken) return;
    setSubscribing(sku);
    try {
      const res = await fetch("/api/billing/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tenantId: user.tenantId, tutorSku: sku }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActiveSubs([...activeSubs, { tutorSku: sku, status: "active" }]);
      } else if (res.status === 404 || res.status === 503) {
        // No paid subscription yet, or Stripe not configured — push the
        // parent into the billing flow where Checkout lives.
        router.push("/dashboard/parent/billing");
      } else {
        console.error("Subscribe failed:", data.error);
      }
    } catch (err: unknown) {
      console.error("Subscribe failed:", err);
    }
    setSubscribing(null);
  };

  const subscribeBundle = async (_bundleKey: string) => {
    // Bundle SKUs aren't represented as a single Stripe price; the
    // current Stripe wiring uses one ADDON price per tutor. Until we
    // model bundles in Stripe, redirect parents to billing to pick
    // tutors one by one.
    router.push("/dashboard/parent/billing");
  };

  if (loading || !user) return null;

  const coreTutors = catalog.filter((t) => t.tier === "core");
  const expansionTutors = catalog.filter((t) => t.tier === "expansion");
  const activeCount = activeSubs.filter((s) => s.status === "active").length;

  return (
    <div className="vi-bg">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/parent")}
            className="text-sm vi-text-muted hover:text-[hsl(var(--visual-primary))] font-semibold"
          >
            {t("back_to_dashboard")}
          </button>
          <Image
            src="/images/aivo-logo-purple.png"
            alt="AIVO"
            width={120}
            height={36}
            style={{ height: "auto" }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 text-sm rounded-full bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] font-bold">
            {t("active_tutors_count", { count: activeCount })}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-8 space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold vi-text">{t("tutor_store")}</h1>
          <p className="vi-text-muted font-semibold">{t("choose_tutors_or_bundles")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(bundles)
            .filter(([k]) => k !== "individual")
            .map(([key, bundle]) => (
              <button
                key={key}
                onClick={() => setSelectedBundle(selectedBundle === key ? null : key)}
                className={`p-6 rounded-2xl border-2 text-left transition ${selectedBundle === key ? "border-[hsl(var(--visual-primary))] bg-[hsl(var(--visual-primary)/0.06)] shadow-lg" : "vi-border bg-[hsl(var(--visual-surface))] hover:border-[hsl(var(--visual-primary)/0.3)]"}`}
              >
                <h3 className="font-heading font-bold text-lg vi-text">{bundle.name}</h3>
                <p className="text-sm vi-text-muted mt-1">
                  {t("tutors_included", { count: bundle.tutors.length })}
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[hsl(var(--visual-primary))]">
                    ${(bundle.price / 100).toFixed(2)}
                  </span>
                  <span className="text-sm vi-text-muted">/month</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {bundle.tutors.map((t) => {
                    const tutor = TUTORS[t as TutorKey];
                    return tutor ? (
                      <span
                        key={t}
                        className="inline-block w-6 h-6 rounded-full overflow-hidden border"
                        style={{ borderColor: tutor.color }}
                      >
                        <Image
                          src={tutor.avatar}
                          alt={tutor.name}
                          width={24}
                          height={24}
                          className="object-cover object-top"
                        />
                      </span>
                    ) : null;
                  })}
                </div>
                {selectedBundle === key && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      subscribeBundle(key);
                    }}
                    disabled={subscribing === key}
                    className="mt-4 w-full px-4 py-2.5 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50"
                    style={{ minHeight: 44 }}
                  >
                    {subscribing === key ? t("activating") : t("subscribe_to_bundle")}
                  </button>
                )}
              </button>
            ))}
        </div>

        <div>
          <h2 className="text-xl font-heading font-bold vi-text mb-4">{t("core_tutors")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {coreTutors.map((t) => {
              const active = isActive(t.sku);
              return (
                <div
                  key={t.key}
                  id={`tutor-card-${t.key}`}
                  className={`bg-[hsl(var(--visual-surface))] rounded-2xl p-5 border-2 transition ${active ? "border-[hsl(var(--visual-science)/0.4)] shadow-md" : "vi-border hover:border-[hsl(var(--visual-primary)/0.3)]"}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="relative w-14 h-14 rounded-full overflow-hidden border-2 shadow"
                      style={{ borderColor: t.color }}
                    >
                      <Image
                        src={t.avatar}
                        alt={t.name}
                        fill
                        className="object-cover object-top"
                        sizes="56px"
                      />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold" style={{ color: t.color }}>
                        {t.name}
                      </h3>
                      <p className="text-xs vi-text-muted">{t.domain}</p>
                    </div>
                  </div>
                  {active ? (
                    <div className="px-4 py-2 text-center rounded-full bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] font-bold text-sm">
                      {tc("active")}
                    </div>
                  ) : (
                    <button
                      onClick={() => subscribe(t.sku)}
                      disabled={subscribing === t.sku}
                      className="w-full px-4 py-2 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-sm hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50"
                      style={{ minHeight: 44 }}
                    >
                      {subscribing === t.sku ? "..." : `$${(t.price / 100).toFixed(2)}/mo`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {expansionTutors.length > 0 && (
          <div>
            <h2 className="text-xl font-heading font-bold vi-text mb-1">{t("expansion_tutors")}</h2>
            <p className="text-sm vi-text-muted mb-4">{t("expansion_tutors_desc")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {expansionTutors.map((t) => {
                const active = isActive(t.sku);
                return (
                  <div
                    key={t.key}
                    id={`tutor-card-${t.key}`}
                    className={`bg-[hsl(var(--visual-surface))] rounded-2xl p-5 border-2 transition ${active ? "border-[hsl(var(--visual-science)/0.4)] shadow-md" : "vi-border hover:border-[hsl(var(--visual-sel)/0.3)]"}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="relative w-14 h-14 rounded-full overflow-hidden border-2 shadow"
                        style={{ borderColor: t.color }}
                      >
                        <Image
                          src={t.avatar}
                          alt={t.name}
                          fill
                          className="object-cover object-top"
                          sizes="56px"
                        />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold" style={{ color: t.color }}>
                          {t.name}
                        </h3>
                        <p className="text-xs vi-text-muted">{t.domain}</p>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))]">
                          {tc("more").toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {active ? (
                      <div className="px-4 py-2 text-center rounded-full bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] font-bold text-sm">
                        {tc("active")}
                      </div>
                    ) : (
                      <button
                        onClick={() => subscribe(t.sku)}
                        disabled={subscribing === t.sku}
                        className="w-full px-4 py-2 rounded-full bg-[hsl(var(--visual-sel))] text-white font-bold text-sm hover:bg-[hsl(var(--visual-sel)/0.9)] transition disabled:opacity-50"
                        style={{ minHeight: 44 }}
                      >
                        {subscribing === t.sku ? "..." : `$${(t.price / 100).toFixed(2)}/mo`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
