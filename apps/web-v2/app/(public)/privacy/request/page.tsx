import { requireAnonymous } from "@/lib/auth/server";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { DsarIntakeForm } from "./_components/dsar-intake-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Open to anonymous visitors; if a user is already signed in, let them
  // through — they may be submitting on their own behalf.
  await requireAnonymous();

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-iw-ink-muted">
            Privacy &amp; Data Rights
          </p>
          <h1 className="mt-2 font-iw-display text-3xl font-bold text-iw-ink">
            Submit a privacy / data request
          </h1>
          <p className="mt-2 text-iw-ink-muted">
            You have the right to access, correct, export, or erase your personal data held by AIVO
            Learning. Complete the form below to submit a Data Subject Access Request (DSAR).
          </p>
          <ul className="mt-4 grid gap-1 text-sm text-iw-ink-muted list-disc pl-5">
            <li>
              Acknowledgment within <strong>72 hours</strong>
            </li>
            <li>
              Fulfillment within <strong>30–45 days</strong> depending on regulation
            </li>
            <li>No fee for a first request in any 12-month period</li>
          </ul>
        </div>

        <DsarIntakeForm />
      </main>
      <SiteFooter />
    </>
  );
}
