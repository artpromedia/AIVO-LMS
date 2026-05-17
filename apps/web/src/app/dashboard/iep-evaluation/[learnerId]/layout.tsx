"use client";
import CareTeamLayout from "@/components/layouts/CareTeamLayout";

export default function IepEvaluationLayout({ children }: { children: React.ReactNode }) {
  return (
    <CareTeamLayout
      accent="blue"
      roleLabel="IEP Evaluation"
      allowedRoles={["TEACHER", "THERAPIST", "DISTRICT_ADMIN", "PLATFORM_ADMIN"]}
      basePath="/dashboard"
      navItems={[]}
    >
      {children}
    </CareTeamLayout>
  );
}
