"use client";
import { CompanyPageLayout } from "@/components/marketing/legal/CompanyPageLayout";

const PERKS = [
  {
    icon: "🌍",
    title: "Remote-First",
    description:
      "Work from anywhere in the world. We believe great talent isn't limited by geography.",
  },
  {
    icon: "🎯",
    title: "Mission-Driven",
    description:
      "Your work directly impacts children with diverse learning needs across the country.",
  },
  {
    icon: "📚",
    title: "Learning Budget",
    description: "Annual learning stipend for courses, conferences, and professional development.",
  },
  {
    icon: "🏥",
    title: "Health & Wellness",
    description: "Comprehensive health, dental, and vision coverage for you and your family.",
  },
  {
    icon: "🏖️",
    title: "Generous PTO",
    description: "Unlimited vacation policy plus company-wide wellness days throughout the year.",
  },
  {
    icon: "💰",
    title: "Equity",
    description: "Stock options so you share in the success you help create.",
  },
];

const DEPARTMENTS = [
  {
    name: "Engineering",
    color: "#7c3aed",
    roles: [
      { title: "Senior Full-Stack Engineer", type: "Full-time", location: "Remote" },
      { title: "AI/ML Engineer — Brain Clone", type: "Full-time", location: "Remote" },
      { title: "Mobile Engineer (React Native)", type: "Full-time", location: "Remote" },
    ],
  },
  {
    name: "Education & Content",
    color: "#059669",
    roles: [
      { title: "Curriculum Designer — Special Education", type: "Full-time", location: "Remote" },
      { title: "Content Writer — K-12 Learning", type: "Contract", location: "Remote" },
    ],
  },
  {
    name: "Sales & Growth",
    color: "#2563eb",
    roles: [
      {
        title: "Enterprise Sales — School Districts",
        type: "Full-time",
        location: "Remote / Travel",
      },
      { title: "Customer Success Manager", type: "Full-time", location: "Remote" },
    ],
  },
];

export default function CareersPage() {
  return (
    <CompanyPageLayout
      badge="Careers"
      breadcrumbSlug="careers"
      title="Join the AIVO Team"
      subtitle="Help us build a world where every student gets the personalized education they deserve. We're always looking for passionate people."
      icon="🚀"
      accentColor="#059669"
    >
      <section className="mb-16">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-8">Why Work at AIVO?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PERKS.map((perk) => (
            <div
              key={perk.title}
              className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-md transition"
            >
              <div className="text-3xl mb-3">{perk.icon}</div>
              <h3 className="text-lg font-heading font-bold text-slate-900 mb-2">{perk.title}</h3>
              <p className="text-sm text-slate-500 font-body leading-relaxed">{perk.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-8">Open Positions</h2>
        <div className="space-y-8">
          {DEPARTMENTS.map((dept) => (
            <div key={dept.name}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                <h3 className="text-lg font-heading font-bold text-slate-900">{dept.name}</h3>
                <span className="text-sm text-slate-400 font-body">({dept.roles.length} open)</span>
              </div>
              <div className="space-y-3">
                {dept.roles.map((role) => (
                  <div
                    key={role.title}
                    className="bg-white rounded-xl border border-slate-100 p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:shadow-md transition hover:border-slate-200"
                  >
                    <div>
                      <h4 className="font-heading font-bold text-slate-900">{role.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-slate-400 font-body">{role.type}</span>
                        <span className="text-slate-200">|</span>
                        <span className="text-sm text-slate-400 font-body">{role.location}</span>
                      </div>
                    </div>
                    <a
                      href={`mailto:careers@aivolearning.com?subject=Application: ${role.title}`}
                      className="inline-flex items-center px-5 py-2 rounded-full text-sm font-bold text-white transition hover:opacity-90 flex-shrink-0"
                      style={{ backgroundColor: dept.color }}
                    >
                      Apply Now
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-16 p-8 rounded-3xl bg-emerald-50 border border-emerald-100 text-center">
        <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">Don't see your role?</h3>
        <p className="text-slate-600 font-body mb-6">
          We are always interested in hearing from talented people passionate about education and
          technology.
        </p>
        <a
          href="mailto:careers@aivolearning.com?subject=General Application"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition shadow-lg"
        >
          Send General Application
        </a>
      </div>
    </CompanyPageLayout>
  );
}
