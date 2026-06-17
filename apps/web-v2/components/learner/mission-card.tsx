import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SubjectIcon } from "@/components/learner/subject-icon";
import { Progress } from "@/components/ui/progress";

export function MissionCard({
  subject,
  title,
  description,
  href,
  progress,
  estMinutes,
}: {
  subject: string;
  title: string;
  description: string;
  href: string;
  progress?: number;
  estMinutes?: number;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <SubjectIcon subject={subject} label={subject} />
        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-iw-ink-muted">{description}</p>
        </div>
      </div>
      {typeof progress === "number" ? (
        <div>
          <Progress value={progress} aria-label={`${progress}% complete`} />
          <p className="mt-1 text-xs text-iw-ink-muted">{progress}% complete</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between text-xs text-iw-ink-muted">
        {estMinutes ? <span>About {estMinutes} min</span> : <span />}
        <Link
          href={href}
          className="inline-flex items-center gap-1 font-medium text-iw-primary hover:underline"
        >
          Start <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}
