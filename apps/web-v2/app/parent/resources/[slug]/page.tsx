import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getResource, type ResourceBlock } from "@/lib/parent/resources-content";

function Block({ block }: { block: ResourceBlock }) {
  if (block.type === "h2") {
    return <h2 className="mt-5 font-display text-lg font-semibold text-iw-text-strong">{block.text}</h2>;
  }
  if (block.type === "ul") {
    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-aivo-ink">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="mt-3 text-sm leading-relaxed text-aivo-ink">{block.text}</p>;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTranslations("parent.resources");
  const session = await requirePageRole(["parent"]);
  const { slug } = await params;
  const resource = getResource(slug);
  if (!resource) notFound();

  const updated = new Date(resource.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <Link
        href="/parent/resources"
        className="inline-flex items-center gap-1 text-sm font-medium text-aivo-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t("back")}
      </Link>

      <PageHeader
        eyebrow={t(`category_${resource.category}`)}
        title={resource.title}
        description={resource.summary}
      />
      <p className="-mt-2 text-xs text-aivo-ink-soft">
        {t("updated", { date: updated })} · {t("read_minutes", { count: resource.readMinutes })}
      </p>

      <Card className="p-6">
        <article>
          {resource.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </article>
      </Card>

      <Card className="p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display text-base font-semibold text-iw-text-strong">
          {t("sources_heading")}
        </h2>
        <ul className="mt-2 space-y-2">
          {resource.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1 text-sm text-aivo-accent hover:underline"
              >
                <span>
                  {s.label} — {s.publisher}
                </span>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                <span className="sr-only">{t("opens_new_tab")}</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-aivo-ink-soft">{t("disclaimer")}</p>
    </AppShell>
  );
}
