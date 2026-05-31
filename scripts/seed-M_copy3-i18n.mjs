#!/usr/bin/env node
/**
 * seed-M_copy3-i18n — seeds marketing i18n namespaces for batch M_copy3.
 *
 * Pages covered (all bucket: copy — real professional translations for all 10 locales):
 *   about/page.tsx                 -> marketing.page_about
 *   for-parents/page.tsx           -> marketing.page_for_parents
 *   demo/page.tsx                  -> marketing.page_demo
 *   features/lessonrun/page.tsx    -> marketing.page_features_lessonrun
 *   careers/page.tsx               -> marketing.page_careers
 *   pricing/page.tsx               -> marketing.page_pricing
 *   features/page.tsx              -> marketing.page_features
 *   thank-you/page.tsx             -> marketing.page_thank_you
 *   levels/page.tsx                -> marketing.page_levels
 *
 * Re-runnable (deep-merge — leaf strings overwrite, nested objects merge).
 * Run with: node scripts/seed-M_copy3-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/marketing/src/i18n/messages");

function deepMerge(t, s) {
  for (const [k, v] of Object.entries(s)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!t[k] || typeof t[k] !== "object") t[k] = {};
      deepMerge(t[k], v);
    } else {
      t[k] = v;
    }
  }
  return t;
}

const DATA = {
  en: {
    marketing: {
      page_about: {
        get_started: "Get Started",
        our_mission: "Our Mission",
        no_learner_left_behind: "No Learner Left Behind",
        core_principles: "Core Principles",
        core_principles_sub: "The foundations that guide everything we build.",
        our_values: "Our Values",
        our_values_sub: "What we stand for as a company and as educators.",
        meet_our_leadership: "Meet Our Leadership",
        linkedin_profile: "LinkedIn Profile",
        join_our_mission: "Join Our Mission",
        view_open_positions: "View Open Positions",
        contact_us: "Contact Us",
        privacy: "Privacy",
        accessibility: "Accessibility",
      },
      page_for_parents: {
        iep_title: "IEP or accommodation context, handled with care",
        reading_question: "How does your child feel about reading?",
        answers_saved: "Answers are saved automatically.",
        aivo_disclaimer:
          "AIVO does not diagnose. AIVO does not replace therapists, IEP teams, or specialists.",
        take_a_breath: "Take a breath. There's no timer.",
        which_word_means: "Which word means the same as",
        need_a_break: "Need a break?",
        todays_mission: "Today's mission",
        multiplying_by_3s: "Multiplying by 3s",
        with_atlas: "With Atlas · ~15 minutes",
        start_mission: "Start mission →",
        maya_strong_week: "Maya had a strong week!",
      },
      page_demo: {
        hero_title: "See AIVO in action.",
        form_heading: "Tell us a little about your setting",
        form_subheading:
          "The more we know, the more useful the walkthrough. Required fields are marked.",
        what_happens_next: "What happens next",
        step1_label: "Step 1 · Within 1 business day",
        step2_label: "Step 2 · 30-minute walkthrough",
        step2_body:
          "We show learner, parent, and teacher views — and answer your questions live.",
        step3_label: "Step 3 · Pilot or proposal",
        step3_body:
          "If it's a fit, we scope a short pilot or send a written proposal — no pressure.",
      },
      page_features_lessonrun: {
        hero_title: "The personalized learning unit behind every AIVO lesson",
        voice_support_title: "Voice support on every step",
        break_mode_title: "A calm pause — not a rage-quit",
        count_by_3s_prompt:
          "Let's count by 3s up to 12. Start at 3. What comes next?",
        hint_counting_fingers:
          "Try counting on your fingers: 3 · 6 · ? — what number comes three more than 6?",
        need_another_hint: "Need another hint?",
        maya_strong_week: "Maya had a strong week!",
      },
      page_careers: {
        page_title: "Join the AIVO Team",
        why_work_heading: "Why Work at AIVO?",
        open_positions_heading: "Open Positions",
        apply_now: "Apply Now",
        no_role_heading: "Don't see your role?",
        send_general_application: "Send General Application",
      },
      page_pricing: {
        hero_title: "Honest pricing. No surprises.",
        for_families: "For families",
        family_disclaimer:
          "Month-to-month. Cancel any time. 30-day money-back guarantee on paid plans.",
        for_schools: "For schools and districts",
        pricing_faq_heading: "Pricing FAQ",
      },
      page_features: {
        eyebrow: "Features",
        heading: "Real learning experiences, not feature checklists.",
        learn_more: "Learn more →",
      },
      page_thank_you: {
        hero_title: "We got it — thanks.",
        while_you_wait: "While you wait",
      },
      page_levels: {
        hero_title: "Five levels. One platform. Every learner.",
      },
    },
  },

  es: {
    marketing: {
      page_about: {
        get_started: "Comenzar",
        our_mission: "Nuestra Misión",
        no_learner_left_behind: "Ningún Estudiante Se Queda Atrás",
        core_principles: "Principios Fundamentales",
        core_principles_sub: "Los cimientos que guían todo lo que construimos.",
        our_values: "Nuestros Valores",
        our_values_sub: "Lo que defendemos como empresa y como educadores.",
        meet_our_leadership: "Conoce a Nuestro Equipo Directivo",
        linkedin_profile: "Perfil de LinkedIn",
        join_our_mission: "Únete a Nuestra Misión",
        view_open_positions: "Ver Posiciones Abiertas",
        contact_us: "Contáctanos",
        privacy: "Privacidad",
        accessibility: "Accesibilidad",
      },
      page_for_parents: {
        iep_title: "Contexto de IEP o adaptaciones, gestionado con cuidado",
        reading_question: "¿Cómo se siente tu hijo/a con la lectura?",
        answers_saved: "Las respuestas se guardan automáticamente.",
        aivo_disclaimer:
          "AIVO no diagnostica. AIVO no reemplaza a terapeutas, equipos de IEP ni especialistas.",
        take_a_breath: "Respira. No hay temporizador.",
        which_word_means: "¿Qué palabra significa lo mismo que",
        need_a_break: "¿Necesitas un descanso?",
        todays_mission: "La misión de hoy",
        multiplying_by_3s: "Multiplicar por 3",
        with_atlas: "Con Atlas · ~15 minutos",
        start_mission: "Iniciar misión →",
        maya_strong_week: "¡Maya tuvo una semana excelente!",
      },
      page_demo: {
        hero_title: "Ve AIVO en acción.",
        form_heading: "Cuéntanos un poco sobre tu contexto",
        form_subheading:
          "Cuanto más sepamos, más útil será la demostración. Los campos obligatorios están marcados.",
        what_happens_next: "Qué ocurre a continuación",
        step1_label: "Paso 1 · En 1 día hábil",
        step2_label: "Paso 2 · Demostración de 30 minutos",
        step2_body:
          "Mostramos las vistas del estudiante, el padre y el docente, y respondemos tus preguntas en vivo.",
        step3_label: "Paso 3 · Piloto o propuesta",
        step3_body:
          "Si encaja, organizamos un piloto breve o enviamos una propuesta por escrito — sin presión.",
      },
      page_features_lessonrun: {
        hero_title: "La unidad de aprendizaje personalizado detrás de cada lección de AIVO",
        voice_support_title: "Soporte de voz en cada paso",
        break_mode_title: "Una pausa tranquila — no una rabieta",
        count_by_3s_prompt:
          "Contemos de 3 en 3 hasta 12. Empezamos en 3. ¿Qué viene después?",
        hint_counting_fingers:
          "Intenta contar con los dedos: 3 · 6 · ? — ¿qué número viene tres más que 6?",
        need_another_hint: "¿Necesitas otra pista?",
        maya_strong_week: "¡Maya tuvo una semana excelente!",
      },
      page_careers: {
        page_title: "Únete al Equipo AIVO",
        why_work_heading: "¿Por qué trabajar en AIVO?",
        open_positions_heading: "Posiciones Abiertas",
        apply_now: "Aplicar Ahora",
        no_role_heading: "¿No encuentras tu puesto?",
        send_general_application: "Enviar Solicitud General",
      },
      page_pricing: {
        hero_title: "Precios honestos. Sin sorpresas.",
        for_families: "Para familias",
        family_disclaimer:
          "Mes a mes. Cancela en cualquier momento. Garantía de devolución de dinero de 30 días en planes de pago.",
        for_schools: "Para escuelas y distritos",
        pricing_faq_heading: "Preguntas frecuentes sobre precios",
      },
      page_features: {
        eyebrow: "Características",
        heading: "Experiencias de aprendizaje reales, no listas de funciones.",
        learn_more: "Saber más →",
      },
      page_thank_you: {
        hero_title: "Lo recibimos — gracias.",
        while_you_wait: "Mientras esperas",
      },
      page_levels: {
        hero_title: "Cinco niveles. Una plataforma. Cada estudiante.",
      },
    },
  },

  fr: {
    marketing: {
      page_about: {
        get_started: "Commencer",
        our_mission: "Notre Mission",
        no_learner_left_behind: "Aucun Apprenant Laissé Pour Compte",
        core_principles: "Principes Fondamentaux",
        core_principles_sub: "Les fondations qui guident tout ce que nous construisons.",
        our_values: "Nos Valeurs",
        our_values_sub: "Ce que nous défendons en tant qu'entreprise et éducateurs.",
        meet_our_leadership: "Rencontrez Notre Direction",
        linkedin_profile: "Profil LinkedIn",
        join_our_mission: "Rejoignez Notre Mission",
        view_open_positions: "Voir les Postes Ouverts",
        contact_us: "Contactez-Nous",
        privacy: "Confidentialité",
        accessibility: "Accessibilité",
      },
      page_for_parents: {
        iep_title: "Contexte IEP ou d'adaptation, géré avec soin",
        reading_question: "Comment votre enfant se sent-il face à la lecture ?",
        answers_saved: "Les réponses sont enregistrées automatiquement.",
        aivo_disclaimer:
          "AIVO ne pose pas de diagnostic. AIVO ne remplace pas les thérapeutes, les équipes IEP ni les spécialistes.",
        take_a_breath: "Respirez. Il n'y a pas de minuterie.",
        which_word_means: "Quel mot signifie la même chose que",
        need_a_break: "Besoin d'une pause ?",
        todays_mission: "La mission du jour",
        multiplying_by_3s: "Multiplier par 3",
        with_atlas: "Avec Atlas · ~15 minutes",
        start_mission: "Démarrer la mission →",
        maya_strong_week: "Maya a eu une excellente semaine !",
      },
      page_demo: {
        hero_title: "Découvrez AIVO en action.",
        form_heading: "Parlez-nous un peu de votre contexte",
        form_subheading:
          "Plus nous en savons, plus la démonstration sera utile. Les champs obligatoires sont indiqués.",
        what_happens_next: "Ce qui se passe ensuite",
        step1_label: "Étape 1 · Dans 1 jour ouvrable",
        step2_label: "Étape 2 · Démonstration de 30 minutes",
        step2_body:
          "Nous montrons les vues de l'apprenant, du parent et de l'enseignant — et répondons à vos questions en direct.",
        step3_label: "Étape 3 · Pilote ou proposition",
        step3_body:
          "Si c'est une bonne adéquation, nous cadrons un pilote court ou envoyons une proposition écrite — sans pression.",
      },
      page_features_lessonrun: {
        hero_title: "L'unité d'apprentissage personnalisée derrière chaque leçon AIVO",
        voice_support_title: "Assistance vocale à chaque étape",
        break_mode_title: "Une pause sereine — pas un abandon",
        count_by_3s_prompt:
          "Comptons par 3 jusqu'à 12. On commence à 3. Qu'est-ce qui vient ensuite ?",
        hint_counting_fingers:
          "Essaie de compter sur tes doigts : 3 · 6 · ? — quel nombre vient trois de plus que 6 ?",
        need_another_hint: "Besoin d'un autre indice ?",
        maya_strong_week: "Maya a eu une excellente semaine !",
      },
      page_careers: {
        page_title: "Rejoignez l'Équipe AIVO",
        why_work_heading: "Pourquoi travailler chez AIVO ?",
        open_positions_heading: "Postes Ouverts",
        apply_now: "Postuler",
        no_role_heading: "Vous ne voyez pas votre poste ?",
        send_general_application: "Envoyer une Candidature Spontanée",
      },
      page_pricing: {
        hero_title: "Des tarifs honnêtes. Sans surprises.",
        for_families: "Pour les familles",
        family_disclaimer:
          "Mois par mois. Annulez à tout moment. Garantie de remboursement de 30 jours sur les plans payants.",
        for_schools: "Pour les écoles et les districts",
        pricing_faq_heading: "FAQ Tarification",
      },
      page_features: {
        eyebrow: "Fonctionnalités",
        heading: "De vraies expériences d'apprentissage, pas des listes de fonctionnalités.",
        learn_more: "En savoir plus →",
      },
      page_thank_you: {
        hero_title: "Nous l'avons reçu — merci.",
        while_you_wait: "En attendant",
      },
      page_levels: {
        hero_title: "Cinq niveaux. Une plateforme. Chaque apprenant.",
      },
    },
  },

  de: {
    marketing: {
      page_about: {
        get_started: "Loslegen",
        our_mission: "Unsere Mission",
        no_learner_left_behind: "Kein Lernender Bleibt Zurück",
        core_principles: "Grundprinzipien",
        core_principles_sub: "Die Grundlagen, die alles leiten, was wir entwickeln.",
        our_values: "Unsere Werte",
        our_values_sub: "Wofür wir als Unternehmen und als Pädagogen stehen.",
        meet_our_leadership: "Lernen Sie Unsere Führung Kennen",
        linkedin_profile: "LinkedIn-Profil",
        join_our_mission: "Schließen Sie Sich Unserer Mission An",
        view_open_positions: "Offene Stellen Ansehen",
        contact_us: "Kontaktiere Uns",
        privacy: "Datenschutz",
        accessibility: "Barrierefreiheit",
      },
      page_for_parents: {
        iep_title: "IEP- oder Förderkontext, sorgfältig behandelt",
        reading_question: "Wie fühlt sich Ihr Kind beim Lesen?",
        answers_saved: "Antworten werden automatisch gespeichert.",
        aivo_disclaimer:
          "AIVO stellt keine Diagnosen. AIVO ersetzt keine Therapeuten, IEP-Teams oder Spezialisten.",
        take_a_breath: "Atme durch. Es gibt keine Zeitbegrenzung.",
        which_word_means: "Welches Wort bedeutet dasselbe wie",
        need_a_break: "Brauchst du eine Pause?",
        todays_mission: "Die heutige Mission",
        multiplying_by_3s: "Mit 3 multiplizieren",
        with_atlas: "Mit Atlas · ~15 Minuten",
        start_mission: "Mission starten →",
        maya_strong_week: "Maya hatte eine starke Woche!",
      },
      page_demo: {
        hero_title: "Erleben Sie AIVO in Aktion.",
        form_heading: "Erzählen Sie uns etwas über Ihre Situation",
        form_subheading:
          "Je mehr wir wissen, desto nützlicher ist die Demo. Pflichtfelder sind markiert.",
        what_happens_next: "Was als Nächstes passiert",
        step1_label: "Schritt 1 · Innerhalb von 1 Werktag",
        step2_label: "Schritt 2 · 30-minütige Demo",
        step2_body:
          "Wir zeigen die Ansichten von Lernenden, Eltern und Lehrern — und beantworten Ihre Fragen live.",
        step3_label: "Schritt 3 · Pilot oder Angebot",
        step3_body:
          "Wenn es passt, planen wir einen kurzen Pilot oder senden ein schriftliches Angebot — ohne Druck.",
      },
      page_features_lessonrun: {
        hero_title: "Die personalisierte Lerneinheit hinter jeder AIVO-Lektion",
        voice_support_title: "Sprachunterstützung bei jedem Schritt",
        break_mode_title: "Eine ruhige Pause — kein Frust-Abbruch",
        count_by_3s_prompt:
          "Zählen wir in 3er-Schritten bis 12. Fang bei 3 an. Was kommt als Nächstes?",
        hint_counting_fingers:
          "Versuche, an deinen Fingern zu zählen: 3 · 6 · ? — welche Zahl kommt drei mehr als 6?",
        need_another_hint: "Brauchst du einen weiteren Hinweis?",
        maya_strong_week: "Maya hatte eine starke Woche!",
      },
      page_careers: {
        page_title: "Schließen Sie Sich dem AIVO-Team An",
        why_work_heading: "Warum bei AIVO arbeiten?",
        open_positions_heading: "Offene Stellen",
        apply_now: "Jetzt Bewerben",
        no_role_heading: "Keine passende Stelle gefunden?",
        send_general_application: "Initiativbewerbung Senden",
      },
      page_pricing: {
        hero_title: "Ehrliche Preise. Keine Überraschungen.",
        for_families: "Für Familien",
        family_disclaimer:
          "Monatlich kündbar. Jederzeit kündigen. 30-tägige Geld-zurück-Garantie auf bezahlte Pläne.",
        for_schools: "Für Schulen und Bezirke",
        pricing_faq_heading: "Häufige Fragen zur Preisgestaltung",
      },
      page_features: {
        eyebrow: "Funktionen",
        heading: "Echte Lernerfahrungen, keine Funktionslisten.",
        learn_more: "Mehr erfahren →",
      },
      page_thank_you: {
        hero_title: "Wir haben es erhalten — danke.",
        while_you_wait: "Während Sie warten",
      },
      page_levels: {
        hero_title: "Fünf Niveaus. Eine Plattform. Jeder Lernende.",
      },
    },
  },

  pt: {
    marketing: {
      page_about: {
        get_started: "Começar",
        our_mission: "Nossa Missão",
        no_learner_left_behind: "Nenhum Estudante Fica Para Trás",
        core_principles: "Princípios Fundamentais",
        core_principles_sub: "As bases que orientam tudo o que construímos.",
        our_values: "Nossos Valores",
        our_values_sub: "O que defendemos como empresa e como educadores.",
        meet_our_leadership: "Conheça Nossa Liderança",
        linkedin_profile: "Perfil no LinkedIn",
        join_our_mission: "Junte-se à Nossa Missão",
        view_open_positions: "Ver Vagas Abertas",
        contact_us: "Fale Conosco",
        privacy: "Privacidade",
        accessibility: "Acessibilidade",
      },
      page_for_parents: {
        iep_title: "Contexto de IEP ou adaptação, tratado com cuidado",
        reading_question: "Como seu filho se sente em relação à leitura?",
        answers_saved: "As respostas são salvas automaticamente.",
        aivo_disclaimer:
          "AIVO não faz diagnósticos. AIVO não substitui terapeutas, equipes de IEP ou especialistas.",
        take_a_breath: "Respire fundo. Não há cronômetro.",
        which_word_means: "Qual palavra tem o mesmo significado que",
        need_a_break: "Precisa de uma pausa?",
        todays_mission: "A missão de hoje",
        multiplying_by_3s: "Multiplicando por 3",
        with_atlas: "Com Atlas · ~15 minutos",
        start_mission: "Iniciar missão →",
        maya_strong_week: "Maya teve uma semana incrível!",
      },
      page_demo: {
        hero_title: "Veja o AIVO em ação.",
        form_heading: "Conte-nos um pouco sobre sua situação",
        form_subheading:
          "Quanto mais soubermos, mais útil será a demonstração. Os campos obrigatórios estão marcados.",
        what_happens_next: "O que acontece a seguir",
        step1_label: "Passo 1 · Em 1 dia útil",
        step2_label: "Passo 2 · Demonstração de 30 minutos",
        step2_body:
          "Mostramos as visões do estudante, do responsável e do professor — e respondemos suas perguntas ao vivo.",
        step3_label: "Passo 3 · Piloto ou proposta",
        step3_body:
          "Se for uma boa combinação, planejamos um piloto curto ou enviamos uma proposta por escrito — sem pressão.",
      },
      page_features_lessonrun: {
        hero_title: "A unidade de aprendizado personalizado por trás de cada lição do AIVO",
        voice_support_title: "Suporte de voz em cada etapa",
        break_mode_title: "Uma pausa tranquila — não uma desistência frustrada",
        count_by_3s_prompt:
          "Vamos contar de 3 em 3 até 12. Começamos no 3. O que vem a seguir?",
        hint_counting_fingers:
          "Tente contar nos dedos: 3 · 6 · ? — que número vem três a mais que 6?",
        need_another_hint: "Precisa de outra dica?",
        maya_strong_week: "Maya teve uma semana incrível!",
      },
      page_careers: {
        page_title: "Junte-se à Equipe AIVO",
        why_work_heading: "Por que trabalhar na AIVO?",
        open_positions_heading: "Vagas Abertas",
        apply_now: "Candidatar-se Agora",
        no_role_heading: "Não encontrou sua vaga?",
        send_general_application: "Enviar Candidatura Espontânea",
      },
      page_pricing: {
        hero_title: "Preços honestos. Sem surpresas.",
        for_families: "Para famílias",
        family_disclaimer:
          "Mês a mês. Cancele a qualquer momento. Garantia de devolução de 30 dias nos planos pagos.",
        for_schools: "Para escolas e distritos",
        pricing_faq_heading: "Perguntas Frequentes sobre Preços",
      },
      page_features: {
        eyebrow: "Recursos",
        heading: "Experiências de aprendizado reais, não listas de recursos.",
        learn_more: "Saiba mais →",
      },
      page_thank_you: {
        hero_title: "Recebemos — obrigado.",
        while_you_wait: "Enquanto você espera",
      },
      page_levels: {
        hero_title: "Cinco níveis. Uma plataforma. Cada estudante.",
      },
    },
  },

  zh: {
    marketing: {
      page_about: {
        get_started: "立即开始",
        our_mission: "我们的使命",
        no_learner_left_behind: "不让任何学习者掉队",
        core_principles: "核心原则",
        core_principles_sub: "指导我们一切工作的基础。",
        our_values: "我们的价值观",
        our_values_sub: "作为公司和教育者，我们所坚守的信念。",
        meet_our_leadership: "认识我们的领导团队",
        linkedin_profile: "LinkedIn 主页",
        join_our_mission: "加入我们的使命",
        view_open_positions: "查看开放职位",
        contact_us: "联系我们",
        privacy: "隐私政策",
        accessibility: "无障碍",
      },
      page_for_parents: {
        iep_title: "IEP 或无障碍支持信息，妥善处理",
        reading_question: "您的孩子对阅读的感受如何？",
        answers_saved: "答案已自动保存。",
        aivo_disclaimer:
          "AIVO 不做诊断。AIVO 不能替代治疗师、IEP 团队或专科医生。",
        take_a_breath: "深呼吸。没有计时器。",
        which_word_means: "哪个词与",
        need_a_break: "需要休息一下？",
        todays_mission: "今日任务",
        multiplying_by_3s: "乘以 3",
        with_atlas: "与 Atlas · 约 15 分钟",
        start_mission: "开始任务 →",
        maya_strong_week: "Maya 这周表现非常出色！",
      },
      page_demo: {
        hero_title: "亲眼见证 AIVO 的实力。",
        form_heading: "请简单介绍一下您的使用场景",
        form_subheading: "我们了解得越多，演示就越有针对性。必填字段已标注。",
        what_happens_next: "接下来会发生什么",
        step1_label: "第 1 步 · 1 个工作日内",
        step2_label: "第 2 步 · 30 分钟演示",
        step2_body: "我们展示学习者、家长和教师的视图，并现场回答您的问题。",
        step3_label: "第 3 步 · 试点或提案",
        step3_body: "如果合适，我们会安排一次短期试点或发送书面提案——没有任何压力。",
      },
      page_features_lessonrun: {
        hero_title: "每节 AIVO 课程背后的个性化学习单元",
        voice_support_title: "每个步骤均提供语音支持",
        break_mode_title: "平静的暂停——而非愤怒退出",
        count_by_3s_prompt: "让我们以 3 为单位数到 12。从 3 开始，下一个是什么？",
        hint_counting_fingers:
          "试着用手指数数：3 · 6 · ?——比 6 多三的数字是什么？",
        need_another_hint: "需要再来一个提示吗？",
        maya_strong_week: "Maya 这周表现非常出色！",
      },
      page_careers: {
        page_title: "加入 AIVO 团队",
        why_work_heading: "为什么在 AIVO 工作？",
        open_positions_heading: "开放职位",
        apply_now: "立即申请",
        no_role_heading: "没有看到适合您的职位？",
        send_general_application: "发送通用申请",
      },
      page_pricing: {
        hero_title: "诚实定价，没有隐藏费用。",
        for_families: "面向家庭",
        family_disclaimer: "按月计费，随时取消，付费计划享有 30 天退款保证。",
        for_schools: "面向学校和学区",
        pricing_faq_heading: "定价常见问题",
      },
      page_features: {
        eyebrow: "功能特色",
        heading: "真实的学习体验，而非功能清单。",
        learn_more: "了解更多 →",
      },
      page_thank_you: {
        hero_title: "已收到——感谢您！",
        while_you_wait: "在等待期间",
      },
      page_levels: {
        hero_title: "五个级别。一个平台。每位学习者。",
      },
    },
  },

  ja: {
    marketing: {
      page_about: {
        get_started: "始める",
        our_mission: "私たちのミッション",
        no_learner_left_behind: "誰一人置き去りにしない",
        core_principles: "中核原則",
        core_principles_sub: "私たちのすべての開発を導く基盤です。",
        our_values: "私たちの価値観",
        our_values_sub: "企業として、教育者として、私たちが大切にしていること。",
        meet_our_leadership: "リーダーシップチームをご紹介",
        linkedin_profile: "LinkedInプロフィール",
        join_our_mission: "私たちのミッションに参加する",
        view_open_positions: "募集中のポジションを見る",
        contact_us: "お問い合わせ",
        privacy: "プライバシー",
        accessibility: "アクセシビリティ",
      },
      page_for_parents: {
        iep_title: "IEPまたは合理的配慮の文脈を、丁寧に扱います",
        reading_question: "お子さんは読書に対してどのような気持ちですか？",
        answers_saved: "回答は自動的に保存されます。",
        aivo_disclaimer:
          "AIVOは診断を行いません。AIVOはセラピスト、IEPチーム、または専門家の代わりにはなりません。",
        take_a_breath: "深呼吸してください。タイマーはありません。",
        which_word_means: "と同じ意味の言葉はどれですか",
        need_a_break: "休憩が必要ですか？",
        todays_mission: "今日のミッション",
        multiplying_by_3s: "3の掛け算",
        with_atlas: "Atlasと · 約15分",
        start_mission: "ミッションを開始 →",
        maya_strong_week: "マヤは今週、頑張りました！",
      },
      page_demo: {
        hero_title: "AIVOの実力をご覧ください。",
        form_heading: "あなたの状況を少し教えてください",
        form_subheading:
          "情報が多いほど、デモはより役立つものになります。必須項目はマークされています。",
        what_happens_next: "次に何が起こるか",
        step1_label: "ステップ 1 · 1営業日以内",
        step2_label: "ステップ 2 · 30分間のウォークスルー",
        step2_body:
          "学習者、保護者、教師のビューをお見せし、ご質問にライブでお答えします。",
        step3_label: "ステップ 3 · パイロットまたは提案",
        step3_body:
          "適合すれば、短いパイロットを設定するか、書面による提案をお送りします — プレッシャーはありません。",
      },
      page_features_lessonrun: {
        hero_title: "すべてのAIVOレッスンの背後にある個別化学習ユニット",
        voice_support_title: "すべてのステップでの音声サポート",
        break_mode_title: "穏やかな休憩 — 怒りのやめ方ではなく",
        count_by_3s_prompt:
          "3ずつ数えて12まで数えましょう。3から始めます。次は何ですか？",
        hint_counting_fingers:
          "指で数えてみて：3 · 6 · ? — 6よりも3多い数は何ですか？",
        need_another_hint: "別のヒントが必要ですか？",
        maya_strong_week: "マヤは今週、頑張りました！",
      },
      page_careers: {
        page_title: "AIVOチームに参加する",
        why_work_heading: "なぜAIVOで働くのか？",
        open_positions_heading: "募集中のポジション",
        apply_now: "今すぐ応募",
        no_role_heading: "あなたのポジションが見つかりませんか？",
        send_general_application: "一般応募を送る",
      },
      page_pricing: {
        hero_title: "誠実な価格設定。サプライズなし。",
        for_families: "ご家庭向け",
        family_disclaimer:
          "月額払い。いつでもキャンセル可能。有料プランは30日間返金保証。",
        for_schools: "学校・学区向け",
        pricing_faq_heading: "料金に関するよくある質問",
      },
      page_features: {
        eyebrow: "機能",
        heading: "機能リストではなく、本物の学習体験。",
        learn_more: "詳しく見る →",
      },
      page_thank_you: {
        hero_title: "受け取りました — ありがとうございます。",
        while_you_wait: "お待ちの間に",
      },
      page_levels: {
        hero_title: "5つのレベル。1つのプラットフォーム。すべての学習者。",
      },
    },
  },

  ko: {
    marketing: {
      page_about: {
        get_started: "시작하기",
        our_mission: "우리의 미션",
        no_learner_left_behind: "어떤 학습자도 뒤처지지 않도록",
        core_principles: "핵심 원칙",
        core_principles_sub: "우리가 만드는 모든 것을 이끄는 기초입니다.",
        our_values: "우리의 가치",
        our_values_sub: "기업으로서, 교육자로서 우리가 지향하는 것.",
        meet_our_leadership: "리더십 팀 소개",
        linkedin_profile: "LinkedIn 프로필",
        join_our_mission: "우리의 미션에 함께하세요",
        view_open_positions: "채용 공고 보기",
        contact_us: "문의하기",
        privacy: "개인정보 처리방침",
        accessibility: "접근성",
      },
      page_for_parents: {
        iep_title: "IEP 또는 편의 제공 맥락, 세심하게 처리",
        reading_question: "자녀가 읽기에 대해 어떻게 느끼나요?",
        answers_saved: "답변은 자동으로 저장됩니다.",
        aivo_disclaimer:
          "AIVO는 진단하지 않습니다. AIVO는 치료사, IEP 팀 또는 전문가를 대체하지 않습니다.",
        take_a_breath: "숨 한 번 쉬세요. 타이머는 없습니다.",
        which_word_means: "와 같은 의미를 가진 단어는 무엇인가요",
        need_a_break: "잠깐 쉬어야 할까요?",
        todays_mission: "오늘의 미션",
        multiplying_by_3s: "3의 곱셈",
        with_atlas: "Atlas와 함께 · 약 15분",
        start_mission: "미션 시작 →",
        maya_strong_week: "Maya가 이번 주 정말 잘했어요!",
      },
      page_demo: {
        hero_title: "AIVO를 직접 확인해 보세요.",
        form_heading: "사용 환경에 대해 조금 알려주세요",
        form_subheading:
          "더 많이 알수록 더 유용한 데모를 제공할 수 있습니다. 필수 항목은 표시되어 있습니다.",
        what_happens_next: "다음에 일어나는 일",
        step1_label: "단계 1 · 영업일 기준 1일 이내",
        step2_label: "단계 2 · 30분 데모",
        step2_body:
          "학습자, 학부모, 교사의 화면을 보여드리고 질문에 실시간으로 답변해 드립니다.",
        step3_label: "단계 3 · 파일럿 또는 제안서",
        step3_body:
          "적합하다면 짧은 파일럿을 진행하거나 서면 제안서를 보내드립니다 — 부담 없이.",
      },
      page_features_lessonrun: {
        hero_title: "모든 AIVO 수업 뒤에 있는 개인화 학습 단위",
        voice_support_title: "모든 단계에서 음성 지원",
        break_mode_title: "차분한 휴식 — 분노의 종료가 아닌",
        count_by_3s_prompt:
          "3씩 세어 12까지 가 봅시다. 3에서 시작합니다. 다음은 무엇인가요?",
        hint_counting_fingers:
          "손가락으로 세어 보세요: 3 · 6 · ? — 6보다 3 많은 숫자는 무엇인가요?",
        need_another_hint: "힌트가 더 필요한가요?",
        maya_strong_week: "Maya가 이번 주 정말 잘했어요!",
      },
      page_careers: {
        page_title: "AIVO 팀에 합류하세요",
        why_work_heading: "왜 AIVO에서 일할까요?",
        open_positions_heading: "채용 공고",
        apply_now: "지금 지원하기",
        no_role_heading: "원하는 직무가 없으신가요?",
        send_general_application: "일반 지원서 보내기",
      },
      page_pricing: {
        hero_title: "솔직한 가격. 숨겨진 비용 없음.",
        for_families: "가족을 위해",
        family_disclaimer:
          "월별 결제. 언제든지 취소 가능. 유료 플랜 30일 환불 보장.",
        for_schools: "학교 및 교육구를 위해",
        pricing_faq_heading: "가격 자주 묻는 질문",
      },
      page_features: {
        eyebrow: "기능",
        heading: "기능 목록이 아닌 진짜 학습 경험.",
        learn_more: "자세히 알아보기 →",
      },
      page_thank_you: {
        hero_title: "잘 받았습니다 — 감사합니다.",
        while_you_wait: "기다리는 동안",
      },
      page_levels: {
        hero_title: "다섯 레벨. 하나의 플랫폼. 모든 학습자.",
      },
    },
  },

  ar: {
    marketing: {
      page_about: {
        get_started: "ابدأ الآن",
        our_mission: "مهمتنا",
        no_learner_left_behind: "لا يُترك أي متعلّم خلف الركب",
        core_principles: "المبادئ الأساسية",
        core_principles_sub: "الأسس التي توجّه كل ما نبنيه.",
        our_values: "قيمنا",
        our_values_sub: "ما نؤمن به كشركة وكمعلمين.",
        meet_our_leadership: "تعرّف على فريق القيادة",
        linkedin_profile: "ملف LinkedIn",
        join_our_mission: "انضم إلى مهمتنا",
        view_open_positions: "عرض الوظائف المتاحة",
        contact_us: "اتصل بنا",
        privacy: "الخصوصية",
        accessibility: "إمكانية الوصول",
      },
      page_for_parents: {
        iep_title: "سياق IEP أو التسهيلات، يُعالَج باهتمام",
        reading_question: "كيف يشعر طفلك تجاه القراءة؟",
        answers_saved: "يتم حفظ الإجابات تلقائيًا.",
        aivo_disclaimer:
          "AIVO لا يشخّص. AIVO لا يحلّ محلّ المعالجين أو فرق IEP أو المتخصصين.",
        take_a_breath: "خذ نفسًا عميقًا. لا يوجد مؤقت.",
        which_word_means: "أي كلمة تعني نفس معنى",
        need_a_break: "هل تحتاج إلى استراحة؟",
        todays_mission: "مهمة اليوم",
        multiplying_by_3s: "الضرب في 3",
        with_atlas: "مع Atlas · ~15 دقيقة",
        start_mission: "ابدأ المهمة →",
        maya_strong_week: "قضت مايا أسبوعًا رائعًا!",
      },
      page_demo: {
        hero_title: "شاهد AIVO في العمل.",
        form_heading: "أخبرنا قليلاً عن بيئتك",
        form_subheading:
          "كلما عرفنا أكثر، كان العرض أكثر فائدة. الحقول المطلوبة مُعلَّمة.",
        what_happens_next: "ما الذي يحدث بعد ذلك",
        step1_label: "الخطوة 1 · خلال يوم عمل واحد",
        step2_label: "الخطوة 2 · جولة استعراضية لمدة 30 دقيقة",
        step2_body:
          "نعرض مشاهد المتعلّم والوالد والمعلم — ونجيب على أسئلتك مباشرةً.",
        step3_label: "الخطوة 3 · تجريبي أو مقترح",
        step3_body:
          "إذا كان هناك توافق، نخطط لتجربة قصيرة أو نرسل مقترحًا مكتوبًا — دون ضغط.",
      },
      page_features_lessonrun: {
        hero_title: "وحدة التعلم الشخصية وراء كل درس في AIVO",
        voice_support_title: "دعم صوتي في كل خطوة",
        break_mode_title: "توقف هادئ — لا انسحاب غاضب",
        count_by_3s_prompt:
          "لنعدّ من 3 إلى 3 حتى 12. ابدأ من 3. ما الذي يأتي بعده؟",
        hint_counting_fingers:
          "حاول العدّ على أصابعك: 3 · 6 · ? — ما الرقم الذي يأتي ثلاثة أكثر من 6؟",
        need_another_hint: "هل تحتاج إلى تلميح آخر؟",
        maya_strong_week: "قضت مايا أسبوعًا رائعًا!",
      },
      page_careers: {
        page_title: "انضم إلى فريق AIVO",
        why_work_heading: "لماذا تعمل في AIVO؟",
        open_positions_heading: "الوظائف المتاحة",
        apply_now: "قدّم الآن",
        no_role_heading: "لم تجد دورك؟",
        send_general_application: "أرسل طلبًا عامًا",
      },
      page_pricing: {
        hero_title: "أسعار شفافة. لا مفاجآت.",
        for_families: "للعائلات",
        family_disclaimer:
          "اشتراك شهري. إلغاء في أي وقت. ضمان استرداد الأموال لمدة 30 يومًا على الخطط المدفوعة.",
        for_schools: "للمدارس والمناطق التعليمية",
        pricing_faq_heading: "الأسئلة الشائعة حول الأسعار",
      },
      page_features: {
        eyebrow: "الميزات",
        heading: "تجارب تعلّم حقيقية، لا مجرد قوائم ميزات.",
        learn_more: "اعرف المزيد →",
      },
      page_thank_you: {
        hero_title: "تلقّيناه — شكرًا لك.",
        while_you_wait: "في انتظارك",
      },
      page_levels: {
        hero_title: "خمسة مستويات. منصة واحدة. كل متعلّم.",
      },
    },
  },

  hi: {
    marketing: {
      page_about: {
        get_started: "शुरू करें",
        our_mission: "हमारा मिशन",
        no_learner_left_behind: "कोई भी सीखने वाला पीछे न छूटे",
        core_principles: "मूल सिद्धांत",
        core_principles_sub: "वे आधार जो हम जो कुछ भी बनाते हैं उसे दिशा देते हैं।",
        our_values: "हमारे मूल्य",
        our_values_sub: "एक कंपनी और शिक्षक के रूप में हम किसके लिए खड़े हैं।",
        meet_our_leadership: "हमारे नेतृत्व से मिलें",
        linkedin_profile: "LinkedIn प्रोफ़ाइल",
        join_our_mission: "हमारे मिशन से जुड़ें",
        view_open_positions: "खुले पद देखें",
        contact_us: "संपर्क करें",
        privacy: "गोपनीयता",
        accessibility: "अभिगम्यता",
      },
      page_for_parents: {
        iep_title: "IEP या सुविधा का संदर्भ, ध्यानपूर्वक संभाला गया",
        reading_question: "आपका बच्चा पढ़ने के बारे में कैसा महसूस करता है?",
        answers_saved: "उत्तर स्वचालित रूप से सहेजे जाते हैं।",
        aivo_disclaimer:
          "AIVO निदान नहीं करता। AIVO थेरेपिस्ट, IEP टीम या विशेषज्ञों की जगह नहीं लेता।",
        take_a_breath: "सांस लें। कोई टाइमर नहीं है।",
        which_word_means: "इस शब्द का समान अर्थ कौन-सा है",
        need_a_break: "क्या आपको विराम चाहिए?",
        todays_mission: "आज का मिशन",
        multiplying_by_3s: "3 से गुणा करना",
        with_atlas: "Atlas के साथ · ~15 मिनट",
        start_mission: "मिशन शुरू करें →",
        maya_strong_week: "माया का यह सप्ताह बहुत अच्छा रहा!",
      },
      page_demo: {
        hero_title: "AIVO को कार्यरत देखें।",
        form_heading: "हमें अपने परिवेश के बारे में थोड़ा बताएं",
        form_subheading:
          "हम जितना अधिक जानेंगे, वॉकथ्रू उतना ही उपयोगी होगा। आवश्यक फ़ील्ड चिह्नित हैं।",
        what_happens_next: "आगे क्या होता है",
        step1_label: "चरण 1 · 1 कार्य दिवस के भीतर",
        step2_label: "चरण 2 · 30 मिनट का वॉकथ्रू",
        step2_body:
          "हम सीखने वाले, अभिभावक और शिक्षक के दृश्य दिखाते हैं — और आपके प्रश्नों का लाइव उत्तर देते हैं।",
        step3_label: "चरण 3 · पायलट या प्रस्ताव",
        step3_body:
          "यदि यह उपयुक्त है, तो हम एक छोटा पायलट तय करते हैं या लिखित प्रस्ताव भेजते हैं — कोई दबाव नहीं।",
      },
      page_features_lessonrun: {
        hero_title: "AIVO की हर पाठ के पीछे की व्यक्तिगत शिक्षण इकाई",
        voice_support_title: "हर चरण पर वॉयस सपोर्ट",
        break_mode_title: "एक शांत विराम — क्रोध में छोड़ना नहीं",
        count_by_3s_prompt:
          "चलो 3-3 करके 12 तक गिनते हैं। 3 से शुरू करें। आगे क्या आता है?",
        hint_counting_fingers:
          "अपनी उंगलियों पर गिनने की कोशिश करें: 3 · 6 · ? — 6 से तीन अधिक कौन-सी संख्या है?",
        need_another_hint: "क्या आपको और संकेत चाहिए?",
        maya_strong_week: "माया का यह सप्ताह बहुत अच्छा रहा!",
      },
      page_careers: {
        page_title: "AIVO टीम से जुड़ें",
        why_work_heading: "AIVO में काम क्यों करें?",
        open_positions_heading: "खुले पद",
        apply_now: "अभी आवेदन करें",
        no_role_heading: "अपनी भूमिका नहीं दिखती?",
        send_general_application: "सामान्य आवेदन भेजें",
      },
      page_pricing: {
        hero_title: "ईमानदार मूल्य। कोई आश्चर्य नहीं।",
        for_families: "परिवारों के लिए",
        family_disclaimer:
          "महीने-दर-महीने। कभी भी रद्द करें। भुगतान प्लान पर 30-दिन की मनी-बैक गारंटी।",
        for_schools: "स्कूलों और जिलों के लिए",
        pricing_faq_heading: "मूल्य निर्धारण FAQ",
      },
      page_features: {
        eyebrow: "विशेषताएँ",
        heading: "वास्तविक शिक्षण अनुभव, न कि सुविधाओं की सूचियाँ।",
        learn_more: "और जानें →",
      },
      page_thank_you: {
        hero_title: "मिल गया — धन्यवाद।",
        while_you_wait: "प्रतीक्षा के दौरान",
      },
      page_levels: {
        hero_title: "पाँच स्तर। एक प्लेटफ़ॉर्म। हर सीखने वाला।",
      },
    },
  },
};

let written = 0;
for (const [locale, roots] of Object.entries(DATA)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  deepMerge(json, roots);
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(
    `seed-M_copy3-i18n: merged page_about/page_for_parents/page_demo/page_features_lessonrun/page_careers/page_pricing/page_features/page_thank_you/page_levels → messages/${locale}.json`
  );
}
console.log(`\nseed-M_copy3-i18n: done — ${written} locale catalogs updated.`);
