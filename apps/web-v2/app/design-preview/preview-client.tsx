"use client";

import * as React from "react";
import {
  Accessibility,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Command,
  Contrast,
  Download,
  Filter,
  Hand,
  Home,
  LayoutDashboard,
  LibraryBig,
  MessageSquareText,
  Moon,
  MousePointer2,
  Pause,
  Play,
  PlayCircle,
  Plus,
  School,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Tablet,
  Target,
  TrendingUp,
  Users,
  Volume2,
} from "lucide-react";

type Appearance = "light" | "dark" | "high-contrast";
type Sensory = "standard" | "calm";
type Age = "early" | "middle" | "older";
type Communication = "symbol-first" | "supported-text" | "text-first";
type Surface =
  | "learner"
  | "care"
  | "district"
  | "platform"
  | "marketing"
  | "foundations";

const surfaces: Array<{ id: Surface; label: string; icon: React.ReactNode }> = [
  { id: "learner", label: "Learner stage", icon: <Tablet size={17} /> },
  { id: "care", label: "Care team", icon: <CircleUserRound size={17} /> },
  { id: "district", label: "School district", icon: <School size={17} /> },
  { id: "platform", label: "AIVO Platform", icon: <LayoutDashboard size={17} /> },
  { id: "marketing", label: "Marketing", icon: <Sparkles size={17} /> },
  { id: "foundations", label: "Foundations", icon: <Command size={17} /> },
];

