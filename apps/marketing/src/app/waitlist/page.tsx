import type { Metadata } from "next";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { WaitlistForm } from "@/components/marketing/forms";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Join the AIVO waitlist",
  description:
    "Save your spot for AIVO Learning. We'll email you as new family spots open — no spam, no sharing.",
  alternates: { canonical: `${SITE_URL}/waitlist` },
};

export default function WaitlistPage() {
  return (
    <LandingPageLayout
      badge="Waitlist"
      title="Save your spot."
      subtitle="AIVO opens to new families in small batches so every learner gets a real onboarding. Drop your email and we'll let you know when it's your turn."
      breadcrumbs={[{ name: "Waitlist", href: "/waitlist" }]}
      finalCta={{
        title: "Looking for schools or districts?",
        body: "Schools and districts don't wait — request a demo and we'll scope a pilot.",
        primary: { label: "Request a demo", href: "/demo" },
        secondary: { label: "For schools", href: "/for-schools" },
      }}
    >
      <section
        aria-labelledby="waitlist-form-heading"
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8"
      >
        <h2 id="waitlist-form-heading" className="font-heading text-2xl font-bold text-slate-900">
          Tell us about your learner
        </h2>
        <p className="mt-1 mb-6 font-body text-slate-600">
          Two required fields. The rest helps us pick the right onboarding when your spot opens.
        </p>
        <WaitlistForm />
      </section>

      <section
        aria-labelledby="waitlist-promise-heading"
        className="mt-10 rounded-3xl border border-slate-200 bg-slate-50/60 p-6 md:p-8"
      >
        <h2 id="waitlist-promise-heading" className="font-heading text-xl font-bold text-slate-900">
          What we promise
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <li className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="font-heading text-sm font-bold text-emerald-700">No spam</span>
            <p className="mt-1 font-body text-slate-700">
              One email when your spot opens. Maybe a second if you don't reply.
            </p>
          </li>
          <li className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="font-heading text-sm font-bold text-emerald-700">No sharing</span>
            <p className="mt-1 font-body text-slate-700">
              We don't sell or share your contact info — ever. See our privacy policy.
            </p>
          </li>
          <li className="rounded-2xl border border-slate-200 bg-white p-5">
            <span className="font-heading text-sm font-bold text-emerald-700">Easy out</span>
            <p className="mt-1 font-body text-slate-700">
              Reply &quot;remove&quot; to any waitlist email and we delete your record.
            </p>
          </li>
        </ul>
      </section>
    </LandingPageLayout>
  );
}
