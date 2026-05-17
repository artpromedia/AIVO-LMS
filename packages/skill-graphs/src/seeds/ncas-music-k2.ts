import type { SkillGraph } from "../types.js";

/**
 * National Core Arts Standards — Music, Grades K–2 starter slice for
 * Cadence.
 * Source: National Coalition for Core Arts Standards (NCAS), 2014.
 *
 * The four artistic processes (Create, Perform, Respond, Connect) are
 * each represented as one entry-level skill at the K–2 band.
 */
export const ncasMusicK2: SkillGraph = {
  id: "ncas-music-k2",
  title: "Music & Rhythm — Grades K–2 (NCAS-aligned)",
  version: "1.0.0",
  source: "National Core Arts Standards — Music, Grades K–2 (NCAS 2014)",
  framework: "NCAS",
  subject: "music",
  gradeBand: "K",
  skills: [
    {
      id: "ncas.music.k2.create.idea",
      title: "Make up a short rhythm or melody",
      description: "I can make up a short pattern of claps or notes.",
      subject: "music",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Cr1.1.K" }],
      prerequisites: [],
    },
    {
      id: "ncas.music.k2.perform.steady_beat",
      title: "Keep a steady beat",
      description: "I can clap, tap, or play along with a steady beat.",
      subject: "music",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Pr4.2.K" }],
      prerequisites: [],
    },
    {
      id: "ncas.music.k2.perform.echo",
      title: "Echo back a short pattern",
      description: "I can hear a short rhythm and echo it back.",
      subject: "music",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Pr4.3.K" }],
      prerequisites: ["ncas.music.k2.perform.steady_beat"],
    },
    {
      id: "ncas.music.k2.respond.fast_slow",
      title: "Tell when music is fast, slow, loud, or soft",
      description: "I can listen and say if music is fast or slow, loud or soft.",
      subject: "music",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Re7.2.K" }],
      prerequisites: [],
    },
    {
      id: "ncas.music.k2.connect.cultures",
      title: "Connect music to people and cultures",
      description: "I can share a song from my family or another culture.",
      subject: "music",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Cn11.0.K" }],
      prerequisites: ["ncas.music.k2.respond.fast_slow"],
    },
  ],
};
