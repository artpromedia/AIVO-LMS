import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

const SETTINGS_LINKS = [
  {
    href: "/platform/settings/api-keys",
    title: "API keys",
    description: "Service and integration credentials with rotation and grace-period status.",
  },
];

export default async function PlatformSettingsPage() {
  await requirePlatformPage("platform:read");

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Settings"
      description="Platform-wide configuration and credentials."
    >
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {SETTINGS_LINKS.map((link) => (
          <AdminCard className="p-6" key={link.href}>
            <h2 className="text-xl font-black">{link.title}</h2>
            <p className="mt-2 text-slate-600">{link.description}</p>
            <Link className="mt-4 inline-flex font-bold text-blue-700" href={link.href}>
              Open
            </Link>
          </AdminCard>
        ))}
      </div>
    </AdminPageFrame>
  );
}
