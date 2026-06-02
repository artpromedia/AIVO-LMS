#!/usr/bin/env node
/**
 * seed-R_C2-i18n — translations for the R_C2 batch.
 *
 * Covers:
 *   apps/web-v2/app/district/login/page.tsx      → district_login.*
 *   apps/web-v2/app/settings/accessibility/page.tsx → settings_accessibility.*
 *   apps/web-v2/app/error.tsx                    → root.error.*
 *   apps/web-v2/app/global-error.tsx             → root.global_error.*
 *   apps/web-v2/app/layout.tsx                   → root.layout.*
 *   apps/web-v2/app/not-found.tsx                → root.not_found.*
 *   apps/web-v2/app/page.tsx                     → root.home.*
 *
 * Re-runnable. Run with: node scripts/seed-R_C2-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

// DATA shape:
//   Each locale has three top-level roots:
//     root            → nested sub-namespaces (error, global_error, layout, not_found, home)
//     settings_accessibility → flat keys (no sub-namespace nesting)
//     district_login  → flat keys (no sub-namespace nesting)
//
// Merge strategy:
//   - root.*      : deep-merge via spec loop (json[root][ns] = {...})
//   - flat keys   : direct shallow merge   (json[flatKey] = {...})

const DATA = {
  en: {
    root: {
      error: {
        refreshing: "Refreshing",
        one_moment: "One moment — getting the latest version…",
        something_went_wrong: "Something went wrong",
        lets_try_again: "Let's try that again.",
        unexpected_error:
          "We hit an unexpected error. You can retry now, or head home and come back in a moment.",
        try_again: "Try again",
        back_to_home: "Back to home",
      },
      global_error: {
        heading: "Something went very wrong.",
        body: "Please try again. If this keeps happening, contact support.",
        try_again: "Try again",
      },
      layout: {
        skip_to_main: "Skip to main content",
      },
      not_found: {
        heading: "We couldn't find that page.",
        back_to_home: "Back to home",
      },
      home: {
        ferpa_coppa: "FERPA & COPPA Compliant",
        switch_role: "Switch role",
        start_family_trial: "Start Family Trial",
        for_school_districts: "For School Districts",
        trusted_by: "Trusted by 1,200+ specialists and parents.",
      },
    },
    settings_accessibility: {
      nav_label: "Accessibility",
      page_title: "Accessibility",
      sensory_mode: "Sensory mode",
      text_and_reading: "Text and reading",
      age_mode: "Age mode",
      choose_age_mode: "Choose age mode",
      age_sprout: "Sprout (4–7)",
      age_spark: "Spark (8–12)",
      age_scholar: "Scholar (13+)",
      choose_theme: "Choose theme",
      high_contrast: "High contrast",
      text_size: "Text size",
      language: "Language",
      choose_language: "Choose language",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "District administration",
      security_badge: "MFA enforced · SOC 2 · FERPA",
      mobile_heading: "District sign-in",
      card_title: "Sign in to the district console",
      sign_in_btn: "Sign in",
      standard_sign_in: "Use the standard sign-in",
    },
  },

  es: {
    root: {
      error: {
        refreshing: "Actualizando",
        one_moment: "Un momento — obteniendo la versión más reciente…",
        something_went_wrong: "Algo salió mal",
        lets_try_again: "Intentémoslo de nuevo.",
        unexpected_error:
          "Ocurrió un error inesperado. Puedes reintentar ahora o volver al inicio y regresar en un momento.",
        try_again: "Reintentar",
        back_to_home: "Volver al inicio",
      },
      global_error: {
        heading: "Algo salió muy mal.",
        body: "Por favor, inténtalo de nuevo. Si el problema persiste, contacta al soporte.",
        try_again: "Reintentar",
      },
      layout: {
        skip_to_main: "Saltar al contenido principal",
      },
      not_found: {
        heading: "No pudimos encontrar esa página.",
        back_to_home: "Volver al inicio",
      },
      home: {
        ferpa_coppa: "Cumple con FERPA y COPPA",
        switch_role: "Cambiar rol",
        start_family_trial: "Iniciar prueba familiar",
        for_school_districts: "Para distritos escolares",
        trusted_by: "Con la confianza de más de 1200 especialistas y padres.",
      },
    },
    settings_accessibility: {
      nav_label: "Accesibilidad",
      page_title: "Accesibilidad",
      sensory_mode: "Modo sensorial",
      text_and_reading: "Texto y lectura",
      age_mode: "Modo de edad",
      choose_age_mode: "Elige el modo de edad",
      age_sprout: "Sprout (4–7)",
      age_spark: "Spark (8–12)",
      age_scholar: "Scholar (13+)",
      choose_theme: "Elige un tema",
      high_contrast: "Alto contraste",
      text_size: "Tamaño de texto",
      language: "Idioma",
      choose_language: "Elige un idioma",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "Administración del distrito",
      security_badge: "MFA obligatorio · SOC 2 · FERPA",
      mobile_heading: "Inicio de sesión del distrito",
      card_title: "Inicia sesión en la consola del distrito",
      sign_in_btn: "Iniciar sesión",
      standard_sign_in: "Usar el inicio de sesión estándar",
    },
  },

  fr: {
    root: {
      error: {
        refreshing: "Actualisation",
        one_moment: "Un instant — récupération de la dernière version…",
        something_went_wrong: "Une erreur s'est produite",
        lets_try_again: "Réessayons.",
        unexpected_error:
          "Nous avons rencontré une erreur inattendue. Vous pouvez réessayer maintenant ou rentrer à l'accueil et revenir dans un moment.",
        try_again: "Réessayer",
        back_to_home: "Retour à l'accueil",
      },
      global_error: {
        heading: "Une erreur grave s'est produite.",
        body: "Veuillez réessayer. Si le problème persiste, contactez le support.",
        try_again: "Réessayer",
      },
      layout: {
        skip_to_main: "Aller au contenu principal",
      },
      not_found: {
        heading: "Nous n'avons pas trouvé cette page.",
        back_to_home: "Retour à l'accueil",
      },
      home: {
        ferpa_coppa: "Conforme FERPA & COPPA",
        switch_role: "Changer de rôle",
        start_family_trial: "Démarrer l'essai familial",
        for_school_districts: "Pour les districts scolaires",
        trusted_by: "Utilisé par plus de 1 200 spécialistes et parents.",
      },
    },
    settings_accessibility: {
      nav_label: "Accessibilité",
      page_title: "Accessibilité",
      sensory_mode: "Mode sensoriel",
      text_and_reading: "Texte et lecture",
      age_mode: "Mode âge",
      choose_age_mode: "Choisir le mode âge",
      age_sprout: "Sprout (4–7)",
      age_spark: "Spark (8–12)",
      age_scholar: "Scholar (13+)",
      choose_theme: "Choisir un thème",
      high_contrast: "Contraste élevé",
      text_size: "Taille du texte",
      language: "Langue",
      choose_language: "Choisir une langue",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "Administration du district",
      security_badge: "MFA obligatoire · SOC 2 · FERPA",
      mobile_heading: "Connexion du district",
      card_title: "Connectez-vous à la console du district",
      sign_in_btn: "Se connecter",
      standard_sign_in: "Utiliser la connexion standard",
    },
  },

  de: {
    root: {
      error: {
        refreshing: "Wird aktualisiert",
        one_moment: "Einen Moment — neueste Version wird geladen…",
        something_went_wrong: "Etwas ist schiefgelaufen",
        lets_try_again: "Lass es uns noch einmal versuchen.",
        unexpected_error:
          "Ein unerwarteter Fehler ist aufgetreten. Sie können es jetzt erneut versuchen oder zur Startseite gehen und in einem Moment zurückkehren.",
        try_again: "Erneut versuchen",
        back_to_home: "Zurück zur Startseite",
      },
      global_error: {
        heading: "Etwas ist sehr schiefgelaufen.",
        body: "Bitte versuchen Sie es erneut. Wenn das Problem weiterhin besteht, wenden Sie sich an den Support.",
        try_again: "Erneut versuchen",
      },
      layout: {
        skip_to_main: "Zum Hauptinhalt springen",
      },
      not_found: {
        heading: "Wir konnten diese Seite nicht finden.",
        back_to_home: "Zurück zur Startseite",
      },
      home: {
        ferpa_coppa: "FERPA- & COPPA-konform",
        switch_role: "Rolle wechseln",
        start_family_trial: "Familientest starten",
        for_school_districts: "Für Schulbezirke",
        trusted_by: "Von über 1.200 Fachleuten und Eltern genutzt.",
      },
    },
    settings_accessibility: {
      nav_label: "Barrierefreiheit",
      page_title: "Barrierefreiheit",
      sensory_mode: "Sensorischer Modus",
      text_and_reading: "Text und Lesen",
      age_mode: "Altersmodus",
      choose_age_mode: "Altersmodus wählen",
      age_sprout: "Sprout (4–7)",
      age_spark: "Spark (8–12)",
      age_scholar: "Scholar (13+)",
      choose_theme: "Thema wählen",
      high_contrast: "Hoher Kontrast",
      text_size: "Textgröße",
      language: "Sprache",
      choose_language: "Sprache wählen",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "Bezirksverwaltung",
      security_badge: "MFA erzwungen · SOC 2 · FERPA",
      mobile_heading: "Bezirks-Anmeldung",
      card_title: "Bei der Bezirkskonsole anmelden",
      sign_in_btn: "Anmelden",
      standard_sign_in: "Standard-Anmeldung verwenden",
    },
  },

  pt: {
    root: {
      error: {
        refreshing: "Atualizando",
        one_moment: "Um momento — obtendo a versão mais recente…",
        something_went_wrong: "Algo deu errado",
        lets_try_again: "Vamos tentar novamente.",
        unexpected_error:
          "Encontramos um erro inesperado. Você pode tentar novamente agora ou ir para a página inicial e voltar em um momento.",
        try_again: "Tentar novamente",
        back_to_home: "Voltar ao início",
      },
      global_error: {
        heading: "Algo deu muito errado.",
        body: "Por favor, tente novamente. Se isso continuar acontecendo, entre em contato com o suporte.",
        try_again: "Tentar novamente",
      },
      layout: {
        skip_to_main: "Pular para o conteúdo principal",
      },
      not_found: {
        heading: "Não encontramos essa página.",
        back_to_home: "Voltar ao início",
      },
      home: {
        ferpa_coppa: "Conforme com FERPA e COPPA",
        switch_role: "Trocar perfil",
        start_family_trial: "Iniciar teste familiar",
        for_school_districts: "Para distritos escolares",
        trusted_by: "Com a confiança de mais de 1.200 especialistas e pais.",
      },
    },
    settings_accessibility: {
      nav_label: "Acessibilidade",
      page_title: "Acessibilidade",
      sensory_mode: "Modo sensorial",
      text_and_reading: "Texto e leitura",
      age_mode: "Modo de idade",
      choose_age_mode: "Escolher modo de idade",
      age_sprout: "Sprout (4–7)",
      age_spark: "Spark (8–12)",
      age_scholar: "Scholar (13+)",
      choose_theme: "Escolher tema",
      high_contrast: "Alto contraste",
      text_size: "Tamanho do texto",
      language: "Idioma",
      choose_language: "Escolher idioma",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "Administração do distrito",
      security_badge: "MFA obrigatório · SOC 2 · FERPA",
      mobile_heading: "Login do distrito",
      card_title: "Entre na console do distrito",
      sign_in_btn: "Entrar",
      standard_sign_in: "Usar o login padrão",
    },
  },

  zh: {
    root: {
      error: {
        refreshing: "正在刷新",
        one_moment: "请稍候 — 正在加载最新版本…",
        something_went_wrong: "出了点问题",
        lets_try_again: "让我们再试一次。",
        unexpected_error: "遇到了意外错误。您可以立即重试，或返回主页稍后再来。",
        try_again: "重试",
        back_to_home: "返回主页",
      },
      global_error: {
        heading: "出现了严重错误。",
        body: "请重试。如果问题持续出现，请联系支持团队。",
        try_again: "重试",
      },
      layout: {
        skip_to_main: "跳转至主要内容",
      },
      not_found: {
        heading: "我们找不到该页面。",
        back_to_home: "返回主页",
      },
      home: {
        ferpa_coppa: "符合 FERPA 和 COPPA 规定",
        switch_role: "切换角色",
        start_family_trial: "开始家庭试用",
        for_school_districts: "面向学区",
        trusted_by: "深受 1,200 余名专业人士和家长的信赖。",
      },
    },
    settings_accessibility: {
      nav_label: "无障碍设置",
      page_title: "无障碍设置",
      sensory_mode: "感官模式",
      text_and_reading: "文字与阅读",
      age_mode: "年龄模式",
      choose_age_mode: "选择年龄模式",
      age_sprout: "Sprout（4–7 岁）",
      age_spark: "Spark（8–12 岁）",
      age_scholar: "Scholar（13 岁以上）",
      choose_theme: "选择主题",
      high_contrast: "高对比度",
      text_size: "文字大小",
      language: "语言",
      choose_language: "选择语言",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "学区管理",
      security_badge: "强制 MFA · SOC 2 · FERPA",
      mobile_heading: "学区登录",
      card_title: "登录学区控制台",
      sign_in_btn: "登录",
      standard_sign_in: "使用标准登录",
    },
  },

  ja: {
    root: {
      error: {
        refreshing: "更新中",
        one_moment: "少々お待ちください — 最新バージョンを取得しています…",
        something_went_wrong: "問題が発生しました",
        lets_try_again: "もう一度試してみましょう。",
        unexpected_error:
          "予期しないエラーが発生しました。今すぐ再試行するか、ホームに戻ってしばらくしてから再度お試しください。",
        try_again: "再試行",
        back_to_home: "ホームに戻る",
      },
      global_error: {
        heading: "深刻なエラーが発生しました。",
        body: "もう一度お試しください。問題が続く場合は、サポートにお問い合わせください。",
        try_again: "再試行",
      },
      layout: {
        skip_to_main: "メインコンテンツへスキップ",
      },
      not_found: {
        heading: "そのページが見つかりませんでした。",
        back_to_home: "ホームに戻る",
      },
      home: {
        ferpa_coppa: "FERPA・COPPA 準拠",
        switch_role: "ロールを切り替え",
        start_family_trial: "ファミリートライアルを開始",
        for_school_districts: "学区向け",
        trusted_by: "1,200 人以上の専門家と保護者に信頼されています。",
      },
    },
    settings_accessibility: {
      nav_label: "アクセシビリティ",
      page_title: "アクセシビリティ",
      sensory_mode: "感覚モード",
      text_and_reading: "テキストと読み取り",
      age_mode: "年齢モード",
      choose_age_mode: "年齢モードを選択",
      age_sprout: "Sprout（4〜7歳）",
      age_spark: "Spark（8〜12歳）",
      age_scholar: "Scholar（13歳以上）",
      choose_theme: "テーマを選択",
      high_contrast: "ハイコントラスト",
      text_size: "文字サイズ",
      language: "言語",
      choose_language: "言語を選択",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "学区管理",
      security_badge: "MFA 必須 · SOC 2 · FERPA",
      mobile_heading: "学区サインイン",
      card_title: "学区コンソールにサインイン",
      sign_in_btn: "サインイン",
      standard_sign_in: "標準サインインを使用",
    },
  },

  ko: {
    root: {
      error: {
        refreshing: "새로고침 중",
        one_moment: "잠시만요 — 최신 버전을 가져오는 중입니다…",
        something_went_wrong: "문제가 발생했습니다",
        lets_try_again: "다시 시도해 보겠습니다.",
        unexpected_error:
          "예기치 않은 오류가 발생했습니다. 지금 다시 시도하거나 홈으로 이동한 후 잠시 후 돌아오세요.",
        try_again: "다시 시도",
        back_to_home: "홈으로 돌아가기",
      },
      global_error: {
        heading: "심각한 오류가 발생했습니다.",
        body: "다시 시도해 주세요. 이 문제가 계속 발생하면 지원팀에 문의하세요.",
        try_again: "다시 시도",
      },
      layout: {
        skip_to_main: "주요 콘텐츠로 건너뛰기",
      },
      not_found: {
        heading: "해당 페이지를 찾을 수 없습니다.",
        back_to_home: "홈으로 돌아가기",
      },
      home: {
        ferpa_coppa: "FERPA 및 COPPA 준수",
        switch_role: "역할 전환",
        start_family_trial: "가족 체험 시작",
        for_school_districts: "학구를 위한 서비스",
        trusted_by: "1,200명 이상의 전문가와 학부모가 신뢰합니다.",
      },
    },
    settings_accessibility: {
      nav_label: "접근성",
      page_title: "접근성",
      sensory_mode: "감각 모드",
      text_and_reading: "텍스트 및 읽기",
      age_mode: "연령 모드",
      choose_age_mode: "연령 모드 선택",
      age_sprout: "Sprout (4–7세)",
      age_spark: "Spark (8–12세)",
      age_scholar: "Scholar (13세 이상)",
      choose_theme: "테마 선택",
      high_contrast: "고대비",
      text_size: "텍스트 크기",
      language: "언어",
      choose_language: "언어 선택",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "학구 행정",
      security_badge: "MFA 적용 · SOC 2 · FERPA",
      mobile_heading: "학구 로그인",
      card_title: "학구 콘솔에 로그인",
      sign_in_btn: "로그인",
      standard_sign_in: "표준 로그인 사용",
    },
  },

  ar: {
    root: {
      error: {
        refreshing: "جارٍ التحديث",
        one_moment: "لحظة من فضلك — جارٍ جلب أحدث إصدار…",
        something_went_wrong: "حدث خطأ ما",
        lets_try_again: "لنحاول مرة أخرى.",
        unexpected_error:
          "واجهنا خطأً غير متوقع. يمكنك إعادة المحاولة الآن أو العودة إلى الصفحة الرئيسية والرجوع بعد لحظة.",
        try_again: "إعادة المحاولة",
        back_to_home: "العودة إلى الصفحة الرئيسية",
      },
      global_error: {
        heading: "حدث خطأ بالغ.",
        body: "يرجى المحاولة مجدّدًا. إذا استمرت المشكلة، تواصل مع الدعم الفني.",
        try_again: "إعادة المحاولة",
      },
      layout: {
        skip_to_main: "الانتقال إلى المحتوى الرئيسي",
      },
      not_found: {
        heading: "تعذّر العثور على تلك الصفحة.",
        back_to_home: "العودة إلى الصفحة الرئيسية",
      },
      home: {
        ferpa_coppa: "متوافق مع FERPA و COPPA",
        switch_role: "تبديل الدور",
        start_family_trial: "بدء تجربة العائلة",
        for_school_districts: "للمناطق التعليمية",
        trusted_by: "يثق به أكثر من 1200 متخصص وولي أمر.",
      },
    },
    settings_accessibility: {
      nav_label: "إمكانية الوصول",
      page_title: "إمكانية الوصول",
      sensory_mode: "الوضع الحسي",
      text_and_reading: "النص والقراءة",
      age_mode: "وضع العمر",
      choose_age_mode: "اختر وضع العمر",
      age_sprout: "Sprout (4–7)",
      age_spark: "Spark (8–12)",
      age_scholar: "Scholar (13+)",
      choose_theme: "اختر مظهرًا",
      high_contrast: "تباين عالٍ",
      text_size: "حجم النص",
      language: "اللغة",
      choose_language: "اختر لغة",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "إدارة المنطقة التعليمية",
      security_badge: "MFA مُفعَّل · SOC 2 · FERPA",
      mobile_heading: "تسجيل دخول المنطقة",
      card_title: "سجّل دخولك إلى لوحة تحكم المنطقة",
      sign_in_btn: "تسجيل الدخول",
      standard_sign_in: "استخدام تسجيل الدخول القياسي",
    },
  },

  hi: {
    root: {
      error: {
        refreshing: "रिफ्रेश हो रहा है",
        one_moment: "एक पल — नवीनतम संस्करण लाया जा रहा है…",
        something_went_wrong: "कुछ गलत हो गया",
        lets_try_again: "चलिए फिर से प्रयास करते हैं।",
        unexpected_error:
          "एक अप्रत्याशित त्रुटि हुई। आप अभी पुनः प्रयास कर सकते हैं, या होम पर जाएँ और कुछ देर बाद वापस आएँ।",
        try_again: "पुनः प्रयास करें",
        back_to_home: "होम पर वापस जाएँ",
      },
      global_error: {
        heading: "कुछ बहुत गलत हो गया।",
        body: "कृपया पुनः प्रयास करें। यदि यह समस्या बनी रहती है, तो सहायता से संपर्क करें।",
        try_again: "पुनः प्रयास करें",
      },
      layout: {
        skip_to_main: "मुख्य सामग्री पर जाएँ",
      },
      not_found: {
        heading: "हम वह पृष्ठ नहीं ढूँढ़ सके।",
        back_to_home: "होम पर वापस जाएँ",
      },
      home: {
        ferpa_coppa: "FERPA और COPPA अनुपालित",
        switch_role: "भूमिका बदलें",
        start_family_trial: "पारिवारिक ट्रायल शुरू करें",
        for_school_districts: "स्कूल जिलों के लिए",
        trusted_by: "1,200 से अधिक विशेषज्ञों और अभिभावकों का विश्वास।",
      },
    },
    settings_accessibility: {
      nav_label: "पहुँच-क्षमता",
      page_title: "पहुँच-क्षमता",
      sensory_mode: "संवेदी मोड",
      text_and_reading: "पाठ और पठन",
      age_mode: "आयु मोड",
      choose_age_mode: "आयु मोड चुनें",
      age_sprout: "Sprout (4–7)",
      age_spark: "Spark (8–12)",
      age_scholar: "Scholar (13+)",
      choose_theme: "थीम चुनें",
      high_contrast: "उच्च कंट्रास्ट",
      text_size: "पाठ आकार",
      language: "भाषा",
      choose_language: "भाषा चुनें",
      lang_en_us: "English (US)",
      lang_es: "Español",
      lang_fr: "Français",
    },
    district_login: {
      heading: "जिला प्रशासन",
      security_badge: "MFA अनिवार्य · SOC 2 · FERPA",
      mobile_heading: "जिला साइन-इन",
      card_title: "जिला कंसोल में साइन इन करें",
      sign_in_btn: "साइन इन करें",
      standard_sign_in: "मानक साइन-इन का उपयोग करें",
    },
  },
};

let written = 0;
for (const [locale, roots] of Object.entries(DATA)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));

  // 1. Deep-merge nested namespaces under the `root` top-level key.
  const { root, settings_accessibility, district_login } = roots;

  json.root = json.root ?? {};
  for (const [ns, keys] of Object.entries(root)) {
    json.root[ns] = { ...(json.root[ns] ?? {}), ...keys };
  }

  // 2. Flat-merge `settings_accessibility` (top-level, no sub-namespace).
  json.settings_accessibility = {
    ...(json.settings_accessibility ?? {}),
    ...settings_accessibility,
  };

  // 3. Flat-merge `district_login` (top-level, no sub-namespace).
  json.district_login = {
    ...(json.district_login ?? {}),
    ...district_login,
  };

  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(
    `seed-R_C2-i18n: merged root/settings_accessibility/district_login → messages/${locale}.json`,
  );
}
console.log(`\nseed-R_C2-i18n: done — ${written} locale catalogs updated.`);
