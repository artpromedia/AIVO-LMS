import { requirePageRole } from "@aivo/admin-auth";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

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
    </AdminPageFrame>
  );
}
