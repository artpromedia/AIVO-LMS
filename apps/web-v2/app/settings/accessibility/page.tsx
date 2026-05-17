import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings } from "lucide-react";
import { ROLE_LABEL } from "@/lib/auth/types";

const NAV = [
  { href: "/settings/accessibility", label: "Accessibility", icon: <Settings className="h-4 w-4" /> },
];

export default async function AccessibilitySettings() {
  const session = await readMockSessionFromCookies();
  if (!session) redirect("/login");

  return (
    <AppShell
      role={session.role}
      roleLabel={ROLE_LABEL[session.role]}
      navItems={NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Settings"
        title="Accessibility"
        description="These defaults flow into every learner experience and can be overridden per learner."
      />

      <Card>
        <CardHeader>
          <CardTitle>Text and reading</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <fieldset>
            <Label className="mb-2 block">Text size</Label>
            <RadioGroup defaultValue="medium" className="grid grid-cols-3 gap-2 sm:max-w-md">
              {(["small", "medium", "large"] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg border border-aivo-border p-2 capitalize">
                  <RadioGroupItem value={s} id={`size-${s}`} />
                  <span>{s}</span>
                </label>
              ))}
            </RadioGroup>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <Label>Other</Label>
            {[
              { id: "high-contrast", label: "High contrast" },
              { id: "reduce-motion", label: "Reduce motion" },
              { id: "read-aloud", label: "Read aloud by default" },
              { id: "captions", label: "Always show captions" },
            ].map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 text-sm">
                <Checkbox id={opt.id} />
                {opt.label}
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <SectionHeader className="mt-10" title="Sensory" description="Coming alongside the learner profile in Sprint 7." />
      <Card>
        <CardContent className="p-5 text-sm text-aivo-ink-soft">
          Sensory profile controls (sound intensity, animation tempo, color temperature) will land
          once the learner brain profile is generated.
        </CardContent>
      </Card>
    </AppShell>
  );
}
