"use client";

/**
 * Sprint 12 — the break card, extracted verbatim. Renders standalone
 * (outside the sensory wrapper and AAC provider, exactly as the original
 * early-return did). The break-reminder interval lives in the machine —
 * `onBreak` is machine state, so the timer that sets it is machine-owned.
 */
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export interface BreakScreenProps {
  rootClass: string;
  completing: boolean;
  onResume: () => void;
  onEndLesson: () => void;
}

export function BreakScreen({ rootClass, completing, onResume, onEndLesson }: BreakScreenProps) {
  const t = useTranslations("learner.lesson_player");
  return (
    <Card className={`p-8 text-center ${rootClass}`}>
      <PageHeader
        eyebrow={t("break_eyebrow")}
        title={t("break_title")}
        description={t("break_desc")}
      />
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={onResume}>{t("break_resume")}</Button>
        <Button variant="soft" onClick={onEndLesson} disabled={completing}>
          {t("break_end")}
        </Button>
      </div>
    </Card>
  );
}
