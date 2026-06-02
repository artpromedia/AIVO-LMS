#!/usr/bin/env node
/**
 * seed-M_copy2-i18n — fills marketing page namespaces extracted in batch M_copy2:
 *   signup/page.tsx                      -> marketing.page_signup
 *   forgot-password/page.tsx             -> marketing.page_forgot_password
 *   press-kit/page.tsx                   -> marketing.page_press_kit
 *   features/todays-mission/page.tsx     -> marketing.page_features_todays_mission
 *   for-districts/page.tsx               -> marketing.page_for_districts
 *   guides/page.tsx                      -> marketing.page_guides
 *   compare/page.tsx                     -> marketing.page_compare
 *   for-special-education/page.tsx       -> marketing.page_for_special_education
 *   tutors/page.tsx                      -> marketing.page_tutors
 *
 * All files in this batch are bucket "copy" — real professional translations for
 * all 10 locales: en, es, fr, de, pt, zh, ja, ko, ar, hi.
 *
 * Re-runnable. Run with: node scripts/seed-M_copy2-i18n.mjs
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
      page_signup: {
        logo_aria_label: "AIVO home",
        start_free_today: "Start free today",
        create_your_account: "Create your account",
        label_full_name: "Full name",
        placeholder_name: "Alex Parker",
        label_password: "Password",
        placeholder_password: "At least 8 characters",
        password_hint: "Mix letters, numbers, and a symbol for the strongest result.",
        creating_account: "Creating account...",
        create_account: "Create account",
        no_credit_card: "No credit card required",
        privacy_policy: "Privacy Policy",
        coppa_ferpa_badge: "Designed to support COPPA & FERPA",
        sign_in: "Sign in",
        footer_privacy: "Privacy",
      },
      page_forgot_password: {
        logo_aria_label: "AIVO home",
        heading: "Forgot password?",
        subheading: "Enter your email and we'll send you a link to reset your password.",
        check_inbox: "Check your inbox",
        if_account_exists: "If an account exists for",
        back_to_sign_in: "Back to sign in",
        sending: "Sending...",
        send_reset_link: "Send reset link",
        back_to_sign_in_form: "Back to sign in",
        coppa_ferpa_soc2_badge: "Designed to support COPPA · FERPA · SOC 2",
      },
      page_press_kit: {
        media_resources: "Media Resources",
        company_overview: "Company Overview",
        quick_facts: "Quick Facts",
        brand_assets: "Brand Assets",
        logo_purple_alt: "AIVO Logo Purple",
        primary_logo_purple: "Primary Logo (Purple)",
        logo_white_alt: "AIVO Logo White",
        logo_dark_bg: "Logo on Dark Background",
        brand_colors: "Brand Colors",
        media_contact: "Media Contact",
      },
      page_features_todays_mission: {
        page_title: "One next-best learning action, every day",
        problem_title: "Learners get lost in dashboards",
        mockup_todays_mission: "Today's mission",
        mockup_lesson_title: "Multiplying by 3s",
        mockup_lesson_meta: "With Atlas · ~15 minutes · Math",
        mockup_start_mission: "Start mission →",
        mockup_accessibility_note: "Read-aloud and break mode are on for Maya.",
        visibility_title: "Plain-language visibility, not a data dump",
      },
      page_for_districts: {
        rostering_title: "OneRoster-ready, CSV-friendly, manual if you must",
        licensing_heading: "Seat licensing, district pricing",
        accessibility_title: "WCAG 2.2 AA as the design target",
        accessibility_gaps_note:
          "We maintain an accessibility statement and publish known gaps — not just claims.",
        dpa_title: "Request our security and DPA packet",
      },
      page_guides: {
        nav_resources: "Resources",
        nav_get_started: "Get Started",
        badge: "Guides",
        heading: "Practical guides",
        subheading:
          "Longer-form, procurement-friendly reading for schools, districts, and families.",
      },
      page_compare: {
        eyebrow: "Compare",
        heading: "Choose your role to see how AIVO fits.",
        see_comparison: "See the comparison →",
      },
      page_for_special_education: {
        support_title: "Support should meet the learner where they are",
        iep_sharing_title: "Sharing IEP or accommodation context",
        teacher_summaries_title: "Teacher-safe support summaries",
      },
      page_tutors: {
        page_title: "Fourteen AI tutors. One Brain Clone for your child.",
      },
    },
  },

  es: {
    marketing: {
      page_signup: {
        logo_aria_label: "Inicio de AIVO",
        start_free_today: "Comienza gratis hoy",
        create_your_account: "Crea tu cuenta",
        label_full_name: "Nombre completo",
        placeholder_name: "Alex Parker",
        label_password: "Contraseña",
        placeholder_password: "Al menos 8 caracteres",
        password_hint: "Combina letras, números y un símbolo para mayor seguridad.",
        creating_account: "Creando cuenta...",
        create_account: "Crear cuenta",
        no_credit_card: "No se requiere tarjeta de crédito",
        privacy_policy: "Política de privacidad",
        coppa_ferpa_badge: "Diseñado para cumplir con COPPA y FERPA",
        sign_in: "Iniciar sesión",
        footer_privacy: "Privacidad",
      },
      page_forgot_password: {
        logo_aria_label: "Inicio de AIVO",
        heading: "¿Olvidaste tu contraseña?",
        subheading: "Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.",
        check_inbox: "Revisa tu bandeja de entrada",
        if_account_exists: "Si existe una cuenta para",
        back_to_sign_in: "Volver a iniciar sesión",
        sending: "Enviando...",
        send_reset_link: "Enviar enlace de restablecimiento",
        back_to_sign_in_form: "Volver a iniciar sesión",
        coppa_ferpa_soc2_badge: "Diseñado para cumplir con COPPA · FERPA · SOC 2",
      },
      page_press_kit: {
        media_resources: "Recursos para medios",
        company_overview: "Descripción de la empresa",
        quick_facts: "Datos rápidos",
        brand_assets: "Activos de marca",
        logo_purple_alt: "Logo AIVO morado",
        primary_logo_purple: "Logo principal (morado)",
        logo_white_alt: "Logo AIVO blanco",
        logo_dark_bg: "Logo sobre fondo oscuro",
        brand_colors: "Colores de marca",
        media_contact: "Contacto de prensa",
      },
      page_features_todays_mission: {
        page_title: "La mejor acción de aprendizaje, cada día",
        problem_title: "Los estudiantes se pierden en los paneles",
        mockup_todays_mission: "Misión de hoy",
        mockup_lesson_title: "Multiplicación por 3",
        mockup_lesson_meta: "Con Atlas · ~15 minutos · Matemáticas",
        mockup_start_mission: "Iniciar misión →",
        mockup_accessibility_note: "Lectura en voz alta y modo descanso activados para Maya.",
        visibility_title: "Visibilidad en lenguaje claro, no un volcado de datos",
      },
      page_for_districts: {
        rostering_title: "Compatible con OneRoster, CSV o registro manual",
        licensing_heading: "Licencias por plaza, precios para distritos",
        accessibility_title: "WCAG 2.2 AA como objetivo de diseño",
        accessibility_gaps_note:
          "Mantenemos una declaración de accesibilidad y publicamos las brechas conocidas — no solo afirmaciones.",
        dpa_title: "Solicitar nuestro paquete de seguridad y DPA",
      },
      page_guides: {
        nav_resources: "Recursos",
        nav_get_started: "Comenzar",
        badge: "Guías",
        heading: "Guías prácticas",
        subheading:
          "Lecturas detalladas y aptas para licitaciones, para escuelas, distritos y familias.",
      },
      page_compare: {
        eyebrow: "Comparar",
        heading: "Elige tu rol para ver cómo encaja AIVO.",
        see_comparison: "Ver la comparación →",
      },
      page_for_special_education: {
        support_title: "El apoyo debe adaptarse a donde está el estudiante",
        iep_sharing_title: "Compartir contexto de IEP o adaptaciones",
        teacher_summaries_title: "Resúmenes de apoyo seguros para docentes",
      },
      page_tutors: {
        page_title: "Catorce tutores de IA. Un Brain Clone para tu hijo.",
      },
    },
  },

  fr: {
    marketing: {
      page_signup: {
        logo_aria_label: "Accueil AIVO",
        start_free_today: "Commencez gratuitement aujourd'hui",
        create_your_account: "Créez votre compte",
        label_full_name: "Nom complet",
        placeholder_name: "Alex Parker",
        label_password: "Mot de passe",
        placeholder_password: "Au moins 8 caractères",
        password_hint: "Mélangez lettres, chiffres et un symbole pour plus de sécurité.",
        creating_account: "Création du compte...",
        create_account: "Créer un compte",
        no_credit_card: "Aucune carte de crédit requise",
        privacy_policy: "Politique de confidentialité",
        coppa_ferpa_badge: "Conçu pour respecter COPPA et FERPA",
        sign_in: "Se connecter",
        footer_privacy: "Confidentialité",
      },
      page_forgot_password: {
        logo_aria_label: "Accueil AIVO",
        heading: "Mot de passe oublié ?",
        subheading:
          "Saisissez votre e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe.",
        check_inbox: "Vérifiez votre boîte de réception",
        if_account_exists: "Si un compte existe pour",
        back_to_sign_in: "Retour à la connexion",
        sending: "Envoi en cours...",
        send_reset_link: "Envoyer le lien de réinitialisation",
        back_to_sign_in_form: "Retour à la connexion",
        coppa_ferpa_soc2_badge: "Conçu pour respecter COPPA · FERPA · SOC 2",
      },
      page_press_kit: {
        media_resources: "Ressources médias",
        company_overview: "Présentation de l'entreprise",
        quick_facts: "Chiffres clés",
        brand_assets: "Ressources de marque",
        logo_purple_alt: "Logo AIVO violet",
        primary_logo_purple: "Logo principal (violet)",
        logo_white_alt: "Logo AIVO blanc",
        logo_dark_bg: "Logo sur fond sombre",
        brand_colors: "Couleurs de marque",
        media_contact: "Contact presse",
      },
      page_features_todays_mission: {
        page_title: "La meilleure action d'apprentissage suivante, chaque jour",
        problem_title: "Les apprenants se perdent dans les tableaux de bord",
        mockup_todays_mission: "Mission du jour",
        mockup_lesson_title: "Multiplier par 3",
        mockup_lesson_meta: "Avec Atlas · ~15 minutes · Mathématiques",
        mockup_start_mission: "Démarrer la mission →",
        mockup_accessibility_note:
          "La lecture à voix haute et le mode pause sont activés pour Maya.",
        visibility_title: "Une visibilité en langage clair, pas un déversement de données",
      },
      page_for_districts: {
        rostering_title: "Compatible OneRoster, CSV ou saisie manuelle",
        licensing_heading: "Licences par siège, tarification pour les districts",
        accessibility_title: "WCAG 2.2 AA comme objectif de conception",
        accessibility_gaps_note:
          "Nous maintenons une déclaration d'accessibilité et publions les lacunes connues — pas seulement des affirmations.",
        dpa_title: "Demander notre dossier sécurité et DPA",
      },
      page_guides: {
        nav_resources: "Ressources",
        nav_get_started: "Commencer",
        badge: "Guides",
        heading: "Guides pratiques",
        subheading:
          "Des lectures approfondies et adaptées aux marchés publics pour les écoles, les districts et les familles.",
      },
      page_compare: {
        eyebrow: "Comparer",
        heading: "Choisissez votre rôle pour voir comment AIVO s'adapte.",
        see_comparison: "Voir la comparaison →",
      },
      page_for_special_education: {
        support_title: "Le soutien doit rejoindre l'apprenant là où il en est",
        iep_sharing_title: "Partager le contexte IEP ou les aménagements",
        teacher_summaries_title: "Résumés de soutien sûrs pour les enseignants",
      },
      page_tutors: {
        page_title: "Quatorze tuteurs IA. Un Brain Clone pour votre enfant.",
      },
    },
  },

  de: {
    marketing: {
      page_signup: {
        logo_aria_label: "AIVO Startseite",
        start_free_today: "Heute kostenlos starten",
        create_your_account: "Konto erstellen",
        label_full_name: "Vollständiger Name",
        placeholder_name: "Alex Parker",
        label_password: "Passwort",
        placeholder_password: "Mindestens 8 Zeichen",
        password_hint: "Kombinieren Sie Buchstaben, Zahlen und ein Symbol für mehr Sicherheit.",
        creating_account: "Konto wird erstellt...",
        create_account: "Konto erstellen",
        no_credit_card: "Keine Kreditkarte erforderlich",
        privacy_policy: "Datenschutzrichtlinie",
        coppa_ferpa_badge: "Entwickelt zur Unterstützung von COPPA und FERPA",
        sign_in: "Anmelden",
        footer_privacy: "Datenschutz",
      },
      page_forgot_password: {
        logo_aria_label: "AIVO Startseite",
        heading: "Passwort vergessen?",
        subheading:
          "Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.",
        check_inbox: "Überprüfen Sie Ihren Posteingang",
        if_account_exists: "Falls ein Konto für",
        back_to_sign_in: "Zurück zur Anmeldung",
        sending: "Wird gesendet...",
        send_reset_link: "Link zum Zurücksetzen senden",
        back_to_sign_in_form: "Zurück zur Anmeldung",
        coppa_ferpa_soc2_badge: "Entwickelt zur Unterstützung von COPPA · FERPA · SOC 2",
      },
      page_press_kit: {
        media_resources: "Medienressourcen",
        company_overview: "Unternehmensübersicht",
        quick_facts: "Kurzfakten",
        brand_assets: "Markenassets",
        logo_purple_alt: "AIVO Logo Lila",
        primary_logo_purple: "Primäres Logo (Lila)",
        logo_white_alt: "AIVO Logo Weiß",
        logo_dark_bg: "Logo auf dunklem Hintergrund",
        brand_colors: "Markenfarben",
        media_contact: "Pressekontakt",
      },
      page_features_todays_mission: {
        page_title: "Die beste nächste Lernhandlung, jeden Tag",
        problem_title: "Lernende verlieren sich in Dashboards",
        mockup_todays_mission: "Heutige Mission",
        mockup_lesson_title: "Multiplizieren mit 3",
        mockup_lesson_meta: "Mit Atlas · ~15 Minuten · Mathematik",
        mockup_start_mission: "Mission starten →",
        mockup_accessibility_note: "Vorlesen und Pausenmodus sind für Maya aktiviert.",
        visibility_title: "Klare Sichtbarkeit in einfacher Sprache, kein Datenwust",
      },
      page_for_districts: {
        rostering_title: "OneRoster-kompatibel, CSV-freundlich, manuell wenn nötig",
        licensing_heading: "Sitzplatzlizenzen, Distriktpreise",
        accessibility_title: "WCAG 2.2 AA als Designziel",
        accessibility_gaps_note:
          "Wir pflegen eine Barrierefreiheitserklärung und veröffentlichen bekannte Lücken — nicht nur Behauptungen.",
        dpa_title: "Unser Sicherheits- und DPA-Paket anfordern",
      },
      page_guides: {
        nav_resources: "Ressourcen",
        nav_get_started: "Loslegen",
        badge: "Leitfäden",
        heading: "Praxisleitfäden",
        subheading:
          "Ausführliche, beschaffungsfreundliche Lektüre für Schulen, Bezirke und Familien.",
      },
      page_compare: {
        eyebrow: "Vergleichen",
        heading: "Wählen Sie Ihre Rolle, um zu sehen, wie AIVO passt.",
        see_comparison: "Vergleich ansehen →",
      },
      page_for_special_education: {
        support_title: "Unterstützung sollte den Lernenden dort abholen, wo er steht",
        iep_sharing_title: "IEP- oder Nachteilsausgleich-Kontext teilen",
        teacher_summaries_title: "Lehrergerechte Unterstützungszusammenfassungen",
      },
      page_tutors: {
        page_title: "Vierzehn KI-Tutoren. Ein Brain Clone für Ihr Kind.",
      },
    },
  },

  pt: {
    marketing: {
      page_signup: {
        logo_aria_label: "Início do AIVO",
        start_free_today: "Comece grátis hoje",
        create_your_account: "Crie sua conta",
        label_full_name: "Nome completo",
        placeholder_name: "Alex Parker",
        label_password: "Senha",
        placeholder_password: "Pelo menos 8 caracteres",
        password_hint: "Combine letras, números e um símbolo para maior segurança.",
        creating_account: "Criando conta...",
        create_account: "Criar conta",
        no_credit_card: "Não é necessário cartão de crédito",
        privacy_policy: "Política de privacidade",
        coppa_ferpa_badge: "Desenvolvido para suportar COPPA e FERPA",
        sign_in: "Entrar",
        footer_privacy: "Privacidade",
      },
      page_forgot_password: {
        logo_aria_label: "Início do AIVO",
        heading: "Esqueceu a senha?",
        subheading: "Digite seu e-mail e enviaremos um link para redefinir sua senha.",
        check_inbox: "Verifique sua caixa de entrada",
        if_account_exists: "Se existir uma conta para",
        back_to_sign_in: "Voltar para entrar",
        sending: "Enviando...",
        send_reset_link: "Enviar link de redefinição",
        back_to_sign_in_form: "Voltar para entrar",
        coppa_ferpa_soc2_badge: "Desenvolvido para suportar COPPA · FERPA · SOC 2",
      },
      page_press_kit: {
        media_resources: "Recursos de mídia",
        company_overview: "Visão geral da empresa",
        quick_facts: "Dados rápidos",
        brand_assets: "Ativos de marca",
        logo_purple_alt: "Logotipo AIVO roxo",
        primary_logo_purple: "Logotipo principal (roxo)",
        logo_white_alt: "Logotipo AIVO branco",
        logo_dark_bg: "Logotipo em fundo escuro",
        brand_colors: "Cores da marca",
        media_contact: "Contato de imprensa",
      },
      page_features_todays_mission: {
        page_title: "A melhor próxima ação de aprendizado, todos os dias",
        problem_title: "Os alunos se perdem nos painéis",
        mockup_todays_mission: "Missão de hoje",
        mockup_lesson_title: "Multiplicando por 3",
        mockup_lesson_meta: "Com Atlas · ~15 minutos · Matemática",
        mockup_start_mission: "Iniciar missão →",
        mockup_accessibility_note: "Leitura em voz alta e modo pausa estão ativos para Maya.",
        visibility_title: "Visibilidade em linguagem clara, não um despejo de dados",
      },
      page_for_districts: {
        rostering_title: "Compatível com OneRoster, CSV ou cadastro manual",
        licensing_heading: "Licenciamento por assento, preços para distritos",
        accessibility_title: "WCAG 2.2 AA como meta de design",
        accessibility_gaps_note:
          "Mantemos uma declaração de acessibilidade e publicamos lacunas conhecidas — não apenas afirmações.",
        dpa_title: "Solicitar nosso pacote de segurança e DPA",
      },
      page_guides: {
        nav_resources: "Recursos",
        nav_get_started: "Começar",
        badge: "Guias",
        heading: "Guias práticos",
        subheading:
          "Leitura aprofundada e adequada para licitações para escolas, distritos e famílias.",
      },
      page_compare: {
        eyebrow: "Comparar",
        heading: "Escolha seu papel para ver como o AIVO se encaixa.",
        see_comparison: "Ver a comparação →",
      },
      page_for_special_education: {
        support_title: "O suporte deve encontrar o aluno onde ele está",
        iep_sharing_title: "Compartilhar contexto de IEP ou acomodações",
        teacher_summaries_title: "Resumos de suporte seguros para professores",
      },
      page_tutors: {
        page_title: "Quatorze tutores de IA. Um Brain Clone para o seu filho.",
      },
    },
  },

  zh: {
    marketing: {
      page_signup: {
        logo_aria_label: "AIVO 首页",
        start_free_today: "今天免费开始",
        create_your_account: "创建您的账户",
        label_full_name: "全名",
        placeholder_name: "张三",
        label_password: "密码",
        placeholder_password: "至少 8 个字符",
        password_hint: "混合字母、数字和符号以获得最强安全性。",
        creating_account: "正在创建账户...",
        create_account: "创建账户",
        no_credit_card: "无需信用卡",
        privacy_policy: "隐私政策",
        coppa_ferpa_badge: "专为支持 COPPA 和 FERPA 设计",
        sign_in: "登录",
        footer_privacy: "隐私",
      },
      page_forgot_password: {
        logo_aria_label: "AIVO 首页",
        heading: "忘记密码？",
        subheading: "输入您的电子邮件，我们将向您发送重置密码的链接。",
        check_inbox: "检查您的收件箱",
        if_account_exists: "如果以下邮箱存在账户：",
        back_to_sign_in: "返回登录",
        sending: "发送中...",
        send_reset_link: "发送重置链接",
        back_to_sign_in_form: "返回登录",
        coppa_ferpa_soc2_badge: "专为支持 COPPA · FERPA · SOC 2 设计",
      },
      page_press_kit: {
        media_resources: "媒体资源",
        company_overview: "公司概览",
        quick_facts: "快速事实",
        brand_assets: "品牌资产",
        logo_purple_alt: "AIVO 紫色标志",
        primary_logo_purple: "主标志（紫色）",
        logo_white_alt: "AIVO 白色标志",
        logo_dark_bg: "深色背景上的标志",
        brand_colors: "品牌色彩",
        media_contact: "媒体联系",
      },
      page_features_todays_mission: {
        page_title: "每天一个最佳学习行动",
        problem_title: "学习者在仪表板中迷失方向",
        mockup_todays_mission: "今日任务",
        mockup_lesson_title: "乘以 3",
        mockup_lesson_meta: "与 Atlas · 约 15 分钟 · 数学",
        mockup_start_mission: "开始任务 →",
        mockup_accessibility_note: "Maya 的朗读和休息模式已开启。",
        visibility_title: "清晰语言的可见性，而非数据转储",
      },
      page_for_districts: {
        rostering_title: "支持 OneRoster、CSV 或手动名册管理",
        licensing_heading: "按座位授权，学区定价",
        accessibility_title: "以 WCAG 2.2 AA 为设计目标",
        accessibility_gaps_note: "我们维护无障碍声明并公布已知差距——而非仅发表声明。",
        dpa_title: "申请我们的安全和 DPA 套件",
      },
      page_guides: {
        nav_resources: "资源",
        nav_get_started: "开始",
        badge: "指南",
        heading: "实用指南",
        subheading: "面向学校、学区和家庭的深度、采购友好型阅读材料。",
      },
      page_compare: {
        eyebrow: "比较",
        heading: "选择您的角色，看看 AIVO 如何适合您。",
        see_comparison: "查看比较 →",
      },
      page_for_special_education: {
        support_title: "支持应在学习者所在的地方与其相遇",
        iep_sharing_title: "共享 IEP 或住宿背景",
        teacher_summaries_title: "适合教师的支持摘要",
      },
      page_tutors: {
        page_title: "十四位 AI 导师。为您的孩子量身定制的 Brain Clone。",
      },
    },
  },

  ja: {
    marketing: {
      page_signup: {
        logo_aria_label: "AIVO ホーム",
        start_free_today: "今日から無料で始める",
        create_your_account: "アカウントを作成する",
        label_full_name: "フルネーム",
        placeholder_name: "山田太郎",
        label_password: "パスワード",
        placeholder_password: "8文字以上",
        password_hint: "文字、数字、記号を組み合わせると最も安全です。",
        creating_account: "アカウントを作成中...",
        create_account: "アカウントを作成",
        no_credit_card: "クレジットカード不要",
        privacy_policy: "プライバシーポリシー",
        coppa_ferpa_badge: "COPPA・FERPAへの準拠を支援する設計",
        sign_in: "サインイン",
        footer_privacy: "プライバシー",
      },
      page_forgot_password: {
        logo_aria_label: "AIVO ホーム",
        heading: "パスワードをお忘れですか？",
        subheading: "メールアドレスを入力してください。パスワード再設定リンクをお送りします。",
        check_inbox: "受信トレイを確認してください",
        if_account_exists: "このアドレスにアカウントが存在する場合：",
        back_to_sign_in: "サインインに戻る",
        sending: "送信中...",
        send_reset_link: "再設定リンクを送信",
        back_to_sign_in_form: "サインインに戻る",
        coppa_ferpa_soc2_badge: "COPPA · FERPA · SOC 2 への準拠を支援する設計",
      },
      page_press_kit: {
        media_resources: "メディアリソース",
        company_overview: "会社概要",
        quick_facts: "クイックファクト",
        brand_assets: "ブランドアセット",
        logo_purple_alt: "AIVO ロゴ パープル",
        primary_logo_purple: "プライマリロゴ（パープル）",
        logo_white_alt: "AIVO ロゴ ホワイト",
        logo_dark_bg: "ダーク背景のロゴ",
        brand_colors: "ブランドカラー",
        media_contact: "メディア連絡先",
      },
      page_features_todays_mission: {
        page_title: "毎日一つ、次のベスト学習アクション",
        problem_title: "学習者はダッシュボードで迷子になる",
        mockup_todays_mission: "今日のミッション",
        mockup_lesson_title: "3の掛け算",
        mockup_lesson_meta: "Atlasと · 約15分 · 算数",
        mockup_start_mission: "ミッションを開始 →",
        mockup_accessibility_note: "Mayaの読み上げと休憩モードがオンです。",
        visibility_title: "平易な言葉での可視化、データダンプではなく",
      },
      page_for_districts: {
        rostering_title: "OneRoster対応、CSVフレンドリー、手動も可",
        licensing_heading: "座席ライセンス、学区価格",
        accessibility_title: "WCAG 2.2 AAをデザイン目標に",
        accessibility_gaps_note:
          "アクセシビリティ声明を維持し、既知のギャップを公開しています — 主張だけではありません。",
        dpa_title: "セキュリティおよびDPAパッケージを請求する",
      },
      page_guides: {
        nav_resources: "リソース",
        nav_get_started: "始める",
        badge: "ガイド",
        heading: "実践的ガイド",
        subheading: "学校、学区、家族向けの詳細で調達に役立つ読み物。",
      },
      page_compare: {
        eyebrow: "比較",
        heading: "あなたの役割を選んで、AIVOがどう合うか見てみましょう。",
        see_comparison: "比較を見る →",
      },
      page_for_special_education: {
        support_title: "サポートは学習者がいる場所に届くべき",
        iep_sharing_title: "IEPまたは合理的配慮のコンテキストを共有する",
        teacher_summaries_title: "教師向け安全なサポートサマリー",
      },
      page_tutors: {
        page_title: "14人のAIチューター。お子様のためのBrain Clone。",
      },
    },
  },

  ko: {
    marketing: {
      page_signup: {
        logo_aria_label: "AIVO 홈",
        start_free_today: "오늘 무료로 시작하기",
        create_your_account: "계정 만들기",
        label_full_name: "이름",
        placeholder_name: "홍길동",
        label_password: "비밀번호",
        placeholder_password: "최소 8자 이상",
        password_hint: "문자, 숫자, 기호를 조합하면 가장 강력한 보안을 유지할 수 있습니다.",
        creating_account: "계정 생성 중...",
        create_account: "계정 만들기",
        no_credit_card: "신용카드 불필요",
        privacy_policy: "개인정보 처리방침",
        coppa_ferpa_badge: "COPPA 및 FERPA 준수를 위해 설계됨",
        sign_in: "로그인",
        footer_privacy: "개인정보",
      },
      page_forgot_password: {
        logo_aria_label: "AIVO 홈",
        heading: "비밀번호를 잊으셨나요?",
        subheading: "이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.",
        check_inbox: "받은 편지함을 확인하세요",
        if_account_exists: "해당 이메일로 계정이 존재하는 경우",
        back_to_sign_in: "로그인으로 돌아가기",
        sending: "전송 중...",
        send_reset_link: "재설정 링크 보내기",
        back_to_sign_in_form: "로그인으로 돌아가기",
        coppa_ferpa_soc2_badge: "COPPA · FERPA · SOC 2 준수를 위해 설계됨",
      },
      page_press_kit: {
        media_resources: "미디어 리소스",
        company_overview: "회사 개요",
        quick_facts: "주요 정보",
        brand_assets: "브랜드 자산",
        logo_purple_alt: "AIVO 로고 보라색",
        primary_logo_purple: "기본 로고 (보라색)",
        logo_white_alt: "AIVO 로고 흰색",
        logo_dark_bg: "어두운 배경의 로고",
        brand_colors: "브랜드 색상",
        media_contact: "언론 연락처",
      },
      page_features_todays_mission: {
        page_title: "매일 하나의 최선의 학습 행동",
        problem_title: "학습자들은 대시보드에서 길을 잃습니다",
        mockup_todays_mission: "오늘의 미션",
        mockup_lesson_title: "3 곱하기",
        mockup_lesson_meta: "Atlas와 함께 · 약 15분 · 수학",
        mockup_start_mission: "미션 시작 →",
        mockup_accessibility_note: "Maya를 위한 읽기 소리와 휴식 모드가 켜져 있습니다.",
        visibility_title: "데이터 덤프가 아닌 쉬운 언어로 된 가시성",
      },
      page_for_districts: {
        rostering_title: "OneRoster 지원, CSV 친화적, 수동 입력도 가능",
        licensing_heading: "자리 라이선스, 학군 가격",
        accessibility_title: "WCAG 2.2 AA를 디자인 목표로",
        accessibility_gaps_note:
          "접근성 성명서를 유지하고 알려진 격차를 공개합니다 — 단순한 주장이 아닙니다.",
        dpa_title: "보안 및 DPA 패킷 요청",
      },
      page_guides: {
        nav_resources: "리소스",
        nav_get_started: "시작하기",
        badge: "가이드",
        heading: "실용 가이드",
        subheading: "학교, 교육구, 가족을 위한 심층적이고 조달 친화적인 읽을거리.",
      },
      page_compare: {
        eyebrow: "비교",
        heading: "역할을 선택하여 AIVO가 어떻게 맞는지 확인하세요.",
        see_comparison: "비교 보기 →",
      },
      page_for_special_education: {
        support_title: "지원은 학습자가 있는 곳에서 시작해야 합니다",
        iep_sharing_title: "IEP 또는 편의 제공 맥락 공유",
        teacher_summaries_title: "교사에게 안전한 지원 요약",
      },
      page_tutors: {
        page_title: "14명의 AI 튜터. 자녀를 위한 하나의 Brain Clone.",
      },
    },
  },

  ar: {
    marketing: {
      page_signup: {
        logo_aria_label: "الصفحة الرئيسية لـ AIVO",
        start_free_today: "ابدأ مجاناً اليوم",
        create_your_account: "أنشئ حسابك",
        label_full_name: "الاسم الكامل",
        placeholder_name: "محمد علي",
        label_password: "كلمة المرور",
        placeholder_password: "8 أحرف على الأقل",
        password_hint: "امزج الأحرف والأرقام والرموز للحصول على أقوى نتيجة.",
        creating_account: "جارٍ إنشاء الحساب...",
        create_account: "إنشاء حساب",
        no_credit_card: "لا حاجة لبطاقة ائتمان",
        privacy_policy: "سياسة الخصوصية",
        coppa_ferpa_badge: "مصمم لدعم COPPA وFERPA",
        sign_in: "تسجيل الدخول",
        footer_privacy: "الخصوصية",
      },
      page_forgot_password: {
        logo_aria_label: "الصفحة الرئيسية لـ AIVO",
        heading: "هل نسيت كلمة المرور؟",
        subheading: "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.",
        check_inbox: "تحقق من بريدك الوارد",
        if_account_exists: "إذا كان هناك حساب مرتبط بـ",
        back_to_sign_in: "العودة إلى تسجيل الدخول",
        sending: "جارٍ الإرسال...",
        send_reset_link: "إرسال رابط إعادة التعيين",
        back_to_sign_in_form: "العودة إلى تسجيل الدخول",
        coppa_ferpa_soc2_badge: "مصمم لدعم COPPA · FERPA · SOC 2",
      },
      page_press_kit: {
        media_resources: "موارد الإعلام",
        company_overview: "نظرة عامة على الشركة",
        quick_facts: "حقائق سريعة",
        brand_assets: "أصول العلامة التجارية",
        logo_purple_alt: "شعار AIVO البنفسجي",
        primary_logo_purple: "الشعار الأساسي (بنفسجي)",
        logo_white_alt: "شعار AIVO الأبيض",
        logo_dark_bg: "الشعار على خلفية داكنة",
        brand_colors: "ألوان العلامة التجارية",
        media_contact: "التواصل مع الصحافة",
      },
      page_features_todays_mission: {
        page_title: "أفضل إجراء تعليمي واحد، كل يوم",
        problem_title: "يضيع المتعلمون في لوحات التحكم",
        mockup_todays_mission: "مهمة اليوم",
        mockup_lesson_title: "الضرب في 3",
        mockup_lesson_meta: "مع Atlas · حوالي 15 دقيقة · رياضيات",
        mockup_start_mission: "بدء المهمة ←",
        mockup_accessibility_note: "وضع القراءة بصوت عالٍ والاستراحة مفعّلان لـ Maya.",
        visibility_title: "رؤية بلغة واضحة، لا تفريغاً للبيانات",
      },
      page_for_districts: {
        rostering_title: "جاهز لـ OneRoster، متوافق مع CSV، أو يدوي عند الضرورة",
        licensing_heading: "ترخيص المقاعد، أسعار المقاطعات",
        accessibility_title: "WCAG 2.2 AA كهدف تصميم",
        accessibility_gaps_note:
          "نحتفظ ببيان إمكانية الوصول وننشر الثغرات المعروفة — لا مجرد ادعاءات.",
        dpa_title: "طلب حزمة الأمان واتفاقية معالجة البيانات",
      },
      page_guides: {
        nav_resources: "الموارد",
        nav_get_started: "ابدأ الآن",
        badge: "أدلة",
        heading: "أدلة عملية",
        subheading: "قراءة متعمقة وملائمة للمشتريات للمدارس والمقاطعات والعائلات.",
      },
      page_compare: {
        eyebrow: "مقارنة",
        heading: "اختر دورك لترى كيف يناسبك AIVO.",
        see_comparison: "عرض المقارنة ←",
      },
      page_for_special_education: {
        support_title: "يجب أن يلتقي الدعم المتعلمَ أينما كان",
        iep_sharing_title: "مشاركة سياق IEP أو التسهيلات",
        teacher_summaries_title: "ملخصات الدعم الآمنة للمعلمين",
      },
      page_tutors: {
        page_title: "أربعة عشر معلماً بالذكاء الاصطناعي. Brain Clone واحد لطفلك.",
      },
    },
  },

  hi: {
    marketing: {
      page_signup: {
        logo_aria_label: "AIVO होम",
        start_free_today: "आज मुफ्त में शुरू करें",
        create_your_account: "अपना खाता बनाएं",
        label_full_name: "पूरा नाम",
        placeholder_name: "राम शर्मा",
        label_password: "पासवर्ड",
        placeholder_password: "कम से कम 8 अक्षर",
        password_hint: "सबसे मजबूत परिणाम के लिए अक्षर, संख्याएं और एक प्रतीक मिलाएं।",
        creating_account: "खाता बनाया जा रहा है...",
        create_account: "खाता बनाएं",
        no_credit_card: "कोई क्रेडिट कार्ड आवश्यक नहीं",
        privacy_policy: "गोपनीयता नीति",
        coppa_ferpa_badge: "COPPA और FERPA का समर्थन करने के लिए डिज़ाइन किया गया",
        sign_in: "साइन इन करें",
        footer_privacy: "गोपनीयता",
      },
      page_forgot_password: {
        logo_aria_label: "AIVO होम",
        heading: "पासवर्ड भूल गए?",
        subheading: "अपना ईमेल दर्ज करें और हम आपको पासवर्ड रीसेट करने का लिंक भेजेंगे।",
        check_inbox: "अपना इनबॉक्स जांचें",
        if_account_exists: "यदि इस पते के लिए कोई खाता मौजूद है:",
        back_to_sign_in: "साइन इन पर वापस जाएं",
        sending: "भेजा जा रहा है...",
        send_reset_link: "रीसेट लिंक भेजें",
        back_to_sign_in_form: "साइन इन पर वापस जाएं",
        coppa_ferpa_soc2_badge: "COPPA · FERPA · SOC 2 का समर्थन करने के लिए डिज़ाइन किया गया",
      },
      page_press_kit: {
        media_resources: "मीडिया संसाधन",
        company_overview: "कंपनी का अवलोकन",
        quick_facts: "त्वरित तथ्य",
        brand_assets: "ब्रांड संपत्तियां",
        logo_purple_alt: "AIVO लोगो बैंगनी",
        primary_logo_purple: "प्राथमिक लोगो (बैंगनी)",
        logo_white_alt: "AIVO लोगो सफेद",
        logo_dark_bg: "गहरे पृष्ठभूमि पर लोगो",
        brand_colors: "ब्रांड रंग",
        media_contact: "मीडिया संपर्क",
      },
      page_features_todays_mission: {
        page_title: "हर दिन एक सर्वोत्तम अगली सीखने की क्रिया",
        problem_title: "सीखने वाले डैशबोर्ड में खो जाते हैं",
        mockup_todays_mission: "आज का मिशन",
        mockup_lesson_title: "3 से गुणा करना",
        mockup_lesson_meta: "Atlas के साथ · ~15 मिनट · गणित",
        mockup_start_mission: "मिशन शुरू करें →",
        mockup_accessibility_note: "Maya के लिए पढ़कर सुनाना और विराम मोड चालू है।",
        visibility_title: "सरल भाषा में दृश्यता, डेटा का ढेर नहीं",
      },
      page_for_districts: {
        rostering_title: "OneRoster-तैयार, CSV-अनुकूल, जरूरत पर मैन्युअल",
        licensing_heading: "सीट लाइसेंसिंग, जिला मूल्य निर्धारण",
        accessibility_title: "डिज़ाइन लक्ष्य के रूप में WCAG 2.2 AA",
        accessibility_gaps_note:
          "हम एक पहुंच-योग्यता विवरण बनाए रखते हैं और ज्ञात कमियां प्रकाशित करते हैं — केवल दावे नहीं।",
        dpa_title: "हमारा सुरक्षा और DPA पैकेट अनुरोध करें",
      },
      page_guides: {
        nav_resources: "संसाधन",
        nav_get_started: "शुरू करें",
        badge: "गाइड",
        heading: "व्यावहारिक गाइड",
        subheading: "स्कूलों, जिलों और परिवारों के लिए विस्तृत, खरीद-अनुकूल पठन सामग्री।",
      },
      page_compare: {
        eyebrow: "तुलना करें",
        heading: "अपनी भूमिका चुनें यह देखने के लिए कि AIVO कैसे उपयुक्त है।",
        see_comparison: "तुलना देखें →",
      },
      page_for_special_education: {
        support_title: "सहायता को सीखने वाले से वहीं मिलना चाहिए जहां वे हैं",
        iep_sharing_title: "IEP या आवास संदर्भ साझा करना",
        teacher_summaries_title: "शिक्षकों के लिए सुरक्षित सहायता सारांश",
      },
      page_tutors: {
        page_title: "चौदह AI ट्यूटर। आपके बच्चे के लिए एक Brain Clone।",
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
    `seed-M_copy2-i18n: merged page_signup/page_forgot_password/page_press_kit/page_features_todays_mission/page_for_districts/page_guides/page_compare/page_for_special_education/page_tutors → messages/${locale}.json`,
  );
}
console.log(`\nseed-M_copy2-i18n: done — ${written} locale catalogs updated.`);
