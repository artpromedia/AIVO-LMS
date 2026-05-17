"use client";
import CareTeamLayout from "@/components/layouts/CareTeamLayout";
import { BarChart3, TrendingUp, ClipboardList, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard/teacher", label: "Overview", Icon: BarChart3 },
  { href: "/dashboard/teacher/reports", label: "Reports", Icon: TrendingUp },
  { href: "/dashboard/teacher/lesson-plans", label: "Lesson Plans", Icon: ClipboardList },
  { href: "/dashboard/teacher/settings", label: "Settings", Icon: Settings },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareTeamLayout accent="blue" roleLabel="Teacher" allowedRoles={["TEACHER", "PLATFORM_ADMIN"]} basePath="/dashboard/teacher" navItems={NAV_ITEMS}>
      {children}
    </CareTeamLayout>
  );
}
