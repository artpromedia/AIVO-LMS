import { requirePageRole } from "@aivo/admin-auth";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { AdminNavGrid } from "@/components/admin-nav";

const SCHOOL_NAV = [
  { href: "/school/learners", title: "Learners", description: "Learners enrolled at your school." },
  { href: "/school/classes", title: "Classes", description: "Classrooms, teachers, and rosters." },
  {
    href: "/school/rostering",
    title: "Rostering",
    description: "Import and sync learner rosters from CSV.",
  },
  { href: "/school/reports", title: "Reports", description: "Run and export school reports." },
  { href: "/school/billing", title: "Billing", description: "Subscription and seat status." },
  {
    href: "/school/compliance",
    title: "Compliance",
    description: "Data-protection control monitoring.",
  },
  { href: "/school/audit", title: "Audit log", description: "Administrative action history." },
];

export default async function SchoolHomePage() {
  const session = await requirePageRole(["school_admin"]);

  return (
    <AdminPageFrame
      eyebrow="School administration"
      title="School operations"
      description={`Signed in as ${session.displayName}.`}
    >
      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">School console</h2>
        <p className="mt-2 text-sm text-slate-600">
          School-level administration is available from this isolated admin application.
        </p>
      </AdminCard>

      <AdminNavGrid heading="Tools" items={SCHOOL_NAV} />
    </AdminPageFrame>
  );
}
