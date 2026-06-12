import { PageSkeleton } from "@/components/ui/page-skeleton";
import { AivoMascot } from "@/components/learner/art/aivo-mascot";

export default function Loading() {
  return (
    <div>
      {/* A calm, character-led loading moment — Aivo is getting things ready.
          Decorative (aria-hidden); the skeleton conveys the loading state to
          assistive tech. Motion is gated by the sensory modes in CSS. */}
      <div className="mb-4 flex items-center gap-3 px-1">
        <AivoMascot expression="thinking" size={44} />
        <span className="h-3 w-40 rounded-full bg-iw-border/60" aria-hidden="true" />
      </div>
      <PageSkeleton variant="detail" />
    </div>
  );
}
