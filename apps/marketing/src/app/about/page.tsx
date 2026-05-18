"use client";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { trackCTAClick, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL } from "@/lib/constants";

const PRINCIPLES = [
  {
    icon: "🧬",
    title: "Truly Personalized",
    description:
      "Every interaction adapts to the individual learner's Brain Clone, a unique AI profile that understands how each student learns best.",
    color: "#7c3aed",
  },
  {
    icon: "♿",
    title: "Inclusive by Design",
    description:
      "Built from the ground up for all functioning levels, with deep IEP integration ensuring every student gets the support they need.",
    color: "#059669",
  },
  {
    icon: "🤖",
    title: "AI-Native",
    description:
      "Not AI-bolted-on. The AI IS the product. Every feature is powered by advanced artificial intelligence, not retrofitted with it.",
    color: "#2563eb",
  },
  {
    icon: "📊",
    title: "Measurably Effective",
    description:
      "Data-driven outcomes with transparent progress tracking. Parents and educators always know exactly where students stand.",
    color: "#d97706",
  },
  {
    icon: "🎮",
    title: "Joyful Learning",
    description:
      "Gamification, personality-rich tutors, and engaging content make learning something students look forward to every day.",
    color: "#ec4899",
  },
];

const VALUES = [
  {
    icon: "💡",
    title: "Innovation",
    description:
      "We push the boundaries of what's possible in education technology, using cutting-edge AI to solve real learning challenges.",
    color: "#7c3aed",
  },
  {
    icon: "🤝",
    title: "Inclusion",
    description:
      "Every decision we make is guided by our commitment to serving all learners, regardless of ability, background, or learning style.",
    color: "#059669",
  },
  {
    icon: "🛡️",
    title: "Integrity",
    description:
      "We protect student data fiercely, communicate honestly with families and educators, and hold ourselves to the highest ethical standards.",
    color: "#2563eb",
  },
  {
    icon: "🎯",
    title: "Impact",
    description:
      "We measure success by student outcomes. If it doesn't measurably help learners grow, we don't ship it.",
    color: "#d97706",
  },
];

