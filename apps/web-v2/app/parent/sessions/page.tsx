import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { SectionCard } from "../home-v2/_components/SectionCard";
import {
  listLearnersForParent,
  listLessonRunsForLearner,
  listSubjects,
} from "@/lib/db/repos";
import { getCareTeam, type TeamMemberRecord, type TeamRole } from "@/lib/db/team-invites";

/**
 * Parent → Sessions (Wave 2).
 *
 * HYBRID session model: AI lessons are the real, schedulable sessions (driven by
 * `lesson_runs`); the human care team is *listed and messageable only* — there is
 * deliberately no human-booking flow. Every row is a real repo value or an honest
 * empty state. Access control is implicit: `listLearnersForParent` is parent-scoped,
 * so only this parent's learners are ever iterated.
 */

function formatDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function tutorLabel(persona: string): string {
  if (!persona) return "";
  return persona
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MEMBER_PILL_JOINED =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--aivo-domain-completion-complete-subtle)] text-[var(--aivo-domain-completion-complete-strong)]";
const MEMBER_PILL_PENDING =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-iw-card text-iw-text-muted border border-iw-border";

export default async function Page() {
  const t = await getTranslations("parent.sessions");
  const locale = await getLocale();
  const session = await requirePageRole(["parent"]);
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const subjectMap = new Map((await listSubjects()).map((s) => [s.id, s]));

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Parent" title={t("title")} description={t("subtitle")} />

      {learners.length === 0 ? (
        <EmptyState title={t("no_learners_title")} description={t("no_learners_desc")} />
      ) : (
        await Promise.all(
          learners.map(async (l) => {
            const runs = await listLessonRunsForLearner(l.id, session.tenantId);
            const active = runs.filter(
              (r) => r.status === "ready" || r.status === "in_progress",
            );
            const completed = runs
              .filter((r) => r.status === "completed")
              .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
              .slice(0, 5);

            const team = await getCareTeam(l.id, session.tenantId);
            const members: { role: TeamRole; m: TeamMemberRecord }[] = [
              ...team.teachers.map((m) => ({ role: "teacher" as const, m })),
              ...team.caregivers.map((m) => ({ role: "caregiver" as const, m })),
              ...team.therapists.map((m) => ({ role: "therapist" as const, m })),
            ];

            return (
              <section key={l.id} className="mb-10">
                <SectionHeader
                  title={l.displayName}
                  description={`${active.length} ${active.length === 1 ? t("active_one") : t("active_other")} · ${members.length} ${members.length === 1 ? t("member_one") : t("member_other")}`}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {/* AI lessons */}
                  <SectionCard title={t("ai_sessions")} iconName="aiSparkle">
                    {active.length === 0 && completed.length === 0 ? (
                      <p className="text-iw-text-muted">{t("no_lessons")}</p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {active.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-iw-text-muted mb-2">
                              {t("active")}
                            </p>
                            <ul className="flex flex-col gap-2">
                              {active.map((r) => (
                                <li
                                  key={r.id}
                                  className="flex items-center justify-between gap-3 rounded-iw-control border border-iw-border p-3"
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium truncate">
                                      {subjectMap.get(r.subjectId)?.name ?? t("ai_lesson")}
                                    </p>
                                    <p className="text-xs text-iw-text-muted">
                                      {r.status === "in_progress" ? t("in_progress") : t("ready")}
                                      {r.tutorPersona ? ` · ${tutorLabel(r.tutorPersona)}` : ""}
                                    </p>
                                  </div>
                                  <Link
                                    href={`/learner/lesson-runs/${r.id}`}
                                    className="shrink-0 text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                                  >
                                    {r.status === "in_progress" ? t("resume") : t("open")}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {completed.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-iw-text-muted mb-2">
                              {t("recent_completed")}
                            </p>
                            <ul className="flex flex-col gap-2">
                              {completed.map((r) => (
                                <li key={r.id} className="rounded-iw-control bg-iw-card p-3">
                                  <p className="font-medium">
                                    {subjectMap.get(r.subjectId)?.name ?? t("ai_lesson")}
                                  </p>
                                  <p className="text-xs text-iw-text-muted">
                                    {r.tutorPersona ? `${tutorLabel(r.tutorPersona)} · ` : ""}
                                    {formatDate(r.completedAt, locale) ?? ""}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </SectionCard>

                  {/* Care team — listed & messageable, no booking */}
                  <SectionCard
                    title={t("care_team")}
                    iconName="care"
                    cta={{ href: "/parent/learners/new", label: t("add_member") }}
                  >
                    {members.length === 0 ? (
                      <p className="text-iw-text-muted">{t("no_care_team")}</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {members.map(({ role, m }) => {
                          const joined = m.status === "ACCEPTED" && Boolean(m.memberUserId);
                          return (
                            <li
                              key={m.id}
                              className="flex items-center justify-between gap-3 rounded-iw-control border border-iw-border p-3"
                            >
                              <div className="min-w-0">
                                <p className="font-medium truncate">{m.email}</p>
                                <p className="text-xs text-iw-text-muted">
                                  {t(`role_${role}`)}
                                  {m.relationship ? ` · ${m.relationship}` : ""}
                                  {m.specialty ? ` · ${m.specialty}` : ""}
                                </p>
                              </div>
                              {joined ? (
                                <Link
                                  href="/messages"
                                  className={`${MEMBER_PILL_JOINED} shrink-0 hover:underline`}
                                >
                                  {t("message")}
                                </Link>
                              ) : (
                                <span className={`${MEMBER_PILL_PENDING} shrink-0`}>
                                  {m.status === "PENDING" ? t("invited") : t("not_joined")}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </SectionCard>
                </div>
              </section>
            );
          }),
        )
      )}
    </AppShell>
  );
}
