import { Badge } from "@/components/ui/badge";
import { listModels } from "@/lib/services/responsible-ai-svc";

export const dynamic = "force-dynamic";

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "deprecated") return "warning";
  return "neutral";
}

export default async function Page() {
  const models = await listModels();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-iw-ink-muted">
        Responsible AI
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">AI Transparency</h1>
      <p className="mt-4 max-w-2xl text-iw-ink-muted">
        AIVO is committed to the responsible use of AI in education. Every model we deploy is
        governed under the NIST AI Risk Management Framework and aligned with the transparency and
        risk-classification obligations of the EU AI Act. The registry below summarizes each AI
        system we use, what it is for, and where it should not be used.
      </p>

      <div className="mt-10 space-y-6">
        {models.map((m) => (
          <section
            key={m.id}
            className="rounded-[var(--radius-card)] border border-iw-border bg-iw-card p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">{m.name}</h2>
              <Badge tone={statusTone(m.status)}>{m.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-iw-ink-muted">
              {m.provider} · {m.modality}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-iw-ink-muted">Intended use</p>
                <p className="mt-1 text-sm">{m.intendedUse}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-iw-ink-muted">
                  Out-of-scope use
                </p>
                <p className="mt-1 text-sm">{m.outOfScopeUse}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
