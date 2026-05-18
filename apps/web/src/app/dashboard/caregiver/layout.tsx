"use client";
import CareTeamLayout from "@/components/layouts/CareTeamLayout";
import { BarChart3, ClipboardList, CalendarDays, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/caregiver", label: "Overview", Icon: BarChart3 },
  { href: "/dashboard/caregiver/observations", label: "Observations", Icon: ClipboardList },
  { href: "/dashboard/caregiver/sessions", label: "Sessions", Icon: CalendarDays },
  { href: "/dashboard/caregiver/settings", label: "Settings", Icon: Settings },
];

export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareTeamLayout
      accent="green"
      roleLabel="Caregiver"
      allowedRoles={["CAREGIVER", "PLATFORM_ADMIN"]}
      basePath="/dashboard/caregiver"
      navItems={NAV_ITEMS}
    >
      {children}
    </CareTeamLayout>
  );
}
