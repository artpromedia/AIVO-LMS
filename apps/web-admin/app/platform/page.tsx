import Link from "next/link";
import { ROLE_LABEL, requirePlatformPage } from "@aivo/admin-auth";
import { getPlatformSystemHealth } from "@aivo/admin-api/platform";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { AdminNavGrid } from "@/components/admin-nav";

const PLATFORM_NAV = [
  {
    href: "/platform/system-health",
    title: "System health",
    description: "Live tenant, learning, and AI-usage signals.",
  },
  { href: "/platform/tenants", title: "Tenants", description: "Districts, schools, and families." },
  { href: "/platform/users", title: "Users", description: "Admin, educator, and guardian accounts." },
  { href: "/platform/learners", title: "Learners", description: "Learner profiles across tenants." },
  {
    href: "/platform/identity",
    title: "Identity",
    description: "District invites and SCIM provisioning.",
  },
  { href: "/platform/content", title: "Content packs", description: "Versioned activity bundles." },
  { href: "/platform/billing", title: "Billing", description: "Accounts and trial conversion." },
  {
    href: "/platform/compliance",
    title: "Compliance",
    description: "Controls and evidence bundles.",
  },
  { href: "/platform/safety", title: "Safety", description: "AI content moderation queue." },
  {
    href: "/platform/security",
    title: "Security",
    description: "SOC 2 control register and coverage.",
  },
  { href: "/platform/ai-costs", title: "AI costs", description: "Per-tenant spend and budget caps." },
  {
    href: "/platform/ai/policies",
    title: "AI policies",
    description: "Stacked Responsible-AI safety policies.",
  },
  {
    href: "/platform/ai/incidents",
    title: "AI incidents",
    description: "Responsible-AI incident register.",
  },
  {
    href: "/platform/ai/optouts",
    title: "AI opt-outs",
    description: "Per-tenant model and feature opt-outs.",
  },
  {
    href: "/platform/ai/models",
    title: "AI models",
    description: "Model registry, cards, and versions.",
  },
  {
    href: "/platform/ai/evals",
    title: "AI evals",
    description: "Safety, accuracy, and bias harness runs.",
  },
  {
    href: "/platform/feature-flags",
    title: "Feature flags",
    description: "Enterprise and sprint flag state.",
  },
  {
    href: "/platform/audio/pronunciation",
    title: "Pronunciation",
    description: "TTS pronunciation override dictionary.",
  },
  { href: "/platform/support", title: "Support", description: "Customer support ticket queue." },
  { href: "/platform/audit", title: "Audit log", description: "Hash-chained admin action history." },
  { href: "/platform/jobs", title: "Jobs", description: "Scheduled job freshness and run health." },
  {
    href: "/platform/settings/api-keys",
    title: "API keys",
    description: "Service credentials and rotation.",
  },
];

export default async function PlatformPage() {
  const session = await requirePlatformPage("platform:read");
  const health = await getPlatformSystemHealth(session);

  return (
    <AdminPageFrame
      eyebrow="AIVO Admin"
      title="Platform operations"
      description={`Signed in as ${session.displayName} (${ROLE_LABEL[session.role]}).`}
      action={
        <div className="flex flex-wrap gap-2">
          {session.role === "platform_admin" ? (
            <Link className="admin-button" href="/platform/districts/new">
              Onboard district
            </Link>
          ) : null}
          <Link className="admin-button admin-button-secondary" href="/login">
            Switch account
          </Link>
        </div>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminMetricCard label="Tenants" value={health.tenantsTotal} />
        <AdminMetricCard label="Users" value={health.usersTotal} />
        <AdminMetricCard label="Learners" value={health.learnersTotal} />
        <AdminMetricCard label="AI requests 24h" value={health.aiRequests24h} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Secure district onboarding</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Platform admins can create a district, invite its first administrator without a temporary
          password, and manage the invitation lifecycle from this standalone console.
        </p>
        {session.role === "platform_admin" ? (
          <Link className="mt-4 inline-flex font-bold text-blue-700" href="/platform/districts">
            View district invitations
          </Link>
        ) : null}
      </AdminCard>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Pilot coupons</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Mint and disable discount, subscription, and provisioning (district/school pilot) coupons.
          Backed by billing-svc, the single source of truth for every coupon.
        </p>
        {session.role === "platform_admin" ? (
          <div className="mt-4 flex flex-wrap gap-4">
            <Link className="inline-flex font-bold text-blue-700" href="/platform/billing/coupons">
              Manage coupons
            </Link>
            <Link className="inline-flex font-bold text-blue-700" href="/platform/billing/trials">
              Trials & conversion
            </Link>
          </div>
        ) : null}
      </AdminCard>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Sales leads</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Website demo, waitlist, and contact submissions with campaign attribution (utm + coupon)
          and a status lifecycle from new through pilot to won/lost.
        </p>
        {session.role === "platform_admin" || session.role === "sales" ? (
          <Link className="mt-4 inline-flex font-bold text-blue-700" href="/platform/sales/leads">
            View leads
          </Link>
        ) : null}
      </AdminCard>

      <AdminNavGrid heading="Operations" items={PLATFORM_NAV} />
    </AdminPageFrame>
  );
}