const LEADERS = [
  {
    name: "Dr. Ikechukwu Osuji",
    role: "Co-Founder & Chairman",
    image: "/images/team/osuji.png",
    bio: "Ikechukwu Osuji, MD, MPH, is a distinguished Internal Medicine physician and healthcare executive with over 35 years of global experience. He completed his Internal Medicine residency at Howard University — graduating top of his class — and earned a Master of Public Health from George Washington University specializing in International Health. Ike's career spans both clinical and executive leadership, serving as Chief of Staff at two U.S. hospitals and Medical Director of Ernest Health International, overseeing 26 hospitals nationwide.",
    linkedin: "https://www.linkedin.com/",
    color: "#7c3aed",
  },
  {
    name: "Ofem Ekapong Ofem",
    role: "Co-Founder & Chief Strategy Officer",
    image: "/images/team/ofem.png",
    bio: "Ofem Ofem is a business executive with nearly two decades of experience in workforce development, human capital strategy, and organizational leadership. He served as Managing Director of SmartCity Lagos, a $10 billion smart-city initiative assessed by PwC as one of the largest single foreign direct investments in Nigerian history. A published scholar completing his Doctor of Business Administration at Saint Mary's University of Minnesota with a focus on AI governance.",
    linkedin: "https://www.linkedin.com/in/ofem-ofem",
    color: "#2563eb",
  },
  {
    name: "Nnamdi Uzokwe",
    role: "Co-Founder & Chief Commercial Officer",
    image: "/images/team/nnamdi.jpg",
    bio: "Nnamdi Uzokwe is a retired U.S. Navy Reserves officer with over three decades of experience in medical device sales and entrepreneurship. His disciplined military leadership background and deep healthcare-industry relationships give AIVO a powerful commercial engine — from go-to-market strategy and channel partnerships to enterprise sales execution across school districts, therapy practices, and healthcare organizations.",
    linkedin: "https://www.linkedin.com/",
    color: "#059669",
  },
  {
    name: "Edward Hamilton",
    role: "VP, Special Education & Sales",
    image: "/images/team/edward.png",
    bio: "Edward Hamilton is a veteran of the NYPD 911 system and a dedicated special education advocate. His years of frontline public service instilled a profound commitment to protecting and uplifting vulnerable communities. Edward bridges the gap between families navigating the complex special education system and the technology that can transform their children's outcomes.",
    linkedin: "https://www.linkedin.com/",
    color: "#d97706",
  },
  {
    name: "Dr. Patrick Ukata",
    role: "VP, Curriculum Design & Compliance",
    image: "/images/team/patrick.png",
    bio: "Patrick Ukata, PhD, brings over three decades of experience in the education sector, with roles at American University (Washington, D.C.), George Washington University, and Johns Hopkins University. His deep expertise in curriculum development, instructional design, and regulatory compliance ensures AIVO's learning content meets the highest academic standards and accessibility requirements.",
    linkedin: "https://www.linkedin.com/",
    color: "#ec4899",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO"
              width={130}
              height={40}
              priority
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link
              href="/"
              className="px-5 py-2 rounded-lg text-slate-600 font-semibold hover:text-primary transition hidden sm:inline-flex"
            >
              Home
            </Link>
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              onClick={() => {
                trackCTAClick("about_get_started", `${WEB_APP_URL}/signup?plan=free`);
                trackSignupInitiation("about");
              }}
              className="px-5 py-2.5 rounded-full bg-primary text-white font-bold hover:bg-primary-dark transition shadow-lg shadow-purple-200"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden py-20 md:py-28"
        style={{ background: "linear-gradient(135deg, #7c3aed08 0%, #7c3aed04 50%, #ffffff 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-20 bg-purple-400" />
          <div className="absolute bottom-0 -left-20 w-60 h-60 rounded-full blur-3xl opacity-10 bg-indigo-400" />
        </div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-purple-50/80 border border-purple-100 mb-6">
            <span className="text-lg">🎯</span>
            <span className="text-sm font-bold text-primary uppercase tracking-widest">
              Our Mission
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-heading font-bold text-slate-900 mb-6 leading-tight">
            No Learner Left Behind
          </h1>
          <p className="text-lg md:text-xl text-slate-500 font-body max-w-3xl mx-auto leading-relaxed">
            AIVO Learning was founded on a simple belief: every student deserves a learning
            experience that adapts to them, not the other way around. Our AI-powered platform
            creates a unique learning profile — a Brain Clone — for every student, ensuring that no
            learner is left behind regardless of their learning differences, disabilities, or
            functioning level.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 mb-4">
              Core Principles
            </h2>
            <p className="text-lg text-slate-500 font-body">
              The foundations that guide everything we build.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {PRINCIPLES.map((p) => (
              <div
                key={p.title}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 text-center"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
                  style={{ backgroundColor: `${p.color}10` }}
                >
                  {p.icon}
                </div>
                <h3 className="text-lg font-heading font-bold text-slate-900 mb-2">{p.title}</h3>
                <p className="text-sm text-slate-500 font-body leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 mb-4">
              Our Values
            </h2>
            <p className="text-lg text-slate-500 font-body">
              What we stand for as a company and as educators.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="flex gap-5 p-6 rounded-2xl border border-slate-100 bg-white hover:shadow-lg transition-all"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: `${v.color}10` }}
                >
                  {v.icon}
                </div>
                <div>
                  <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">{v.title}</h3>
                  <p className="text-slate-500 font-body leading-relaxed">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 mb-4">
              Meet Our Leadership
            </h2>
            <p className="text-lg text-slate-500 font-body max-w-3xl mx-auto">
              AIVO is led by a team of seasoned executives who bring decades of cross-sector
              experience in healthcare, business strategy, education, public service, and
              technology.
            </p>
          </div>
          <div className="space-y-8">
            {LEADERS.map((leader, i) => (
              <div
                key={leader.name}
                className={`flex flex-col ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"} gap-8 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl transition-all`}
              >
                <div className="relative w-full md:w-80 h-80 md:h-auto flex-shrink-0">
                  <div
                    className="absolute inset-0 bg-gradient-to-br opacity-10"
                    style={{
                      background: `linear-gradient(135deg, ${leader.color}30, ${leader.color}05)`,
                    }}
                  />
                  <Image
                    src={leader.image}
                    alt={leader.name}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, 320px"
                  />
                </div>
                <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-1.5 h-8 rounded-full"
                      style={{ backgroundColor: leader.color }}
                    />
                    <h3 className="text-2xl font-heading font-bold text-slate-900">
                      {leader.name}
                    </h3>
                  </div>
                  <p
                    className="text-sm font-bold uppercase tracking-widest mb-4"
                    style={{ color: leader.color }}
                  >
                    {leader.role}
                  </p>
                  <p className="text-slate-600 font-body leading-relaxed mb-6">{leader.bio}</p>
                  <a
                    href={leader.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-bold transition hover:opacity-80"
                    style={{ color: leader.color }}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn Profile
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6 md:px-8 text-center">
          <div className="bg-gradient-to-r from-primary to-purple-600 rounded-3xl p-10 md:p-16 text-white">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Join Our Mission</h2>
            <p className="text-lg text-white/80 font-body mb-8 max-w-2xl mx-auto">
              Help us build a world where every student gets the personalized education they
              deserve.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/careers"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-white text-primary font-bold text-lg hover:bg-purple-50 transition shadow-xl min-h-[44px]"
              >
                View Open Positions
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border-2 border-white/30 text-white font-bold text-lg hover:bg-white/10 transition min-h-[44px]"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 py-8">
        <div className="max-w-6xl mx-auto px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Image
              src="/images/aivo-logo-white.png"
              alt="AIVO"
              width={100}
              height={30}
              style={{ width: "auto", height: "auto" }}
            />
            <nav className="hidden md:flex items-center gap-4">
              <Link
                href="/privacy-policy"
                className="text-sm text-slate-400 hover:text-white transition"
              >
                Privacy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-sm text-slate-400 hover:text-white transition"
              >
                Terms
              </Link>
              <Link
                href="/coppa-compliance"
                className="text-sm text-slate-400 hover:text-white transition"
              >
                COPPA
              </Link>
              <Link
                href="/ferpa-compliance"
                className="text-sm text-slate-400 hover:text-white transition"
              >
                FERPA
              </Link>
              <Link
                href="/accessibility"
                className="text-sm text-slate-400 hover:text-white transition"
              >
                Accessibility
              </Link>
            </nav>
          </div>
          <p className="text-sm text-slate-500 font-body">
            &copy; {new Date().getFullYear()} AIVO Learning Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
