"use client";
import Image from "next/image";
import { Settings, Coins, Gem, LogOut } from "lucide-react";
import { useFlVariant } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import { useTenantBranding } from "@/lib/use-tenant-branding";
import { LocalisedTierBadge } from "@/components/LocalisedTierBadge";

interface TopBarProps {
  userName: string;
  coins: number;
  gems: number;
  onLogout: () => void;
  onSettings: () => void;
}

export function TopBar({ userName, coins, gems, onLogout, onSettings }: TopBarProps) {
  const { isLow, isPreSymbolic } = useFlVariant();
  const t = useTranslations("learner");
  const tc = useTranslations("common");
  const { user } = useAuth();
  // Sprint 9: tenant branding override (logo + accent color via CSS var).
  const { branding } = useTenantBranding(user?.tenantId);
  const brandLogo = branding.logoUrl || "/images/aivo-logo-purple.png";
  const brandName = branding.displayName || "AIVO";

  return (
    <header
      className="bg-white border-b-2 border-slate-200/60 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30"
      role="banner"
      aria-label={t("nav_label")}
    >
      <Image src={brandLogo} alt={brandName} width={140} height={27} unoptimized priority style={{ height: 27, width: "auto", maxWidth: 140 }} />
      <div className="flex items-center gap-3">
        {!isPreSymbolic && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] text-sm font-extrabold">
              <Coins className="w-4 h-4" strokeWidth={2.5} aria-hidden /> {coins}
            </span>
            {!isLow && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] text-sm font-extrabold">
                <Gem className="w-4 h-4" strokeWidth={2.5} aria-hidden /> {gems}
              </span>
            )}
          </div>
        )}
        <LocalisedTierBadge size="sm" />
        <span className="hidden sm:inline text-base font-extrabold text-slate-900">{t("greeting", { userName })}</span>
        <button
          onClick={onSettings}
          className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-primary))]"
          aria-label={tc("settings")}
          style={{ minHeight: "var(--learner-hit-target, 40px)", minWidth: "var(--learner-hit-target, 40px)" }}
        >
          <Settings className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <button
          onClick={onLogout}
          className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[hsl(var(--visual-math)/0.1)] hover:text-[hsl(var(--visual-math))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-math))]"
          aria-label={tc("logout")}
          style={{ minHeight: "var(--learner-hit-target, 40px)", minWidth: "var(--learner-hit-target, 40px)" }}
        >
          <LogOut className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
    </header>
  );
}
