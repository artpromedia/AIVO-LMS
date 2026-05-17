import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, FileText, Shield, Settings } from "lucide-react";

const SCHOOL_NAV = [
  { href: "/admin/school", label: "Overview", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/school/staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/school/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/school/compliance", label: "Compliance", icon: <Shield className="h-4 w-4" /> },
  { href: "/admin/school/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export default async function SchoolAdminHome() {
  const session = await requirePageRole(["school_admin"]);
  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Westbrook Elementary"
        description="Staff, classes, and school-level reporting."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { k: "Staff", v: "42" },
          { k: "Classes", v: "18" },
          { k: "Active learners", v: "411" },
        ].map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{s.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.v}</p>
            <Badge tone="primary" className="mt-2">Demo data</Badge>
          </Card>
        ))}
      </div>
      <SectionHeader className="mt-10" title="Compliance" description="COPPA, FERPA, and SOC 2 reporting lives here." />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="text-sm text-aivo-ink-soft">All systems nominal. Detailed reports arrive in Sprint 23.</p>
      </Card>
    </AppShell>
  );
}