export function DesignPreview() {
  const [appearance, setAppearance] = React.useState<Appearance>("light");
  const [sensory, setSensory] = React.useState<Sensory>("standard");
  const [age, setAge] = React.useState<Age>("middle");
  const [communication, setCommunication] =
    React.useState<Communication>("supported-text");
  const [surface, setSurface] = React.useState<Surface>("learner");
  const [message, setMessage] = React.useState("Ready when you are.");

  return (
    <div
      className="ss-preview"
      data-design-system="steady-signal"
      data-ss-appearance={appearance}
      data-ss-sensory={sensory}
      data-ss-age={age}
      data-ss-communication={communication}
      data-ss-role={roleForSurface(surface)}
    >
      <a className="ss-skip" href="#steady-signal-preview">
        Skip to preview
      </a>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>

      <header className="ss-topbar">
        <a className="ss-wordmark" href="#steady-signal-preview" aria-label="AIVO Steady Signal">
          <SignalMark />
          <span>
            <strong>AIVO</strong>
            <small>Steady Signal</small>
          </span>
        </a>
        <div className="ss-status">
          <span className="ss-status-dot" aria-hidden />
          Foundation proof · generated from @aivo/brand
        </div>
      </header>

      <div className="ss-layout">
        <aside className="ss-controls" aria-label="Adaptive design controls">
          <div className="ss-control-intro">
            <span className="ss-kicker">Adaptivity model</span>
            <h1>One identity. The right signal strength.</h1>
            <p>
              These axes combine independently. No screen-specific theme hacks and no loss of
              capability.
            </p>
          </div>

          <AxisControl
            label="Appearance"
            value={appearance}
            onChange={(value) => setAppearance(value as Appearance)}
            options={[
              { value: "light", label: "Light", icon: <Sun size={16} /> },
              { value: "dark", label: "Dark", icon: <Moon size={16} /> },
              { value: "high-contrast", label: "Contrast", icon: <Contrast size={16} /> },
            ]}
          />
          <AxisControl
            label="Sensory intensity"
            value={sensory}
            onChange={(value) => setSensory(value as Sensory)}
            options={[
              { value: "calm", label: "Calm", icon: <Pause size={16} /> },
              { value: "standard", label: "Standard", icon: <Play size={16} /> },
            ]}
          />
          <AxisControl
            label="Age expression"
            value={age}
            onChange={(value) => setAge(value as Age)}
            options={[
              { value: "early", label: "Early" },
              { value: "middle", label: "Middle" },
              { value: "older", label: "Older" },
            ]}
          />
          <AxisControl
            label="Communication"
            value={communication}
            onChange={(value) => setCommunication(value as Communication)}
            options={[
              { value: "symbol-first", label: "Symbols" },
              { value: "supported-text", label: "Supported" },
              { value: "text-first", label: "Text" },
            ]}
          />

          <div className="ss-access-note">
            <Accessibility size={20} aria-hidden />
            <p>
              Calm removes motion and sound. High contrast is independent. Young learner targets
              remain at least 64px.
            </p>
          </div>
        </aside>

        <main id="steady-signal-preview" className="ss-main">
          <nav className="ss-surface-tabs" aria-label="Preview surface">
            {surfaces.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={surface === item.id}
                onClick={() => setSurface(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="ss-preview-region">
            {surface === "learner" && <LearnerProof onAnnounce={setMessage} />}
            {surface === "care" && <CareProof />}
            {surface === "district" && <DistrictDashboardProof />}
            {surface === "platform" && <PlatformDashboardProof />}
            {surface === "marketing" && <MarketingProof />}
            {surface === "foundations" && <FoundationsProof />}
          </div>
        </main>
      </div>
    </div>
  );
}

function roleForSurface(surface: Surface) {
  if (surface === "care") return "care";
  if (surface === "district" || surface === "platform") return "professional";
  if (surface === "marketing") return "marketing";
  return "learner";
}

function LearnerProof({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  return (
    <section className="ss-proof" aria-labelledby="learner-proof-title">
      <ProofHeader
        eyebrow="Learner register · tablet first"
        title="A clear stage with communication always in reach"
        body="Tablet landscape uses the larger canvas for a true learning stage and persistent AAC. Phone keeps every function in a focused vertical flow."
      />

      <div className="ss-device-grid">
        <article className="ss-device ss-device-tablet" aria-label="Tablet landscape learner stage">
          <div className="ss-device-label">
            <Tablet size={16} aria-hidden />
            Tablet landscape · optimal
          </div>
          <div className="ss-tablet-stage">
            <aside className="ss-stage-context">
              <span className="ss-kicker">Now</span>
              <strong>Patterns in sound</strong>
              <SignalSteps />
              <button type="button" className="ss-quiet-button">
                <Pause size={18} /> Take a break
              </button>
            </aside>

            <div className="ss-task">
              <div className="ss-guide" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <span className="ss-kicker">Listen, then choose</span>
              <h2 id="learner-proof-title">Which pattern matches?</h2>
              <button
                type="button"
                className="ss-listen"
                onClick={() => onAnnounce("Playing the sound pattern once.")}
              >
                <Volume2 size={24} aria-hidden />
                Play sound
              </button>
              <div className="ss-answer-grid">
                <button type="button" onClick={() => onAnnounce("First pattern selected.")}>
                  <PatternBars pattern="short-long" />
                  <span>short · long</span>
                </button>
                <button type="button" onClick={() => onAnnounce("Second pattern selected.")}>
                  <PatternBars pattern="long-short" />
                  <span>long · short</span>
                </button>
              </div>
            </div>

            <AacDock />
          </div>
        </article>

        <article className="ss-device ss-device-phone" aria-label="Phone portrait learner stage">
          <div className="ss-device-label">Phone portrait · complete</div>
          <div className="ss-phone-stage">
            <div className="ss-phone-top">
              <span className="ss-kicker">Step 2 of 4</span>
              <button type="button" aria-label="Pause lesson">
                <Pause size={18} />
              </button>
            </div>
            <div className="ss-phone-task">
              <span className="ss-kicker">Listen, then choose</span>
              <h3>Which pattern matches?</h3>
              <button type="button" className="ss-listen" onClick={() => onAnnounce("Playing sound.")}>
                <Volume2 size={21} />
                Play
              </button>
              <button type="button" className="ss-phone-answer">
                <PatternBars pattern="short-long" />
                short · long
              </button>
              <button type="button" className="ss-phone-answer">
                <PatternBars pattern="long-short" />
                long · short
              </button>
            </div>
            <AacDock compact />
          </div>
        </article>
      </div>
    </section>
  );
}

function CareProof() {
  const snapshot = [
    { icon: <BookOpen size={19} />, value: "3", label: "Today's lessons", detail: "remaining today" },
    { icon: <Clock3 size={19} />, value: "24m", label: "Time on task", detail: "this session" },
    { icon: <Sparkles size={19} />, value: "2", label: "Skills mastered", detail: "new this week" },
    { icon: <CalendarDays size={19} />, value: "3:00 PM", label: "Next session", detail: "today" },
  ];
  const tabs = [
    { icon: <Home size={20} />, label: "Home", active: true },
    { icon: <BarChart3 size={20} />, label: "Progress", notice: true },
    { icon: <PlayCircle size={20} />, label: "Sessions" },
    { icon: <MessageSquareText size={20} />, label: "Messages" },
    { icon: <Settings size={20} />, label: "Settings" },
  ];

  return (
    <section className="ss-proof">
      <ProofHeader
        eyebrow="Family mobile register"
        title="One family dashboard, recomposed for every handheld canvas"
        body="The layout keeps the learner and weekly goal first, follows with a compact evidence snapshot, and preserves the same bottom navigation across phone and tablet."
      />

      <article className="ss-family-dashboard" aria-label="Responsive family dashboard proof">
        <header className="ss-family-header">
          <div className="ss-family-brand">
            <strong>AIVO</strong>
            <span>FAMILY</span>
          </div>
          <div className="ss-family-actions">
            <button type="button" aria-label="Notifications">
              <Bell size={19} />
              <i aria-hidden />
            </button>
            <button type="button" aria-label="Open Sarah's profile">
              SH
            </button>
          </div>
        </header>

        <div className="ss-family-greeting">
          <h2>Good morning, Sarah</h2>
          <p>
            Liam had a <strong>great session</strong> yesterday.
          </p>
        </div>

        <button type="button" className="ss-family-learner" aria-label="Open Liam's profile">
          <div className="ss-family-identity">
            <div className="ss-family-avatar">
              <span>L</span>
              <i>
                <Sparkles size={13} />
              </i>
            </div>
            <div>
              <strong>Liam, age 7</strong>
              <span className="ss-family-streak">
                <Star size={15} /> 7 day streak
              </span>
            </div>
          </div>
          <div className="ss-family-goal">
            <div className="ss-family-ring">
              <strong>75%</strong>
              <span>goal</span>
            </div>
            <div>
              <strong>Weekly goal on track</strong>
              <span>3 of 4 sessions completed</span>
              <div className="ss-family-days" aria-label="Sessions Monday through Sunday">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <i key={`${day}-${index}`} data-state={index < 3 ? "done" : index === 3 ? "now" : undefined}>
                    {day}
                  </i>
                ))}
              </div>
            </div>
          </div>
        </button>

        <span className="ss-family-section-label">Today's snapshot</span>
        <div className="ss-family-snapshot">
          {snapshot.map((item) => (
            <button type="button" key={item.label} aria-label={`${item.value}, ${item.label}, ${item.detail}`}>
              <span>{item.icon}</span>
              <strong>{item.value}</strong>
              <b>{item.label}</b>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>

        <button type="button" className="ss-family-insight">
          <span>
            <TrendingUp size={21} />
          </span>
          <span>
            <strong>Liam's reading fluency improved 18%</strong>
            <small>A clear signal from this week's sessions.</small>
          </span>
          <ChevronRight size={22} />
        </button>

        <nav className="ss-family-nav" aria-label="Family navigation">
          {tabs.map((tab) => (
            <button type="button" key={tab.label} aria-pressed={tab.active}>
              <span>
                {tab.icon}
                {tab.notice ? <i aria-hidden /> : null}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>
      </article>
    </section>
  );
}

const dashboardMetrics = [
  { icon: <Users size={17} />, label: "Active learners", value: "1,284", delta: "+6.2%", detail: "vs last month", tone: "positive" },
  { icon: <PlayCircle size={17} />, label: "Sessions today", value: "347", delta: "+12.4%", detail: "vs yesterday", tone: "positive" },
  { icon: <TrendingUp size={17} />, label: "Avg. engagement", value: "78%", delta: "+3.1%", detail: "vs last week", tone: "positive" },
  { icon: <Target size={17} />, label: "Goals met", value: "92%", delta: "-1.8%", detail: "vs last month", tone: "danger" },
] as const;

const dashboardLearners = [
  ["Amara Osei", "Westfield Academy", "Grade 8", "48", "94%", "Exceeding"],
  ["Luca Ferretti", "Lincoln High", "Grade 10", "42", "88%", "On track"],
  ["Priya Sharma", "Northside Prep", "Grade 9", "37", "71%", "On track"],
  ["Ethan Blake", "St. Mary's College", "Grade 11", "33", "55%", "At risk"],
  ["Sofia Reyes", "Westfield Academy", "Grade 7", "51", "97%", "Exceeding"],
] as const;

function DistrictDashboardProof() {
  return (
    <section className="ss-proof">
      <ProofHeader
        eyebrow="School district professional register"
        title="A district dashboard built around evidence and follow-through"
        body="The light shell keeps district operations approachable while preserving a dense overview, learner search, and clear next actions."
      />
      <DashboardFrame variant="district" />
    </section>
  );
}

function PlatformDashboardProof() {
  return (
    <section className="ss-proof">
      <ProofHeader
        eyebrow="AIVO Platform professional register"
        title="A high-density platform view without losing the Steady Signal grammar"
        body="The dark operations rail creates stronger separation for platform teams while the workspace stays evidence-led and readable."
      />
      <DashboardFrame variant="platform" />
    </section>
  );
}

function DashboardFrame({ variant }: { variant: "district" | "platform" }) {
  return (
    <article className="ss-dashboard" data-dashboard-variant={variant}>
      <DashboardSidebar variant={variant} />
      <div className="ss-dashboard-workspace">
        <header className="ss-dashboard-header">
          <div>
            <h3>Dashboard</h3>
            <span>{variant === "district" ? "Westbrook Unified School District" : "Monday, 14 July 2025"}</span>
          </div>
          <div className="ss-dashboard-header-actions">
            <button type="button"><CalendarDays size={15} /> Last 30 days</button>
            <button type="button"><Download size={15} /> Export</button>
            <button type="button" className="ss-dashboard-add"><Plus size={16} /> Add learner</button>
          </div>
        </header>
        <div className="ss-dashboard-content">
          <div className="ss-dashboard-metrics">
            {dashboardMetrics.map((metric) => (
              <article key={metric.label}>
                <div>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small data-tone={metric.tone}>{metric.delta} <i>{metric.detail}</i></small>
                </div>
                <b>{metric.icon}</b>
              </article>
            ))}
          </div>
          <div className="ss-dashboard-analytics">
            <DashboardTrend />
            <DashboardSkills />
          </div>
          <DashboardLearnerTable />
        </div>
      </div>
    </article>
  );
}

function DashboardSidebar({ variant }: { variant: "district" | "platform" }) {
  const sections = [
    {
      label: variant === "district" ? "Main" : "Overview",
      items: [
        [<LayoutDashboard size={16} />, "Dashboard"],
        [<Users size={16} />, "Learners"],
        [<School size={16} />, "Schools"],
        [<LibraryBig size={16} />, variant === "district" ? "Sessions" : "Curriculum"],
      ],
    },
    {
      label: variant === "district" ? "System" : "Analytics",
      items: [
        [<TrendingUp size={16} />, variant === "district" ? "Reports" : "Performance"],
        [<Target size={16} />, "Goals"],
        [<Settings size={16} />, "Settings"],
      ],
    },
  ] as const;
  return (
    <aside className="ss-dashboard-sidebar">
      <div className="ss-dashboard-logo">
        <strong>AIVO</strong>
        <span>{variant === "district" ? "Admin" : "Platform"}</span>
        <small>{variant === "district" ? "School district portal" : "Learning intelligence"}</small>
      </div>
      <nav aria-label={`${variant} dashboard navigation`}>
        {sections.map((section, sectionIndex) => (
          <div key={section.label}>
            <span>{section.label}</span>
            {section.items.map(([icon, label], index) => (
              <button key={label} type="button" aria-pressed={sectionIndex === 0 && index === 0}>
                {icon}{label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="ss-dashboard-user">
        <span>{variant === "district" ? "JH" : "RS"}</span>
        <div>
          <strong>{variant === "district" ? "Jamie Holloway" : "Rachel S."}</strong>
          <small>{variant === "district" ? "District Admin" : "Super Admin"}</small>
        </div>
      </div>
    </aside>
  );
}

function DashboardTrend() {
  const points = [[10, 78], [22, 68], [34, 54], [46, 63], [58, 45], [70, 35], [82, 40], [94, 22]];
  return (
    <article className="ss-dashboard-chart">
      <header>
        <div><strong>Weekly sessions</strong><span>Sessions per week · past 8 weeks</span></div>
        <div><span><i /> This period</span><span><i /> Previous period</span></div>
      </header>
      <div className="ss-dashboard-chart-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Weekly sessions trend">
          <path className="ss-dashboard-area" d={`M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} L 94 92 L 10 92 Z`} />
          <path className="ss-dashboard-line" d={`M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}`} />
          <path className="ss-dashboard-previous" d="M 10 84 L 94 40" />
          {points.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" />)}
        </svg>
        <div className="ss-dashboard-chart-labels">
          {["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((week) => <span key={week}>{week}</span>)}
        </div>
      </div>
    </article>
  );
}

function DashboardSkills() {
  const skills = [["Reading comprehension", 92], ["Phonics & decoding", 82], ["Number sense", 72], ["Writing mechanics", 62], ["Critical thinking", 48]] as const;
  return (
    <article className="ss-dashboard-skills">
      <header><strong>Top skills mastered</strong><span>This week · by learner count</span></header>
      <div>
        {skills.map(([name, value]) => (
          <div key={name}>
            <span>{name}</span><i><b style={{ width: `${value}%` }} /></i><strong>{Math.round(value * 3.12)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardLearnerTable() {
  return (
    <article className="ss-dashboard-table">
      <header>
        <div><strong>Learner overview</strong><span>1,284 learners across 7 schools</span></div>
        <div>
          <label><Search size={15} /><input placeholder="Search learners..." /></label>
          <button type="button"><Filter size={15} /> Filter</button>
        </div>
      </header>
      <div>
        <table>
          <thead><tr><th>Name</th><th>School</th><th>Grade</th><th>Sessions</th><th>Goal progress</th><th>Status</th></tr></thead>
          <tbody>
            {dashboardLearners.map((row, index) => (
              <tr key={row[0]}>
                <td><span>{row[0].split(" ").map((word) => word[0]).join("")}</span><strong>{row[0]}</strong></td>
                <td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td>
                <td><i><b style={{ width: row[4] }} /></i>{row[4]}</td>
                <td><span className={row[5] === "At risk" ? "ss-dashboard-status ss-dashboard-status-warm" : index === 0 || index === 4 ? "ss-dashboard-status ss-dashboard-status-strong" : "ss-dashboard-status"}>{row[5]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

type MarketingPage =
  | "home"
  | "parents"
  | "teachers"
  | "schools"
  | "features"
  | "pricing"
  | "security"
  | "case-studies"
  | "demo"
  | "start";

const marketingPages: Array<{ id: MarketingPage; label: string }> = [
  { id: "home", label: "Homepage" },
  { id: "parents", label: "Parents" },
  { id: "teachers", label: "Teachers" },
  { id: "schools", label: "Schools" },
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "security", label: "Security" },
  { id: "case-studies", label: "Case studies" },
  { id: "demo", label: "Book demo" },
  { id: "start", label: "Start trial" },
];

const marketingCopy: Record<
  Exclude<MarketingPage, "pricing" | "security" | "case-studies" | "demo" | "start">,
  { eyebrow: string; title: string; body: string; cta: string; points: string[] }
> = {
  home: {
    eyebrow: "Adaptive learning for real human variation",
    title: "Where every mind can find a steady signal.",
    body: "AIVO helps learners move forward with clear next steps and gives families, educators, and schools evidence they can trust.",
    cta: "Start free trial",
    points: ["Personalized next steps", "Progress people can understand", "Accessibility built into every flow"],
  },
  parents: {
    eyebrow: "For families",
    title: "Know how your child is learning, and what helps next.",
    body: "See progress, weekly goals, and meaningful learning signals without turning home into another classroom.",
    cta: "Explore family support",
    points: ["Track progress in real time", "Celebrate growth without pressure", "Coordinate with the care team"],
  },
  teachers: {
    eyebrow: "For educators",
    title: "Personalized support for every learner, without adding more work.",
    body: "Differentiate instruction, monitor growth, and act on clear evidence from one calm workspace.",
    cta: "See teacher workspace",
    points: ["Actionable activity suggestions", "Learning gap visibility", "IEP goal alignment"],
  },
  schools: {
    eyebrow: "For schools and districts",
    title: "Support neurodiverse learners at scale with measurable progress.",
    body: "Give district teams a shared view of outcomes, implementation health, and the learners who need follow-through.",
    cta: "Request district demo",
    points: ["District-ready dashboards", "IEP-aligned evidence", "Secure role-based access"],
  },
  features: {
    eyebrow: "The AIVO platform",
    title: "Everything needed to support learning, growth, and confidence.",
    body: "One coherent system for learners, families, educators, clinicians, and administrators.",
    cta: "Explore all features",
    points: ["Virtual Brain AI", "Personalized learning", "Progress insights"],
  },
};

function MarketingProof() {
  const [page, setPage] = React.useState<MarketingPage>("home");
  return (
    <section className="ss-proof">
      <ProofHeader
        eyebrow="Marketing page family"
        title="One narrative system for every audience and conversion step"
        body="The reference keeps a quiet shell, strong audience-specific headline, visible proof, and one primary conversion action on every page."
      />
      <nav className="ss-marketing-page-tabs" aria-label="Marketing page preview">
        {marketingPages.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={page === item.id}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <article className="ss-marketing-page">
        <MarketingShell page={page} />
      </article>
    </section>
  );
}

function MarketingShell({ page }: { page: MarketingPage }) {
  return (
    <>
      <header className="ss-marketing-shell-header">
        <strong>AIVO</strong>
        <nav aria-label="Marketing primary navigation">
          <span>Product</span><span>For families</span><span>For schools</span>
        </nav>
        <div><button type="button">Log in</button><button type="button">Start free trial</button></div>
      </header>
      {page === "pricing" && <MarketingPricing />}
      {page === "security" && <MarketingSecurity />}
      {page === "case-studies" && <MarketingCaseStudy />}
      {page === "demo" && <MarketingDemo />}
      {page === "start" && <MarketingStart />}
      {!["pricing", "security", "case-studies", "demo", "start"].includes(page) && (
        <MarketingAudiencePage page={page as keyof typeof marketingCopy} />
      )}
    </>
  );
}

function MarketingAudiencePage({ page }: { page: keyof typeof marketingCopy }) {
  const copy = marketingCopy[page];
  return (
    <div className="ss-marketing-audience">
      <section className="ss-marketing-hero">
        <div>
          <span className="ss-kicker">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
          <ul>{copy.points.map((point) => <li key={point}><Check size={14} />{point}</li>)}</ul>
          <div><button type="button">{copy.cta}<ArrowRight size={16} /></button><button type="button">Watch overview</button></div>
        </div>
        <MarketingVisual page={page} />
      </section>
      {page === "home" ? <MarketingJourneys /> : <MarketingAudienceEvidence page={page} />}
      <MarketingTrustStrip />
    </div>
  );
}

function MarketingVisual({ page }: { page: keyof typeof marketingCopy }) {
  return (
    <div className="ss-marketing-page-visual" data-visual={page}>
      <SignalMark large />
      <span>{page === "parents" ? "Weekly goal" : page === "teachers" ? "Class signal" : page === "schools" ? "District outcome" : page === "features" ? "Focus score" : "Next step"}</span>
      <strong>{page === "schools" ? "92%" : page === "features" ? "72" : page === "teachers" ? "24 learners" : "On track"}</strong>
      <div><i /><i /><i /><i /></div>
    </div>
  );
}

function MarketingJourneys() {
  return (
    <section className="ss-marketing-journeys">
      <h3>Choose your journey</h3>
      <div>
        {[["For parents", "See progress and celebrate growth."], ["For teachers", "Differentiate with clear evidence."], ["For schools", "Support learners at scale."]].map(([title, body]) => (
          <article key={title}><CircleUserRound size={18} /><strong>{title}</strong><p>{body}</p><button type="button">Explore <ArrowRight size={13} /></button></article>
        ))}
      </div>
    </section>
  );
}

function MarketingAudienceEvidence({ page }: { page: Exclude<keyof typeof marketingCopy, "home"> }) {
  const labels = page === "parents" ? ["Today's lessons", "Time on task", "Skills mastered", "Next session"] : page === "teachers" ? ["All learners", "Needs attention", "On track", "IEP goals"] : page === "schools" ? ["Learners supported", "IEP goals on track", "Sessions completed", "Implementation"] : ["Virtual Brain AI", "IEP-aligned goals", "Progress insights", "Safe & secure"];
  return (
    <section className="ss-marketing-evidence">
      <div>{labels.map((label, index) => <article key={label}><span>{index + 1}</span><strong>{label}</strong><small>{index % 2 === 0 ? "Clear evidence" : "Ready for follow-through"}</small></article>)}</div>
    </section>
  );
}

function MarketingTrustStrip() {
  return (
    <footer className="ss-marketing-trust">
      <span><ShieldCheck size={15} /> FERPA & COPPA aligned</span>
      <span><Accessibility size={15} /> Neurodiverse-first</span>
      <span><Users size={15} /> Built with families and educators</span>
    </footer>
  );
}

function MarketingPricing() {
  return (
    <section className="ss-marketing-centered">
      <span className="ss-kicker">Simple pricing</span><h2>Powerful support without surprise fees.</h2><p>Start with a family plan or talk with us about district implementation.</p>
      <div className="ss-marketing-pricing">
        {[["Starter", "$14.99", "Core learning support"], ["Plus", "$24.99", "Advanced insights and collaboration"]].map(([name, price, detail]) => (
          <article key={name}><strong>{name}</strong><h3>{price}<small>/month</small></h3><p>{detail}</p><ul><li><Check size={13} />AI tutoring and practice</li><li><Check size={13} />Progress dashboard</li><li><Check size={13} />Family messaging</li></ul><button type="button">Start free trial</button></article>
        ))}
      </div>
    </section>
  );
}

function MarketingSecurity() {
  return (
    <section className="ss-marketing-centered">
      <span className="ss-kicker">Security and privacy</span><h2>Protection people can understand.</h2><p>Privacy, role-based access, and transparent controls are part of the product architecture.</p>
      <div className="ss-marketing-security">
        {["Privacy by design", "Data encryption", "Role-based access", "Transparent & accountable"].map((item) => <article key={item}><ShieldCheck size={20} /><div><strong>{item}</strong><p>Visible controls, clear ownership, and no hidden tradeoffs.</p></div></article>)}
      </div>
    </section>
  );
}

function MarketingCaseStudy() {
  return (
    <section className="ss-marketing-centered">
      <span className="ss-kicker">Real outcomes</span><h2>Evidence that matters to learners and the people around them.</h2>
      <article className="ss-marketing-case"><strong>Three-month district pilot</strong><p>150 neurodiverse learners across six schools.</p><div><Metric value="87%" label="increase in engagement" /><Metric value="40%" label="average IEP goal progress" /><Metric value="95%" label="teacher-reported time saved" /></div></article>
    </section>
  );
}

function MarketingDemo() {
  return (
    <section className="ss-marketing-form-page">
      <div><span className="ss-kicker">See AIVO in action</span><h2>Book a personalized demo for your role.</h2><ul><li><Check size={14} />Support neurodiverse learners</li><li><Check size={14} />Align with IEP goals</li><li><Check size={14} />Make progress visible</li></ul></div>
      <MarketingForm button="Book my demo" />
    </section>
  );
}

function MarketingStart() {
  return (
    <section className="ss-marketing-form-page">
      <div><span className="ss-kicker">Trial onboarding</span><h2>Let&apos;s get started.</h2><p>Create an account and tell us who the experience should support.</p><ol><li>Account</li><li>About you</li><li>Learner</li><li>Preferences</li></ol></div>
      <MarketingForm button="Create account" />
    </section>
  );
}

function MarketingForm({ button }: { button: string }) {
  return (
    <form className="ss-marketing-form" onSubmit={(event) => event.preventDefault()}>
      <label>Full name<input placeholder="Your name" /></label><label>Work email<input placeholder="you@example.com" /></label><label>Role<select defaultValue=""><option value="" disabled>Select your role</option><option>Parent</option><option>Teacher</option><option>District leader</option></select></label><button type="submit">{button}</button>
    </form>
  );
}

function FoundationsProof() {
  return (
    <section className="ss-proof">
      <ProofHeader
        eyebrow="Generated foundation contract"
        title="One grammar across registers"
        body="A directional line, an explicit focal marker, and notched regions replace the generic rounded-card kit."
      />
      <div className="ss-foundation-grid">
        <article className="ss-panel">
          <span className="ss-kicker">Semantic color</span>
          <div className="ss-swatches">
            {["canvas", "surface", "ink", "signal", "beacon", "positive", "danger"].map((name) => (
              <div key={name}>
                <span style={{ background: `var(--ss-${name})` }} />
                <code>{name}</code>
              </div>
            ))}
          </div>
        </article>
        <article className="ss-panel">
          <span className="ss-kicker">Interaction anatomy</span>
          <div className="ss-anatomy">
            <span className="ss-anatomy-line" />
            <div>
              <strong>Signal rail</strong>
              <p>Shows sequence and state without decorative noise.</p>
            </div>
            <span className="ss-anatomy-marker">2</span>
            <div>
              <strong>Focal marker</strong>
              <p>Makes the active step explicit in color, text, and position.</p>
            </div>
            <span className="ss-anatomy-notch" />
            <div>
              <strong>Notched region</strong>
              <p>Creates recognition without excessive rounding.</p>
            </div>
          </div>
        </article>
        <article className="ss-panel">
          <span className="ss-kicker">Capability contract</span>
          <ul className="ss-check-list">
            {[
              "Motion scales cleanly to zero",
              "AAC remains reachable",
              "Dark and high contrast are native",
              "RTL-safe directional layout",
              "Targets adapt by age",
              "Phone loses no function",
            ].map((item) => (
              <li key={item}>
                <Check size={17} /> {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function ProofHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <header className="ss-proof-header">
      <span className="ss-kicker">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </header>
  );
}

function AxisControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; icon?: React.ReactNode }>;
}) {
  const id = React.useId();
  return (
    <fieldset className="ss-axis">
      <legend id={id}>{label}</legend>
      <div role="radiogroup" aria-labelledby={id}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SignalMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "ss-mark ss-mark-large" : "ss-mark"} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function SignalSteps() {
  return (
    <ol className="ss-signal-steps">
      <li data-state="done">
        <Check size={14} /> Listen
      </li>
      <li data-state="active">
        <MousePointer2 size={14} /> Choose
      </li>
      <li>
        <ChevronRight size={14} /> Check
      </li>
    </ol>
  );
}

function AacDock({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={compact ? "ss-aac ss-aac-compact" : "ss-aac"} aria-label="Communication dock">
      <span className="ss-kicker">My words</span>
      <div>
        <button type="button">
          <Hand size={compact ? 18 : 22} />
          <span>Help</span>
        </button>
        <button type="button">
          <Volume2 size={compact ? 18 : 22} />
          <span>Again</span>
        </button>
        <button type="button">
          <MessageSquareText size={compact ? 18 : 22} />
          <span>I know</span>
        </button>
      </div>
    </aside>
  );
}

function PatternBars({ pattern }: { pattern: "short-long" | "long-short" }) {
  return (
    <span className="ss-pattern" aria-hidden>
      <i className={pattern === "short-long" ? "short" : "long"} />
      <i className={pattern === "short-long" ? "long" : "short"} />
    </span>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
