#!/usr/bin/env node
/**
 * seed-M_legal_dyn-i18n — seeds marketing i18n keys for batch M_legal_dyn.
 *
 * Covers 13 files in two buckets:
 *
 * LEGAL bucket (same English value for all 10 locales — pending professional translation):
 *   accessibility/page.tsx         → marketing.page_accessibility        (title)
 *   cookie-policy/page.tsx         → marketing.page_cookie_policy        (title)
 *   coppa-compliance/page.tsx      → marketing.page_coppa_compliance     (title)
 *   ferpa-compliance/page.tsx      → marketing.page_ferpa_compliance     (title)
 *   privacy-policy/page.tsx        → marketing.page_privacy_policy       (title)
 *   security/page.tsx              → marketing.page_security             (title)
 *   subprocessors/page.tsx         → marketing.page_subprocessors        (15 keys)
 *   terms-of-service/page.tsx      → marketing.page_terms_of_service     (title)
 *   trust/page.tsx                 → marketing.page_trust                (title)
 *
 * DYNAMIC bucket — CHROME ONLY (headings/labels/CTAs translated; CMS body left hardcoded):
 *   compare/[slug]/page.tsx        → marketing.page_compare_detail       (5 keys)
 *   levels/[level]/page.tsx        → marketing.page_levels_detail        (5 keys)
 *   subjects/[slug]/page.tsx       → marketing.page_subjects_detail      (3 keys)
 *   tutors/[slug]/page.tsx         → marketing.page_tutors_detail        (3 keys)
 *
 * Re-runnable (deep-merge, never clobbers unrelated keys).
 * Run with: node scripts/seed-M_legal_dyn-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/marketing/src/i18n/messages");

// ---------------------------------------------------------------------------
// Deep-merge helper — leaf strings overwrite; objects recurse
// ---------------------------------------------------------------------------
function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

// ---------------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------------
// Legal-bucket helpers: all 10 locales get the same English string.
const EN_LEGAL = {
  // ── page_accessibility ──────────────────────────────────────────────────
  page_accessibility: {
    title: "AIVO Accessibility Statement",
  },
  // ── page_cookie_policy ──────────────────────────────────────────────────
  page_cookie_policy: {
    title: "Cookie Policy",
  },
  // ── page_coppa_compliance ───────────────────────────────────────────────
  page_coppa_compliance: {
    title: "COPPA Compliance Statement",
  },
  // ── page_ferpa_compliance ───────────────────────────────────────────────
  page_ferpa_compliance: {
    title: "FERPA Compliance Statement",
  },
  // ── page_privacy_policy ─────────────────────────────────────────────────
  page_privacy_policy: {
    title: "AIVO Privacy Policy",
  },
  // ── page_security ───────────────────────────────────────────────────────
  page_security: {
    title: "How we protect your data.",
  },
  // ── page_subprocessors ──────────────────────────────────────────────────
  page_subprocessors: {
    get_started: "Get Started",
    badge: "Subprocessors",
    heading: "AIVO subprocessors",
    current_subprocessors: "Current subprocessors",
    col_subprocessor: "Subprocessor",
    col_purpose: "Purpose",
    col_data_category: "Data category",
    col_region: "Region",
    col_status: "Status",
    how_we_use_heading: "How we use this list",
    reporting_heading: "Reporting subprocessor changes",
    questions_heading: "Questions?",
    footer_privacy: "Privacy",
    footer_security: "Security",
    footer_accessibility: "Accessibility",
  },
  // ── page_terms_of_service ───────────────────────────────────────────────
  page_terms_of_service: {
    title: "AIVO Terms of Service",
  },
  // ── page_trust ──────────────────────────────────────────────────────────
  page_trust: {
    title: "What we promise — and how to check.",
  },
};

const DATA = {
  // =========================================================================
  // en  — canonical English
  // =========================================================================
  en: {
    marketing: {
      ...EN_LEGAL,
      // ── page_compare_detail ─────────────────────────────────────────────
      page_compare_detail: {
        aivo_best_for: "AIVO is best for",
        side_by_side: "Side-by-side comparison",
        col_feature: "Feature",
        honest_note: "An honest note from us",
        other_comparisons: "Other comparisons",
      },
      // ── page_levels_detail ──────────────────────────────────────────────
      page_levels_detail: {
        who_its_for: "Who it's for",
        whats_included: "What's included",
        builtin_accommodations: "Built-in accommodations",
        sample_activities: "Sample activities",
        other_levels: "Other levels",
      },
      // ── page_subjects_detail ────────────────────────────────────────────
      page_subjects_detail: {
        key_features: "Key features",
        topics_covered: "Topics covered",
        other_subjects: "Other subjects",
      },
      // ── page_tutors_detail ──────────────────────────────────────────────
      page_tutors_detail: {
        built_for_every_learner: "Built for every learner",
        other_tutors: "Other AIVO tutors",
        see_all_tutors: "See all 14 tutors →",
      },
    },
  },

  // =========================================================================
  // es — Spanish
  // =========================================================================
  es: {
    marketing: {
      ...EN_LEGAL, // legal keys: same English for all locales
      page_compare_detail: {
        aivo_best_for: "AIVO es mejor para",
        side_by_side: "Comparación lado a lado",
        col_feature: "Característica",
        honest_note: "Una nota honesta de nuestra parte",
        other_comparisons: "Otras comparaciones",
      },
      page_levels_detail: {
        who_its_for: "Para quién es",
        whats_included: "Qué incluye",
        builtin_accommodations: "Adaptaciones integradas",
        sample_activities: "Actividades de ejemplo",
        other_levels: "Otros niveles",
      },
      page_subjects_detail: {
        key_features: "Características clave",
        topics_covered: "Temas cubiertos",
        other_subjects: "Otras materias",
      },
      page_tutors_detail: {
        built_for_every_learner: "Diseñado para cada estudiante",
        other_tutors: "Otros tutores de AIVO",
        see_all_tutors: "Ver los 14 tutores →",
      },
    },
  },

  // =========================================================================
  // fr — French
  // =========================================================================
  fr: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO est idéal pour",
        side_by_side: "Comparaison côte à côte",
        col_feature: "Fonctionnalité",
        honest_note: "Une note honnête de notre part",
        other_comparisons: "Autres comparaisons",
      },
      page_levels_detail: {
        who_its_for: "Pour qui",
        whats_included: "Ce qui est inclus",
        builtin_accommodations: "Adaptations intégrées",
        sample_activities: "Activités exemples",
        other_levels: "Autres niveaux",
      },
      page_subjects_detail: {
        key_features: "Fonctionnalités clés",
        topics_covered: "Sujets couverts",
        other_subjects: "Autres matières",
      },
      page_tutors_detail: {
        built_for_every_learner: "Conçu pour chaque apprenant",
        other_tutors: "Autres tuteurs AIVO",
        see_all_tutors: "Voir les 14 tuteurs →",
      },
    },
  },

  // =========================================================================
  // de — German
  // =========================================================================
  de: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO ist am besten für",
        side_by_side: "Direkter Vergleich",
        col_feature: "Funktion",
        honest_note: "Eine ehrliche Anmerkung von uns",
        other_comparisons: "Weitere Vergleiche",
      },
      page_levels_detail: {
        who_its_for: "Für wen ist es geeignet",
        whats_included: "Was enthalten ist",
        builtin_accommodations: "Integrierte Anpassungen",
        sample_activities: "Beispielaktivitäten",
        other_levels: "Andere Stufen",
      },
      page_subjects_detail: {
        key_features: "Hauptfunktionen",
        topics_covered: "Behandelte Themen",
        other_subjects: "Andere Fächer",
      },
      page_tutors_detail: {
        built_for_every_learner: "Für jeden Lernenden entwickelt",
        other_tutors: "Weitere AIVO-Tutoren",
        see_all_tutors: "Alle 14 Tutoren ansehen →",
      },
    },
  },

  // =========================================================================
  // pt — Portuguese
  // =========================================================================
  pt: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO é melhor para",
        side_by_side: "Comparação lado a lado",
        col_feature: "Recurso",
        honest_note: "Uma nota honesta da nossa parte",
        other_comparisons: "Outras comparações",
      },
      page_levels_detail: {
        who_its_for: "Para quem é",
        whats_included: "O que está incluído",
        builtin_accommodations: "Adaptações integradas",
        sample_activities: "Atividades de exemplo",
        other_levels: "Outros níveis",
      },
      page_subjects_detail: {
        key_features: "Recursos principais",
        topics_covered: "Tópicos abordados",
        other_subjects: "Outras disciplinas",
      },
      page_tutors_detail: {
        built_for_every_learner: "Criado para cada estudante",
        other_tutors: "Outros tutores AIVO",
        see_all_tutors: "Ver todos os 14 tutores →",
      },
    },
  },

  // =========================================================================
  // zh — Chinese (Simplified)
  // =========================================================================
  zh: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO 最适合",
        side_by_side: "并排比较",
        col_feature: "功能",
        honest_note: "来自我们的诚实说明",
        other_comparisons: "其他比较",
      },
      page_levels_detail: {
        who_its_for: "适合人群",
        whats_included: "包含内容",
        builtin_accommodations: "内置适应功能",
        sample_activities: "示例活动",
        other_levels: "其他级别",
      },
      page_subjects_detail: {
        key_features: "主要功能",
        topics_covered: "涵盖主题",
        other_subjects: "其他科目",
      },
      page_tutors_detail: {
        built_for_every_learner: "为每位学习者而建",
        other_tutors: "其他 AIVO 辅导员",
        see_all_tutors: "查看全部 14 位辅导员 →",
      },
    },
  },

  // =========================================================================
  // ja — Japanese
  // =========================================================================
  ja: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO が最適なのは",
        side_by_side: "並べて比較",
        col_feature: "機能",
        honest_note: "私たちからの正直なコメント",
        other_comparisons: "他の比較",
      },
      page_levels_detail: {
        who_its_for: "対象ユーザー",
        whats_included: "含まれる内容",
        builtin_accommodations: "組み込みの配慮機能",
        sample_activities: "サンプル活動",
        other_levels: "他のレベル",
      },
      page_subjects_detail: {
        key_features: "主な機能",
        topics_covered: "対象トピック",
        other_subjects: "他の教科",
      },
      page_tutors_detail: {
        built_for_every_learner: "すべての学習者のために",
        other_tutors: "他の AIVO チューター",
        see_all_tutors: "全 14 人のチューターを見る →",
      },
    },
  },

  // =========================================================================
  // ko — Korean
  // =========================================================================
  ko: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO가 가장 적합한 경우",
        side_by_side: "나란히 비교",
        col_feature: "기능",
        honest_note: "우리의 솔직한 한마디",
        other_comparisons: "다른 비교",
      },
      page_levels_detail: {
        who_its_for: "대상 학습자",
        whats_included: "포함된 내용",
        builtin_accommodations: "기본 제공 지원 기능",
        sample_activities: "샘플 활동",
        other_levels: "다른 레벨",
      },
      page_subjects_detail: {
        key_features: "주요 기능",
        topics_covered: "다루는 주제",
        other_subjects: "다른 과목",
      },
      page_tutors_detail: {
        built_for_every_learner: "모든 학습자를 위해 설계됨",
        other_tutors: "다른 AIVO 튜터",
        see_all_tutors: "14명의 튜터 모두 보기 →",
      },
    },
  },

  // =========================================================================
  // ar — Arabic
  // =========================================================================
  ar: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO الأنسب لـ",
        side_by_side: "مقارنة جنبًا إلى جنب",
        col_feature: "الميزة",
        honest_note: "ملاحظة صادقة منّا",
        other_comparisons: "مقارنات أخرى",
      },
      page_levels_detail: {
        who_its_for: "لمن هو مخصص",
        whats_included: "ما يتضمنه",
        builtin_accommodations: "التسهيلات المدمجة",
        sample_activities: "أنشطة نموذجية",
        other_levels: "مستويات أخرى",
      },
      page_subjects_detail: {
        key_features: "الميزات الرئيسية",
        topics_covered: "المواضيع المغطاة",
        other_subjects: "مواد أخرى",
      },
      page_tutors_detail: {
        built_for_every_learner: "مصمم لكل متعلم",
        other_tutors: "مدرسو AIVO الآخرون",
        see_all_tutors: "عرض جميع الـ 14 مدرسًا →",
      },
    },
  },

  // =========================================================================
  // hi — Hindi
  // =========================================================================
  hi: {
    marketing: {
      ...EN_LEGAL,
      page_compare_detail: {
        aivo_best_for: "AIVO सबसे उपयुक्त है",
        side_by_side: "साथ-साथ तुलना",
        col_feature: "सुविधा",
        honest_note: "हमारी ओर से एक ईमानदार टिप्पणी",
        other_comparisons: "अन्य तुलनाएं",
      },
      page_levels_detail: {
        who_its_for: "यह किसके लिए है",
        whats_included: "क्या शामिल है",
        builtin_accommodations: "अंतर्निर्मित सुविधाएं",
        sample_activities: "नमूना गतिविधियां",
        other_levels: "अन्य स्तर",
      },
      page_subjects_detail: {
        key_features: "मुख्य विशेषताएं",
        topics_covered: "शामिल विषय",
        other_subjects: "अन्य विषय",
      },
      page_tutors_detail: {
        built_for_every_learner: "हर शिक्षार्थी के लिए बनाया गया",
        other_tutors: "अन्य AIVO ट्यूटर",
        see_all_tutors: "सभी 14 ट्यूटर देखें →",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------
let written = 0;
for (const [locale, roots] of Object.entries(DATA)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  deepMerge(json, roots);
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(`seed-M_legal_dyn-i18n: merged marketing page_* keys → messages/${locale}.json`);
}
console.log(`\nseed-M_legal_dyn-i18n: done — ${written} locale catalogs updated.`);
