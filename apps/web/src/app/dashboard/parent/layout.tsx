"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, createContext, useContext, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TierThemeProvider } from "@aivo/learner-ui";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTenantBranding } from "@/lib/use-tenant-branding";
import {
  Home,
  MessageCircle,
  Settings,
  CreditCard,
  ShoppingBag,
  HelpCircle,
  LogOut,
  Bell,
  ChevronDown,
  Baby,
  BarChart3,
  Menu as MenuIcon,
  Sparkles,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";

interface Learner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

interface ParentLayoutContextType {
  learners: Learner[];
  activeLearner: Learner | null;
  setActiveLearner: (l: Learner) => void;
  unreadCount: number;
  refreshLearners: () => void;
  // Pages that mark notifications read (e.g. the per-learner Updates tab)
  // call this so the global bell badge decrements without waiting for the
  // 60s poll. Decoupled from the fetch so callers don't need to know the
  // endpoint.
  refreshUnread: () => void;
}

const ParentLayoutContext = createContext<ParentLayoutContextType>({
  learners: [],
  activeLearner: null,
  setActiveLearner: () => {},
  unreadCount: 0,
  refreshLearners: () => {},
  refreshUnread: () => {},
});

export const useParentLayout = () => useContext(ParentLayoutContext);

interface NavItem {
  key: string;
  Icon: LucideIcon;
  href: string;
  matchExact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", Icon: Home, href: "/dashboard/parent", matchExact: true },
  { key: "inbox", Icon: MessageCircle, href: "/dashboard/parent/inbox" },
  { key: "settings", Icon: Settings, href: "/dashboard/parent/settings" },
  { key: "billing", Icon: CreditCard, href: "/dashboard/parent/billing" },
  { key: "store", Icon: ShoppingBag, href: "/dashboard/parent/store" },
  { key: "help", Icon: HelpCircle, href: "/dashboard/parent/help" },
];

interface BottomTab {
  key: string;
  Icon: LucideIcon;
  href: string | null;
  matchExact?: boolean;
}

const BOTTOM_TABS: BottomTab[] = [
  { key: "home", Icon: Home, href: "/dashboard/parent", matchExact: true },
  { key: "child", Icon: Baby, href: null },
  { key: "progress", Icon: BarChart3, href: null },
  { key: "inbox", Icon: MessageCircle, href: "/dashboard/parent/inbox" },
  { key: "more", Icon: MenuIcon, href: null },
];

export default function ParentDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("parent");

  const [learners, setLearners] = useState<Learner[]>([]);
  const [activeLearner, setActiveLearner] = useState<Learner | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showLearnerSwitcher, setShowLearnerSwitcher] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Sprint 9: pull tenant branding so logo + accent color reflect the
  // district. Falls back silently to AIVO defaults when none is set.
  const { branding } = useTenantBranding(user?.tenantId);
  const brandLogo = branding.logoUrl || "/images/aivo-logo-purple.png";
  const brandName = branding.displayName || "AIVO Learning";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role !== "PARENT" && user.role !== "PLATFORM_ADMIN") router.replace("/");
  }, [user, loading, router]);

  const refreshLearners = useCallback(() => {
    if (!accessToken) return;
    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const list: Learner[] = Array.isArray(data) ? data : [];
        setLearners(list);
        if (list.length > 0 && !activeLearner) {
          const pathMatch = pathname.match(/\/learner\/([^/]+)/);
          const matchedLearner = pathMatch ? list.find(l => l.id === pathMatch[1]) : null;
          setActiveLearner(matchedLearner || list[0]);
        }
      })
      .catch(() => {});
  }, [accessToken, pathname, activeLearner]);

  useEffect(() => { refreshLearners(); }, [refreshLearners]);

  // Bell badge unread count. The family-svc inbox endpoint merges legacy
  // `parent_notifications` with the IEP `parent_in_app_notifications`
  // pipeline, so a single fetch covers every unread item the parent has
  // across every learner.
  const refreshUnread = useCallback(() => {
    if (!accessToken || !user) return;
    fetch(`/api/family/inbox/${user.id}?filter=unread&limit=1`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : { unreadCount: 0 })
      .then(data => setUnreadCount(data.unreadCount || 0))
      .catch(() => {});
  }, [accessToken, user]);

  useEffect(() => {
    refreshUnread();
    // Light polling so a new IEP update lands in the bell within a minute
    // even if the parent hasn't navigated. Mirrors the per-learner
    // Updates tab cadence so the two stay in sync.
    const t = setInterval(refreshUnread, 60_000);
    return () => clearInterval(t);
  }, [refreshUnread]);

  useEffect(() => {
    const pathMatch = pathname.match(/\/learner\/([^/]+)/);
    if (pathMatch && learners.length > 0) {
      const found = learners.find(l => l.id === pathMatch[1]);
      if (found) setActiveLearner(found);
    }
  }, [pathname, learners]);

  if (loading || !user) return null;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const firstName = user.name?.split(" ")[0] || "";
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;
  const isEvening = hour >= 17 && hour < 21;
  const greetingLabel = isMorning
    ? `Good morning, ${firstName}`
    : isAfternoon
    ? `Good afternoon, ${firstName}`
    : isEvening
    ? `Good evening, ${firstName}`
    : `Hey ${firstName}`;
  const GreetingIcon = isMorning ? Sun : isAfternoon ? Sun : isEvening ? Moon : Sparkles;

  const handleBottomTab = (tab: BottomTab) => {
    if (tab.href) {
      router.push(tab.href);
      setShowMoreMenu(false);
    } else if (tab.key === "child" && activeLearner) {
      router.push(`/dashboard/parent/learner/${activeLearner.id}`);
    } else if (tab.key === "progress" && activeLearner) {
      router.push(`/dashboard/parent/learner/${activeLearner.id}/progress`);
    } else if (tab.key === "more") {
      setShowMoreMenu(!showMoreMenu);
    }
  };

  return (
    <ParentLayoutContext.Provider value={{ learners, activeLearner, setActiveLearner, unreadCount, refreshLearners, refreshUnread }}>
      <TierThemeProvider gradeLevel={activeLearner?.gradeLevel ?? null}>
      <div className="min-h-screen vi-bg" data-parent-tier={activeLearner?.gradeLevel ?? "none"}>
        <nav
          aria-label="Parent sidebar"
          className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col"
          onMouseEnter={() => setSidebarExpanded(true)}
          onMouseLeave={() => setSidebarExpanded(false)}
          style={{ width: sidebarExpanded ? 240 : 80, transition: "width 200ms ease" }}
        >
          <div className="flex flex-col h-full bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-r-2 vi-border shadow-sm">
            <div className="flex items-center h-20 px-4">
              <Link href="/dashboard/parent" aria-label={`${brandName} home`} className="flex items-center">
                <Image
                  src={brandLogo}
                  alt={brandName}
                  width={180}
                  height={44}
                  unoptimized
                  className="object-contain"
                  style={{ height: 44, width: "auto", maxWidth: sidebarExpanded ? 180 : 60, transition: "max-width 200ms ease" }}
                />
              </Link>
            </div>

            {learners.length > 1 && (
              <div className="px-3 py-3 border-b-2 vi-border space-y-1.5">
                {learners.map(l => {
                  const active = activeLearner?.id === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => { setActiveLearner(l); router.push(`/dashboard/parent/learner/${l.id}`); }}
                      className={`flex items-center gap-3 w-full px-2 py-2 rounded-2xl text-sm transition ${
                        active
                          ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-bold"
                          : "vi-text-muted hover:vi-surface-soft"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm ${active ? "bg-[hsl(var(--visual-primary))]" : "bg-[hsl(var(--visual-text-muted))]"}`}>
                        {l.name.charAt(0)}
                      </div>
                      {sidebarExpanded && <span className="truncate">{l.name}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <ul className="flex-1 px-3 py-4 space-y-1.5 list-none">
              {NAV_ITEMS.map(item => {
                const active = isActive(item.href, item.matchExact);
                const Icon = item.Icon;
                const label = t(`nav_${item.key}`, { defaultValue: item.key.charAt(0).toUpperCase() + item.key.slice(1) });
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={item.key === "inbox" && unreadCount > 0 ? `${label}, ${unreadCount} unread` : (!sidebarExpanded ? label : undefined)}
                      title={!sidebarExpanded ? label : undefined}
                      className={`relative flex items-center gap-3 px-3 py-3 rounded-2xl text-sm transition group ${
                        active
                          ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-bold shadow-sm"
                          : "vi-text-muted hover:vi-surface-soft hover:vi-text"
                      }`}
                    >
                      <Icon size={22} strokeWidth={active ? 2.75 : 2.25} className="shrink-0" aria-hidden="true" />
                      {sidebarExpanded && <span className="truncate">{label}</span>}
                      {item.key === "inbox" && unreadCount > 0 && (
                        <span aria-hidden="true" className={`${sidebarExpanded ? "ml-auto" : "absolute -top-1 -right-1"} bg-[hsl(var(--visual-math))] text-white text-[10px] font-black rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-md`}>
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="px-3 py-4 border-t-2 vi-border">
              <button
                onClick={logout}
                aria-label={t("logout")}
                title={!sidebarExpanded ? t("logout") : undefined}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-bold vi-text-muted hover:bg-[hsl(var(--visual-math)/0.12)] hover:text-[hsl(var(--visual-math))] transition w-full"
              >
                <LogOut size={22} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
                {sidebarExpanded && <span>{t("logout")}</span>}
              </button>
            </div>
          </div>
        </nav>

        <header
          className="sticky top-0 z-30 bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b-2 vi-border lg:pl-20"
          style={{ transition: "padding 200ms ease" }}
        >
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/parent" className="lg:hidden">
                <Image src={brandLogo} alt={brandName} width={120} height={24} unoptimized style={{ height: 24, width: "auto", maxWidth: 120 }} />
              </Link>
              <span className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] text-sm font-bold">
                <GreetingIcon size={14} strokeWidth={2.5} aria-hidden="true" />
                {greetingLabel}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {learners.length > 0 && (
                <div className="relative lg:hidden">
                  <button
                    onClick={() => setShowLearnerSwitcher(!showLearnerSwitcher)}
                    aria-haspopup="true"
                    aria-expanded={showLearnerSwitcher}
                    className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] text-sm font-bold"
                  >
                    <span>{activeLearner?.name || "Select"}</span>
                    {activeLearner?.gradeLevel && (
                      <span className="text-xs text-[hsl(var(--visual-primary)/0.7)] font-semibold">Gr {activeLearner.gradeLevel}</span>
                    )}
                    <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                  {showLearnerSwitcher && (
                    <div className="absolute top-full mt-2 right-0 vi-card py-2 min-w-52 z-50">
                      {learners.map(l => {
                        const active = activeLearner?.id === l.id;
                        return (
                          <button
                            key={l.id}
                            onClick={() => { setActiveLearner(l); setShowLearnerSwitcher(false); router.push(`/dashboard/parent/learner/${l.id}`); }}
                            className={`flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm ${active ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-bold" : "vi-text hover:vi-surface-soft"}`}
                          >
                            <div className={`w-8 h-8 rounded-2xl flex items-center justify-center text-xs font-black text-white shrink-0 ${active ? "bg-[hsl(var(--visual-primary))]" : "bg-[hsl(var(--visual-text-muted))]"}`}>
                              {l.name.charAt(0)}
                            </div>
                            <div>
                              <div>{l.name}</div>
                              {l.gradeLevel && <div className="text-xs vi-text-muted font-semibold">Grade {l.gradeLevel}</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <Link
                href="/dashboard/parent/inbox"
                className="relative w-10 h-10 rounded-2xl vi-surface-soft hover:bg-[hsl(var(--visual-primary)/0.12)] vi-text hover:text-[hsl(var(--visual-primary))] flex items-center justify-center transition"
                aria-label={`Inbox${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              >
                <Bell size={18} strokeWidth={2.5} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[hsl(var(--visual-math))] text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-md">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              <div className="hidden lg:flex items-center gap-2">
                <LanguageSwitcher compact />
                <Link
                  href="/dashboard/parent/settings"
                  className="w-10 h-10 rounded-2xl bg-[hsl(var(--visual-primary))] flex items-center justify-center text-white text-sm font-black shadow-md hover:scale-105 transition-transform"
                  aria-label="Account"
                >
                  {user.name?.charAt(0) || "P"}
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="lg:pl-20 pb-24 lg:pb-0" style={{ transition: "padding 200ms ease" }}>
          {children}
        </main>

        <nav
          aria-label="Bottom navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-t-2 vi-border safe-area-bottom shadow-[0_-4px_20px_hsl(var(--visual-primary)/0.08)]"
        >
          <div className="flex items-center justify-around h-16 px-2">
            {BOTTOM_TABS.map(tab => {
              const active = tab.href ? isActive(tab.href, tab.matchExact) :
                tab.key === "child" ? pathname.includes("/learner/") && !pathname.includes("/progress") :
                tab.key === "progress" ? pathname.includes("/progress") : false;
              const Icon = tab.Icon;
              const label = t(`nav_${tab.key}`, { defaultValue: tab.key.charAt(0).toUpperCase() + tab.key.slice(1) });
              return (
                <button
                  key={tab.key}
                  onClick={() => handleBottomTab(tab)}
                  aria-current={active ? "page" : undefined}
                  aria-label={tab.key === "inbox" && unreadCount > 0 ? `${label}, ${unreadCount} unread` : label}
                  className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-2xl transition ${active ? "text-[hsl(var(--visual-primary))]" : "vi-text-muted hover:vi-text"}`}
                  style={{ minHeight: 44, minWidth: 44 }}
                >
                  <span className={`flex items-center justify-center w-10 h-7 rounded-full transition ${active ? "bg-[hsl(var(--visual-primary)/0.12)]" : ""}`}>
                    <Icon size={20} strokeWidth={active ? 2.75 : 2.25} aria-hidden="true" />
                  </span>
                  <span className={`text-[10px] leading-none ${active ? "font-black" : "font-bold"}`}>{label}</span>
                  {tab.key === "inbox" && unreadCount > 0 && (
                    <span aria-hidden="true" className="absolute top-1 right-[28%] bg-[hsl(var(--visual-math))] text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-md">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {showMoreMenu && (
            <div className="absolute bottom-full left-0 right-0 bg-[hsl(var(--visual-surface))] border-t-2 vi-border shadow-2xl rounded-t-3xl p-4 space-y-1.5">
              {[
                { key: "settings", href: "/dashboard/parent/settings", Icon: Settings },
                { key: "billing", href: "/dashboard/parent/billing", Icon: CreditCard },
                { key: "store", href: "/dashboard/parent/store", Icon: ShoppingBag },
                { key: "help", href: "/dashboard/parent/help", Icon: HelpCircle },
              ].map(item => {
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-[hsl(var(--visual-primary)/0.12)] hover:text-[hsl(var(--visual-primary))] text-sm font-bold vi-text transition"
                  >
                    <span className="w-9 h-9 rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center">
                      <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <span>{t(`nav_${item.key}`, { defaultValue: item.key.charAt(0).toUpperCase() + item.key.slice(1) })}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => { setShowMoreMenu(false); logout(); }}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-[hsl(var(--visual-math)/0.12)] text-sm font-bold text-[hsl(var(--visual-math))] w-full transition"
              >
                <span className="w-9 h-9 rounded-2xl bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] flex items-center justify-center">
                  <LogOut size={18} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span>{t("logout")}</span>
              </button>
            </div>
          )}
        </nav>
      </div>
      </TierThemeProvider>
    </ParentLayoutContext.Provider>
  );
}
