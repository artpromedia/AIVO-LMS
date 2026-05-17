import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { Home, Users, ClipboardList, BarChart3, Settings } from "lucide-react";

const TEACHER_NAV = [
  { href: "/teacher/home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/teacher/classes", label: "Classes", icon: <Users className="h-4 w-4" /> },
  { href: "/teacher/assignments", label: "Assignments", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/teacher/insights", label: "Insights", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/teacher/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export default async function TeacherHome() {
  const session = await requirePageRole(["teacher"]);
  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Teacher home"
        title={`Good to see you, ${session.displayName.split(" ")[0]}`}
        description="Review classes, spot learners who need a nudge, and assign next steps."
        actions={
          <Button disabled>
            New assignment (Sprint 16)
          </Button>
        }
      />

      <SectionHeader title="Your classes" description="Live class rosters will appear here once Sprint 15 wires them up." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">3rd Grade · Room 12</p>
          <p className="mt-1 text-sm text-aivo-ink-soft">22 learners · 3 IEPs · 2 awaiting baseline</p>
          <div className="mt-3 flex -space-x-2">
            {["Sky", "River", "Mira", "Theo", "Sun"].map((n) => (
              <LearnerAvatar key={n} name={n} size="sm" className="ring-2 ring-aivo-surface" />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Badge tone="primary">Demo data</Badge>
            <Button variant="outline" disabled>Open class (Sprint 15)</Button>
          </div>
        </Card>
        <EmptyState
          title="Add another class"
          description="Roster sync from Google Classroom, Clever, or ClassLink lands in Sprint 19."
          action={<Button disabled>Connect roster (Sprint 19)</Button>}
        />
      </div>
    </AppShell>
  );
}
