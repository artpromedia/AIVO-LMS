"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Search, ChevronDown } from "lucide-react";
import { StatIconWell } from "@/components/discovery/_vi";

const FAQ_ITEMS = [
  {
    q: "How does the brain profile work?",
    a: "AIVO builds a unique AI brain profile for each child based on their assessment results, learning patterns, and parent-provided information. This profile helps our AI tutors adapt their teaching style to your child's specific needs.",
  },
  {
    q: "What is a functioning level?",
    a: "A functioning level describes how your child communicates and processes information. Levels range from Standard to Pre-Symbolic. This helps AIVO choose the right approach — for example, more visual supports for children who benefit from picture-based learning.",
  },
  {
    q: "How do I prepare for my IEP meeting with AIVO data?",
    a: "Go to your child's IEP Goals page and download the Progress Report. It includes mastery data, session history, and accommodation details that you can share with your school team.",
  },
  {
    q: "Can my child's teacher see their data?",
    a: "Only if you invite them to your child's Learning Team. You control who has access. Go to your child's Team page to manage access.",
  },
  {
    q: "How do I add another child?",
    a: "From the home dashboard, click '+ Add a Child' and follow the guided setup. Each child gets their own personalized profile.",
  },
  {
    q: "What does COPPA consent mean?",
    a: "COPPA (Children's Online Privacy Protection Act) requires us to get your consent before collecting information about your child. We take your child's privacy seriously and never share data without your permission.",
  },
  {
    q: "Is my child's data safe?",
    a: "Yes. We use industry-standard encryption and security practices. You can export or delete your child's data at any time from their settings page.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Go to Billing in the main menu. You can manage your subscription, change plans, or cancel from there.",
  },
];

export default function HelpPage() {
  const t = useTranslations("parent");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery
    ? FAQ_ITEMS.filter(item =>
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase()))
    : FAQ_ITEMS;

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
      <h1 className="text-2xl font-heading font-bold vi-text mb-2">Help Center</h1>
      <p className="vi-text-muted mb-6">Find answers to common questions about AIVO.</p>

      <div className="mb-6 relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[hsl(var(--visual-text-muted))]" aria-hidden="true" />
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search for help..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none text-sm" />
      </div>

      <div className="space-y-3 mb-8">
        {filtered.map((item, i) => (
          <div key={i} className="vi-card overflow-hidden">
            <button onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full text-left px-5 py-4 flex items-center justify-between gap-3" style={{ minHeight: 48 }}>
              <span className="text-sm font-semibold text-slate-800">{item.q}</span>
              <ChevronDown size={16} className={`text-[hsl(var(--visual-text-muted))] transition-transform ${openIndex === i ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {openIndex === i && (
              <div className="px-5 pb-4 text-sm vi-text-muted leading-relaxed border-t vi-border pt-3">
                {item.a}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 vi-text-muted">
            <p className="font-semibold">No results found.</p>
            <p className="text-sm mt-1">Try different keywords or contact support below.</p>
          </div>
        )}
      </div>

      <div className="vi-card p-6 bg-[hsl(var(--visual-primary)/0.06)] border-[hsl(var(--visual-primary)/0.3)]">
        <div className="flex items-center gap-3 mb-2">
          <StatIconWell color="primary">
            <Mail size={20} aria-hidden="true" />
          </StatIconWell>
          <h2 className="text-lg font-heading font-bold vi-text">Need more help?</h2>
        </div>
        <p className="text-sm vi-text-muted mb-4">Our support team is here for you. We typically respond within 24 hours.</p>
        <a href="mailto:support@aivo.learning" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[hsl(var(--visual-primary))] text-white text-sm font-bold hover:bg-[hsl(var(--visual-primary)/0.9)] transition" style={{ minHeight: 44 }}>
          <Mail size={16} aria-hidden="true" /> Contact Support
        </a>
      </div>
    </div>
  );
}
