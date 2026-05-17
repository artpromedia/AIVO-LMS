"use client";
import CareTeamLayout from "@/components/layouts/CareTeamLayout";
import { Users, ClipboardList, CalendarDays, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/therapist", label: "Caseload", Icon: Users },
  { href: "/dashboard/therapist/reports", label: "Reports", Icon: ClipboardList },
  { href: "/dashboard/therapist/sessions", label: "Sessions", Icon: CalendarDays },
  { href: "/dashboard/therapist/settings", label: "Settings", Icon: Settings },
];

export default function TherapistLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareTeamLayout accent="pink" roleLabel="Therapist" allowedRoles={["THERAPIST", "PLATFORM_ADMIN"]} basePath="/dashboard/therapist" navItems={NAV_ITEMS}>
      {children}
    </CareTeamLayout>
  );
}
