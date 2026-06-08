import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings } from "lucide-react";
import { ROLE_LABEL } from "@/lib/auth/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SensoryModeToggle } from "@/components/system/sensory-mode-provider";
import { SENSORY_MODE_LABELS, SENSORY_MODES } from "@/lib/sensory-mode/constants";
import { A11yPreferencesToggles } from "@/components/system/a11y-preferences-toggles";
import { readTypefaceFromCookies, readReducedMotionFromCookies } from "@/lib/a11y/server";

export default async function AccessibilitySettings() {
  const session = await getSession();
  if (!session) redirect("/login");

  const t = await getTranslations("settings_accessibility");
  const typeface = await readTypefaceFromCookies();
  const reducedMotion = await readReducedMotionFromCookies();

  const NAV = [
    {
      href: "/settings/accessibility",
      label: t("nav_label"),
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Settings"
        title={t("page_title")}
        description="These defaults flow into every learner experience and can be overridden per learner."
      />

      {/* Sensory mode — promoted to the top of the page because it is the
          load-bearing differentiator of the Inclusive-Warm rollout. */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{t("sensory_mode")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-iw-ink-muted">
            Choose how the whole app looks and moves. Your choice is saved on this browser; we
            don&apos;t sync it across devices yet.
          </p>
          <SensoryModeToggle />
          <dl className="grid gap-2 sm:grid-cols-3">
            {SENSORY_MODES.map((m) => (
              <div key={m} className="rounded-iw-card border border-iw-border bg-iw-raised p-3">
                <dt className="text-sm font-semibold text-iw-ink">
                  {SENSORY_MODE_LABELS[m].label}
                </dt>
                <dd className="mt-1 text-xs text-iw-ink-muted">
                  {SENSORY_MODE_LABELS[m].description}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <SectionHeader className="mt-10" title={t("text_and_reading")} />
      <Card>
        <CardContent className="grid gap-5 pt-5">
          <fieldset className="grid gap-2 sm:max-w-md">
            <Label>{t("age_mode")}</Label>
            <Select defaultValue="spark">
              <SelectTrigger>
                <SelectValue placeholder={t("choose_age_mode")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sprout">{t("age_sprout")}</SelectItem>
                <SelectItem value="spark">{t("age_spark")}</SelectItem>
                <SelectItem value="scholar">{t("age_scholar")}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>
          <fieldset className="grid gap-2 sm:max-w-md">
            <Label>Theme</Label>
            <Select defaultValue="light">
              <SelectTrigger>
                <SelectValue placeholder={t("choose_theme")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="high-contrast">{t("high_contrast")}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>
          <fieldset>
            <Label className="mb-2 block">{t("text_size")}</Label>
            <RadioGroup defaultValue="medium" className="grid grid-cols-3 gap-2 sm:max-w-md">
              {(["small", "medium", "large"] as const).map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-iw-border bg-iw-raised p-2 capitalize"
                >
                  <RadioGroupItem value={s} id={`size-${s}`} />
                  <span>{s}</span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <A11yPreferencesToggles initialTypeface={typeface} initialReducedMotion={reducedMotion} />
          <fieldset className="grid gap-2 sm:max-w-md">
            <Label>{t("language")}</Label>
            <Select defaultValue="en-US">
              <SelectTrigger>
                <SelectValue placeholder={t("choose_language")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">{t("lang_en_us")}</SelectItem>
                <SelectItem value="es-ES">{t("lang_es")}</SelectItem>
                <SelectItem value="fr-FR">{t("lang_fr")}</SelectItem>
              </SelectContent>
            </Select>
          </fieldset>
        </CardContent>
      </Card>
    </AppShell>
  );
}
