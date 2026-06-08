import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
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
          <Link key={l.href} href={l.href} className="block">
            <Card className="p-[var(--aivo-density-card-pad)] hover:bg-aivo-surface-2 transition">
              <div className="flex items-center gap-2 text-aivo-ink">
                {l.icon}
                <h3 className="font-display font-semibold">{l.label}</h3>
                <ChevronRight className="ml-auto h-4 w-4 text-aivo-muted" />
              </div>
              <p className="mt-2 text-sm text-aivo-ink-soft">{l.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> {t("policies_title")}
        </h2>
        <ul className="mt-3 divide-y">
          {policies.map((p) => (
            <li key={p.id} className="py-2 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{humanize(p.kind)}</p>
                <p className="text-sm text-aivo-ink-soft">{p.summary}</p>
              </div>
              <Badge tone="neutral">v{p.version}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display text-lg font-semibold">{t("subprocessors_title")}</h2>
        <p className="text-sm text-aivo-ink-soft">{t("subprocessors_desc")}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {subs.map((s) => (
            <li key={s.id} className="rounded border border-aivo-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
              </div>
              <p className="text-aivo-ink-soft">{s.purpose}</p>
              <p className="text-xs text-aivo-muted">{t("region", { region: s.region })}</p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <h3 className="font-display font-semibold">{t("export_requests_title")}</h3>
          {exportReqs.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-ink-soft">{t("no_requests")}</p>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {exportReqs.slice(0, 5).map((r) => (
                <li key={r.id} className="py-2 flex justify-between">
                  <span>{new Date(r.requestedAt).toLocaleDateString()}</span>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <h3 className="font-display font-semibold">{t("deletion_requests_title")}</h3>
          {deleteReqs.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-ink-soft">{t("no_requests")}</p>
          ) : (
            <ul className="mt-2 divide-y text-sm">
              {deleteReqs.slice(0, 5).map((r) => (
                <li key={r.id} className="py-2 flex justify-between">
                  <span>
                    {new Date(r.requestedAt).toLocaleDateString()} · {r.scope}
                  </span>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
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
