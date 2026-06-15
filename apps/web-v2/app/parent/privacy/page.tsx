import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  listPolicyVersions,
  listSubprocessors,
  listDataExportRequestsForUser,
  listDataDeletionRequestsForUser,
} from "@/lib/db/repos";
import { ChevronRight, Download, Trash2, ShieldCheck, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.privacy");
  const policies = await listPolicyVersions();
  const subs = await listSubprocessors();
  const exportReqs = await listDataExportRequestsForUser(session.userId, session.tenantId);
  const deleteReqs = await listDataDeletionRequestsForUser(session.userId, session.tenantId);

  const links: { href: string; label: string; description: string; icon: React.ReactNode }[] = [
    {
      href: "/parent/consent",
      label: t("link_consent_label"),
      description: t("link_consent_desc"),
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      href: "/parent/privacy/data-export",
      label: t("link_export_label"),
      description: t("link_export_desc"),
      icon: <Download className="h-4 w-4" />,
    },
    {
      href: "/parent/privacy/delete-data",
      label: t("link_delete_label"),
      description: t("link_delete_desc"),
      icon: <Trash2 className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <div className="grid gap-3 sm:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex flex-col gap-2 rounded-iw-card-lg bg-white border border-iw-border p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)] hover:border-[var(--aivo-sensory-primary)] transition-colors"
          >
            <div className="flex items-center gap-2 text-iw-text-strong">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-iw-control bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)] shrink-0">
                {l.icon}
              </span>
              <h3 className="font-semibold">{l.label}</h3>
              <ChevronRight className="ml-auto h-4 w-4 text-iw-text-muted" />
            </div>
            <p className="text-sm text-iw-text-muted">{l.description}</p>
          </Link>
        ))}
      </div>

      <section className="mt-6 rounded-iw-card-lg bg-white border border-iw-border p-5 sm:p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)]">
        <h2 className="text-base sm:text-lg font-semibold text-iw-text-strong flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--aivo-sensory-primary)]" /> {t("policies_title")}
        </h2>
        <ul className="mt-3 divide-y">
          {policies.map((p) => (
            <li key={p.id} className="py-2 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-iw-text-strong">{humanize(p.kind)}</p>
                <p className="text-sm text-iw-text-muted">{p.summary}</p>
              </div>
              <Badge tone="neutral">v{p.version}</Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-iw-card-lg bg-white border border-iw-border p-5 sm:p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)]">
        <h2 className="text-base sm:text-lg font-semibold text-iw-text-strong">
          {t("subprocessors_title")}
        </h2>
        <p className="text-sm text-iw-text-muted">{t("subprocessors_desc")}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {subs.map((s) => (
            <li key={s.id} className="rounded-iw-control border border-iw-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-iw-text-strong">{s.name}</span>
                <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
              </div>
              <p className="text-iw-text-muted">{s.purpose}</p>
              <p className="text-xs text-iw-text-muted">{t("region", { region: s.region })}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="rounded-iw-card-lg bg-white border border-iw-border p-5 sm:p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)]">
          <h3 className="font-semibold text-iw-text-strong">{t("export_requests_title")}</h3>
          {exportReqs.length === 0 ? (
            <p className="mt-2 text-sm text-iw-text-muted">{t("no_requests")}</p>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {exportReqs.slice(0, 5).map((r) => (
                <li key={r.id} className="py-2 flex justify-between">
                  <span className="text-iw-text-strong">
                    {new Date(r.requestedAt).toLocaleDateString()}
                  </span>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-iw-card-lg bg-white border border-iw-border p-5 sm:p-6 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)]">
          <h3 className="font-semibold text-iw-text-strong">{t("deletion_requests_title")}</h3>
          {deleteReqs.length === 0 ? (
            <p className="mt-2 text-sm text-iw-text-muted">{t("no_requests")}</p>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {deleteReqs.slice(0, 5).map((r) => (
                <li key={r.id} className="py-2 flex justify-between">
                  <span className="text-iw-text-strong">
                    {new Date(r.requestedAt).toLocaleDateString()} · {r.scope}
                  </span>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(s: string): "success" | "warning" | "neutral" | "danger" {
  if (s === "completed") return "success";
  if (s === "denied") return "danger";
  if (s === "in_progress" || s === "approved") return "warning";
  return "neutral";
}
