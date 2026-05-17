import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export function ComingSoon({
  eyebrow,
  title,
  description,
  sprintLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sprintLabel: string;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title={`${sprintLabel}`}
        description="This area is reserved in the navigation so links never 404. The full experience ships in a later sprint."
      />
    </>
  );
}
