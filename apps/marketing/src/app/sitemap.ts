import type { MetadataRoute } from "next";
import { TUTORS } from "@/components/marketing/data";
import { AUDIENCES, LEVELS, SUBJECTS, COMPARISONS } from "@/lib/landing-content";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.8, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
    { path: "/demo", priority: 0.9, changeFrequency: "monthly" },
    { path: "/waitlist", priority: 0.8, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/careers", priority: 0.6, changeFrequency: "weekly" },
    { path: "/press-kit", priority: 0.5, changeFrequency: "monthly" },
    { path: "/tutors", priority: 0.9, changeFrequency: "monthly" },
    { path: "/levels", priority: 0.9, changeFrequency: "monthly" },
    { path: "/subjects", priority: 0.9, changeFrequency: "monthly" },
    { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms-of-service", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookie-policy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/coppa-compliance", priority: 0.3, changeFrequency: "yearly" },
    { path: "/ferpa-compliance", priority: 0.3, changeFrequency: "yearly" },
    { path: "/accessibility", priority: 0.3, changeFrequency: "yearly" },
    { path: "/security", priority: 0.6, changeFrequency: "monthly" },
    { path: "/trust", priority: 0.6, changeFrequency: "monthly" },
    { path: "/subprocessors", priority: 0.4, changeFrequency: "monthly" },
    { path: "/features/todays-mission", priority: 0.85, changeFrequency: "monthly" },
    { path: "/features/lessonrun", priority: 0.85, changeFrequency: "monthly" },
    { path: "/features/homework-helper", priority: 0.85, changeFrequency: "monthly" },
    { path: "/resources", priority: 0.7, changeFrequency: "weekly" },
    { path: "/guides", priority: 0.7, changeFrequency: "weekly" },
    { path: "/blog/what-is-personalized-learning", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/parent-progress-without-jargon", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/what-is-a-baseline-assessment", priority: 0.6, changeFrequency: "monthly" },
    { path: "/blog/read-aloud-and-scaffolds", priority: 0.6, changeFrequency: "monthly" },
    {
      path: "/guides/school-buying-checklist-ai-learning",
      priority: 0.6,
      changeFrequency: "monthly",
    },
    { path: "/guides/how-aivo-thinks-about-privacy", priority: 0.6, changeFrequency: "monthly" },
  ];

  const audiencePages = AUDIENCES.map((a) => ({
    path: `/${a.slug}`,
    priority: 0.85,
    changeFrequency: "monthly" as const,
  }));

  const tutorPages = TUTORS.map((t) => ({
    path: `/tutors/${t.name.toLowerCase()}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }));

  const levelPages = LEVELS.map((l) => ({
    path: `/levels/${l.slug}`,
    priority: 0.75,
    changeFrequency: "monthly" as const,
  }));

  const subjectPages = SUBJECTS.map((s) => ({
    path: `/subjects/${s.slug}`,
    priority: 0.8,
    changeFrequency: "monthly" as const,
  }));

  const comparePages = COMPARISONS.map((c) => ({
    path: `/compare/${c.slug}`,
    priority: 0.75,
    changeFrequency: "monthly" as const,
  }));

  return [
    ...staticPages,
    ...audiencePages,
    ...tutorPages,
    ...levelPages,
    ...subjectPages,
    ...comparePages,
  ].map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
