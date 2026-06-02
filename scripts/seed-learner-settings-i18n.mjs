#!/usr/bin/env node
/**
 * seed-learner-settings-i18n — translator for the learner Settings hub.
 *
 * Covers the learner-facing settings surfaces: the settings hub, the
 * accessibility settings page, and the read-aloud/audio page + its
 * preference form. Adds sub-namespaces under the existing `learner` key
 * (preserving the prior learner.* subtrees) for all ten shipped locales.
 *
 * Re-runnable: overwrites only learner.settings / learner.settings_a11y /
 * learner.settings_audio. Voice IDs and dynamic values stay in code.
 *
 *   node scripts/seed-learner-settings-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const LEARNER = {
  en: {
    settings: {
      eyebrow: "Settings",
      title: "Make AIVO yours",
      description: "Pick how AIVO looks, sounds, and speaks to you.",
      language_title: "Language",
      language_desc:
        "AIVO will use this language for buttons, menus, and helper messages. Your lessons stay in the subject's language.",
      a11y_title: "Accessibility",
      a11y_desc: "Larger text, reduced motion, captions, and switch scanning.",
      a11y_link: "Open accessibility settings →",
      sound_title: "Sound & voice",
      sound_desc: "Pick the helper voice AIVO uses to read out questions and feedback.",
      sound_link: "Open sound settings →",
    },
    settings_a11y: {
      eyebrow: "Settings · for {name}",
      title: "How you like to learn",
      body: "Tweak these any time — your lessons will follow along. Every option is built into the calm AIVO experience, never a separate mode.",
      card_title: "Reading & display",
      card_desc: "Big text, dyslexia-friendly font, extra spacing, high contrast.",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "Every AIVO screen meets WCAG 2.2 AA out of the box. These settings let you push further when you need to.",
      reassure_labels_title: "Same product, no labels",
      reassure_labels_body:
        "Turning on supports never marks your learner as different — the interface stays calm and premium.",
      reassure_teachers_title: "Teachers honour these",
      reassure_teachers_body:
        "Whatever you turn on here is applied during lessons, homework, and the AI tutor — no extra setup.",
    },
    settings_audio: {
      no_learner_title: "Audio",
      no_learner_body: "Sign in as a learner to view audio settings.",
      eyebrow: "Settings",
      title: "Read-aloud",
      description:
        "Pick a voice and playback speed. Your grown-up controls whether read-aloud is turned on.",
      voice_kid_friendly: "Kid-friendly",
      voice_warm_female: "Warm female",
      voice_warm_male: "Warm male",
      voice_calm_neutral: "Calm neutral",
      voice_narrator_low: "Narrator (low)",
      voice_narrator_high: "Narrator (high)",
      enable_label: "Enable read-aloud for this learner",
      voice_label: "Voice",
      speed_label: "Speed: {speed}x",
      captions_label: "Always show captions",
      generating: "Generating…",
      preview: "Preview voice",
      save: "Save",
      preview_aria: "Voice preview",
      no_audio_support: "Your browser does not support audio playback.",
      transcript: "Transcript",
      preview_unavailable: "Audio preview unavailable — transcript fallback shown above.",
      preview_text: "Hello! This is your read-aloud voice preview.",
      failed: "Failed.",
      preview_failed: "Preview failed.",
    },
  },

  es: {
    settings: {
      eyebrow: "Ajustes",
      title: "Haz que AIVO sea tuyo",
      description: "Elige cómo AIVO se ve, suena y te habla.",
      language_title: "Idioma",
      language_desc:
        "AIVO usará este idioma para botones, menús y mensajes de ayuda. Tus lecciones se mantienen en el idioma de la materia.",
      a11y_title: "Accesibilidad",
      a11y_desc: "Texto más grande, menos movimiento, subtítulos y barrido por conmutador.",
      a11y_link: "Abrir ajustes de accesibilidad →",
      sound_title: "Sonido y voz",
      sound_desc: "Elige la voz de ayuda que AIVO usa para leer preguntas y comentarios.",
      sound_link: "Abrir ajustes de sonido →",
    },
    settings_a11y: {
      eyebrow: "Ajustes · para {name}",
      title: "Cómo te gusta aprender",
      body: "Ajústalos cuando quieras: tus lecciones los seguirán. Cada opción está integrada en la experiencia tranquila de AIVO, nunca es un modo aparte.",
      card_title: "Lectura y pantalla",
      card_desc: "Texto grande, fuente amigable para la dislexia, mayor espaciado, alto contraste.",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "Cada pantalla de AIVO cumple WCAG 2.2 AA de fábrica. Estos ajustes te permiten ir más lejos cuando lo necesites.",
      reassure_labels_title: "El mismo producto, sin etiquetas",
      reassure_labels_body:
        "Activar apoyos nunca marca a tu estudiante como diferente: la interfaz sigue siendo tranquila y de calidad.",
      reassure_teachers_title: "Los docentes los respetan",
      reassure_teachers_body:
        "Lo que actives aquí se aplica durante las lecciones, las tareas y el tutor con IA, sin configuración adicional.",
    },
    settings_audio: {
      no_learner_title: "Audio",
      no_learner_body: "Inicia sesión como estudiante para ver los ajustes de audio.",
      eyebrow: "Ajustes",
      title: "Lectura en voz alta",
      description:
        "Elige una voz y la velocidad de reproducción. Tu adulto controla si la lectura en voz alta está activada.",
      voice_kid_friendly: "Para niños",
      voice_warm_female: "Femenina cálida",
      voice_warm_male: "Masculina cálida",
      voice_calm_neutral: "Neutra tranquila",
      voice_narrator_low: "Narrador (grave)",
      voice_narrator_high: "Narrador (agudo)",
      enable_label: "Activar lectura en voz alta para este estudiante",
      voice_label: "Voz",
      speed_label: "Velocidad: {speed}x",
      captions_label: "Mostrar siempre los subtítulos",
      generating: "Generando…",
      preview: "Escuchar voz",
      save: "Guardar",
      preview_aria: "Vista previa de voz",
      no_audio_support: "Tu navegador no admite la reproducción de audio.",
      transcript: "Transcripción",
      preview_unavailable:
        "Vista previa de audio no disponible: se muestra arriba la transcripción de reserva.",
      preview_text: "¡Hola! Esta es la vista previa de tu voz de lectura en voz alta.",
      failed: "Error.",
      preview_failed: "Falló la vista previa.",
    },
  },

  fr: {
    settings: {
      eyebrow: "Paramètres",
      title: "Faites d'AIVO le vôtre",
      description: "Choisissez l'apparence, le son et la façon dont AIVO vous parle.",
      language_title: "Langue",
      language_desc:
        "AIVO utilisera cette langue pour les boutons, les menus et les messages d'aide. Vos leçons restent dans la langue de la matière.",
      a11y_title: "Accessibilité",
      a11y_desc: "Texte plus grand, mouvement réduit, sous-titres et balayage par contacteur.",
      a11y_link: "Ouvrir les paramètres d'accessibilité →",
      sound_title: "Son et voix",
      sound_desc:
        "Choisissez la voix d'aide qu'AIVO utilise pour lire les questions et les retours.",
      sound_link: "Ouvrir les paramètres de son →",
    },
    settings_a11y: {
      eyebrow: "Paramètres · pour {name}",
      title: "Comment vous aimez apprendre",
      body: "Modifiez-les à tout moment — vos leçons suivront. Chaque option est intégrée à l'expérience apaisée d'AIVO, jamais un mode séparé.",
      card_title: "Lecture et affichage",
      card_desc: "Grand texte, police adaptée à la dyslexie, espacement accru, contraste élevé.",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "Chaque écran d'AIVO respecte WCAG 2.2 AA d'emblée. Ces paramètres vous permettent d'aller plus loin au besoin.",
      reassure_labels_title: "Même produit, sans étiquettes",
      reassure_labels_body:
        "Activer des aides ne marque jamais votre apprenant comme différent — l'interface reste apaisée et soignée.",
      reassure_teachers_title: "Les enseignants les respectent",
      reassure_teachers_body:
        "Tout ce que vous activez ici s'applique pendant les leçons, les devoirs et le tuteur IA — sans configuration supplémentaire.",
    },
    settings_audio: {
      no_learner_title: "Audio",
      no_learner_body: "Connectez-vous en tant qu'apprenant pour voir les paramètres audio.",
      eyebrow: "Paramètres",
      title: "Lecture à voix haute",
      description:
        "Choisissez une voix et une vitesse de lecture. Votre adulte contrôle si la lecture à voix haute est activée.",
      voice_kid_friendly: "Pour enfants",
      voice_warm_female: "Voix féminine chaleureuse",
      voice_warm_male: "Voix masculine chaleureuse",
      voice_calm_neutral: "Neutre apaisée",
      voice_narrator_low: "Narrateur (grave)",
      voice_narrator_high: "Narrateur (aigu)",
      enable_label: "Activer la lecture à voix haute pour cet apprenant",
      voice_label: "Voix",
      speed_label: "Vitesse : {speed}x",
      captions_label: "Toujours afficher les sous-titres",
      generating: "Génération…",
      preview: "Écouter la voix",
      save: "Enregistrer",
      preview_aria: "Aperçu de la voix",
      no_audio_support: "Votre navigateur ne prend pas en charge la lecture audio.",
      transcript: "Transcription",
      preview_unavailable:
        "Aperçu audio indisponible — la transcription de secours est affichée ci-dessus.",
      preview_text: "Bonjour ! Voici l'aperçu de votre voix de lecture à voix haute.",
      failed: "Échec.",
      preview_failed: "Échec de l'aperçu.",
    },
  },

  de: {
    settings: {
      eyebrow: "Einstellungen",
      title: "Mach AIVO zu deinem",
      description: "Wähle, wie AIVO aussieht, klingt und mit dir spricht.",
      language_title: "Sprache",
      language_desc:
        "AIVO verwendet diese Sprache für Schaltflächen, Menüs und Hilfetexte. Deine Lektionen bleiben in der Sprache des Fachs.",
      a11y_title: "Barrierefreiheit",
      a11y_desc: "Größerer Text, weniger Bewegung, Untertitel und Switch-Scanning.",
      a11y_link: "Barrierefreiheits-Einstellungen öffnen →",
      sound_title: "Ton & Stimme",
      sound_desc: "Wähle die Hilfsstimme, mit der AIVO Fragen und Rückmeldungen vorliest.",
      sound_link: "Toneinstellungen öffnen →",
    },
    settings_a11y: {
      eyebrow: "Einstellungen · für {name}",
      title: "Wie du gern lernst",
      body: "Passe sie jederzeit an — deine Lektionen ziehen mit. Jede Option ist in das ruhige AIVO-Erlebnis eingebaut, niemals ein separater Modus.",
      card_title: "Lesen & Anzeige",
      card_desc: "Großer Text, Legasthenie-freundliche Schrift, größerer Abstand, hoher Kontrast.",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "Jeder AIVO-Bildschirm erfüllt WCAG 2.2 AA von Haus aus. Mit diesen Einstellungen kannst du bei Bedarf weiter gehen.",
      reassure_labels_title: "Gleiches Produkt, keine Etiketten",
      reassure_labels_body:
        "Das Aktivieren von Hilfen kennzeichnet deine Lernenden niemals als anders — die Oberfläche bleibt ruhig und hochwertig.",
      reassure_teachers_title: "Lehrkräfte respektieren diese",
      reassure_teachers_body:
        "Was du hier aktivierst, wird in Lektionen, Hausaufgaben und beim KI-Tutor angewendet — ohne zusätzliche Einrichtung.",
    },
    settings_audio: {
      no_learner_title: "Audio",
      no_learner_body: "Melde dich als Lernende/r an, um die Audio-Einstellungen zu sehen.",
      eyebrow: "Einstellungen",
      title: "Vorlesen",
      description:
        "Wähle eine Stimme und die Wiedergabegeschwindigkeit. Dein Erwachsener steuert, ob das Vorlesen eingeschaltet ist.",
      voice_kid_friendly: "Kindgerecht",
      voice_warm_female: "Warme weibliche Stimme",
      voice_warm_male: "Warme männliche Stimme",
      voice_calm_neutral: "Ruhig neutral",
      voice_narrator_low: "Erzähler (tief)",
      voice_narrator_high: "Erzähler (hoch)",
      enable_label: "Vorlesen für diese/n Lernende/n aktivieren",
      voice_label: "Stimme",
      speed_label: "Geschwindigkeit: {speed}x",
      captions_label: "Untertitel immer anzeigen",
      generating: "Wird erzeugt…",
      preview: "Stimme anhören",
      save: "Speichern",
      preview_aria: "Stimmvorschau",
      no_audio_support: "Dein Browser unterstützt keine Audiowiedergabe.",
      transcript: "Transkript",
      preview_unavailable:
        "Audiovorschau nicht verfügbar — das Transkript wird oben als Ausweichlösung angezeigt.",
      preview_text: "Hallo! Dies ist die Vorschau deiner Vorlesestimme.",
      failed: "Fehlgeschlagen.",
      preview_failed: "Vorschau fehlgeschlagen.",
    },
  },

  pt: {
    settings: {
      eyebrow: "Configurações",
      title: "Deixe a AIVO com a sua cara",
      description: "Escolha como a AIVO aparece, soa e fala com você.",
      language_title: "Idioma",
      language_desc:
        "A AIVO usará este idioma para botões, menus e mensagens de ajuda. Suas lições permanecem no idioma da matéria.",
      a11y_title: "Acessibilidade",
      a11y_desc: "Texto maior, menos movimento, legendas e varredura por acionador.",
      a11y_link: "Abrir configurações de acessibilidade →",
      sound_title: "Som e voz",
      sound_desc: "Escolha a voz de ajuda que a AIVO usa para ler perguntas e feedback.",
      sound_link: "Abrir configurações de som →",
    },
    settings_a11y: {
      eyebrow: "Configurações · para {name}",
      title: "Como você gosta de aprender",
      body: "Ajuste quando quiser — suas lições vão acompanhar. Cada opção está integrada à experiência calma da AIVO, nunca é um modo separado.",
      card_title: "Leitura e exibição",
      card_desc: "Texto grande, fonte amigável para dislexia, mais espaçamento, alto contraste.",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "Cada tela da AIVO atende ao WCAG 2.2 AA de fábrica. Estas configurações permitem ir além quando você precisar.",
      reassure_labels_title: "Mesmo produto, sem rótulos",
      reassure_labels_body:
        "Ativar apoios nunca marca seu aluno como diferente — a interface continua calma e premium.",
      reassure_teachers_title: "Os professores respeitam isto",
      reassure_teachers_body:
        "O que você ativar aqui é aplicado durante as lições, as tarefas e o tutor de IA — sem configuração extra.",
    },
    settings_audio: {
      no_learner_title: "Áudio",
      no_learner_body: "Entre como aluno para ver as configurações de áudio.",
      eyebrow: "Configurações",
      title: "Leitura em voz alta",
      description:
        "Escolha uma voz e a velocidade de reprodução. Seu adulto controla se a leitura em voz alta está ativada.",
      voice_kid_friendly: "Para crianças",
      voice_warm_female: "Feminina acolhedora",
      voice_warm_male: "Masculina acolhedora",
      voice_calm_neutral: "Neutra calma",
      voice_narrator_low: "Narrador (grave)",
      voice_narrator_high: "Narrador (agudo)",
      enable_label: "Ativar leitura em voz alta para este aluno",
      voice_label: "Voz",
      speed_label: "Velocidade: {speed}x",
      captions_label: "Sempre mostrar legendas",
      generating: "Gerando…",
      preview: "Ouvir a voz",
      save: "Salvar",
      preview_aria: "Prévia da voz",
      no_audio_support: "Seu navegador não suporta a reprodução de áudio.",
      transcript: "Transcrição",
      preview_unavailable:
        "Prévia de áudio indisponível — a transcrição de reserva é mostrada acima.",
      preview_text: "Olá! Esta é a prévia da sua voz de leitura em voz alta.",
      failed: "Falhou.",
      preview_failed: "A prévia falhou.",
    },
  },

  zh: {
    settings: {
      eyebrow: "设置",
      title: "把 AIVO 调成你的样子",
      description: "选择 AIVO 的外观、声音以及与你交流的方式。",
      language_title: "语言",
      language_desc: "AIVO 会用此语言显示按钮、菜单和帮助信息。你的课程仍使用该学科的语言。",
      a11y_title: "无障碍",
      a11y_desc: "更大的文字、减少动效、字幕以及开关扫描。",
      a11y_link: "打开无障碍设置 →",
      sound_title: "声音与语音",
      sound_desc: "选择 AIVO 用来朗读问题和反馈的辅助语音。",
      sound_link: "打开声音设置 →",
    },
    settings_a11y: {
      eyebrow: "设置 · 为 {name}",
      title: "你喜欢的学习方式",
      body: "随时调整——你的课程会随之同步。每个选项都内置于平和的 AIVO 体验中，绝不是单独的模式。",
      card_title: "阅读与显示",
      card_desc: "大字体、对阅读障碍友好的字体、更大间距、高对比度。",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body: "AIVO 的每个界面开箱即符合 WCAG 2.2 AA。这些设置让你在需要时更进一步。",
      reassure_labels_title: "同一产品，没有标签",
      reassure_labels_body: "开启支持绝不会把你的学习者标记为与众不同——界面始终保持平和而精致。",
      reassure_teachers_title: "教师会尊重这些设置",
      reassure_teachers_body: "你在此开启的内容会在课程、作业和 AI 导师中应用——无需额外设置。",
    },
    settings_audio: {
      no_learner_title: "音频",
      no_learner_body: "以学习者身份登录以查看音频设置。",
      eyebrow: "设置",
      title: "朗读",
      description: "选择语音和播放速度。是否开启朗读由你的大人控制。",
      voice_kid_friendly: "童趣",
      voice_warm_female: "温暖女声",
      voice_warm_male: "温暖男声",
      voice_calm_neutral: "平和中性",
      voice_narrator_low: "旁白（低音）",
      voice_narrator_high: "旁白（高音）",
      enable_label: "为该学习者启用朗读",
      voice_label: "语音",
      speed_label: "速度：{speed}x",
      captions_label: "始终显示字幕",
      generating: "正在生成…",
      preview: "试听语音",
      save: "保存",
      preview_aria: "语音预览",
      no_audio_support: "你的浏览器不支持音频播放。",
      transcript: "文字稿",
      preview_unavailable: "音频预览不可用——上方显示文字稿作为备用。",
      preview_text: "你好！这是你的朗读语音预览。",
      failed: "失败。",
      preview_failed: "预览失败。",
    },
  },

  ja: {
    settings: {
      eyebrow: "設定",
      title: "AIVO をあなた仕様に",
      description: "AIVO の見た目・音・話しかけ方を選びましょう。",
      language_title: "言語",
      language_desc:
        "AIVO はボタン・メニュー・ヘルプメッセージにこの言語を使います。レッスンは教科の言語のままです。",
      a11y_title: "アクセシビリティ",
      a11y_desc: "大きな文字、動きの軽減、字幕、スイッチスキャン。",
      a11y_link: "アクセシビリティ設定を開く →",
      sound_title: "サウンドと音声",
      sound_desc: "AIVO が質問やフィードバックを読み上げる際の補助音声を選びます。",
      sound_link: "サウンド設定を開く →",
    },
    settings_a11y: {
      eyebrow: "設定 · {name} 用",
      title: "あなたの学び方",
      body: "いつでも調整できます — レッスンもそれに従います。どのオプションも穏やかな AIVO 体験に組み込まれており、別モードではありません。",
      card_title: "読みやすさと表示",
      card_desc: "大きな文字、ディスレクシアに優しいフォント、広い字間、ハイコントラスト。",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "AIVO のすべての画面は標準で WCAG 2.2 AA を満たします。これらの設定で必要に応じてさらに調整できます。",
      reassure_labels_title: "同じ製品、ラベルなし",
      reassure_labels_body:
        "サポートを有効にしても、学習者が「違う」と見なされることはありません。画面は穏やかで上質なままです。",
      reassure_teachers_title: "教師もこれを尊重します",
      reassure_teachers_body:
        "ここで有効にしたものは、レッスン・宿題・AI チューターで適用されます — 追加設定は不要です。",
    },
    settings_audio: {
      no_learner_title: "オーディオ",
      no_learner_body: "オーディオ設定を見るには、学習者としてサインインしてください。",
      eyebrow: "設定",
      title: "読み上げ",
      description:
        "声と再生速度を選びます。読み上げをオンにするかどうかは、あなたの大人が管理します。",
      voice_kid_friendly: "子ども向け",
      voice_warm_female: "温かみのある女性",
      voice_warm_male: "温かみのある男性",
      voice_calm_neutral: "穏やかでニュートラル",
      voice_narrator_low: "ナレーター（低音）",
      voice_narrator_high: "ナレーター（高音）",
      enable_label: "この学習者の読み上げを有効にする",
      voice_label: "声",
      speed_label: "速度：{speed}x",
      captions_label: "字幕を常に表示",
      generating: "生成中…",
      preview: "声を試聴",
      save: "保存",
      preview_aria: "声のプレビュー",
      no_audio_support: "お使いのブラウザは音声の再生に対応していません。",
      transcript: "文字起こし",
      preview_unavailable:
        "音声プレビューを利用できません — 上に文字起こしをフォールバックとして表示しています。",
      preview_text: "こんにちは！これはあなたの読み上げ音声のプレビューです。",
      failed: "失敗しました。",
      preview_failed: "プレビューに失敗しました。",
    },
  },

  ko: {
    settings: {
      eyebrow: "설정",
      title: "AIVO를 내 것으로",
      description: "AIVO의 모습, 소리, 말하는 방식을 선택하세요.",
      language_title: "언어",
      language_desc:
        "AIVO는 버튼, 메뉴, 도움말 메시지에 이 언어를 사용합니다. 수업은 과목의 언어 그대로 유지됩니다.",
      a11y_title: "접근성",
      a11y_desc: "더 큰 글자, 모션 줄이기, 자막, 스위치 스캐닝.",
      a11y_link: "접근성 설정 열기 →",
      sound_title: "소리 및 음성",
      sound_desc: "AIVO가 질문과 피드백을 읽어 줄 때 사용하는 도우미 음성을 선택하세요.",
      sound_link: "소리 설정 열기 →",
    },
    settings_a11y: {
      eyebrow: "설정 · {name}용",
      title: "당신이 좋아하는 학습 방식",
      body: "언제든지 조정하세요 — 수업이 따라옵니다. 모든 옵션은 차분한 AIVO 경험에 내장되어 있으며, 별도의 모드가 아닙니다.",
      card_title: "읽기 및 표시",
      card_desc: "큰 글자, 난독증 친화 글꼴, 넓은 간격, 고대비.",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "AIVO의 모든 화면은 기본으로 WCAG 2.2 AA를 충족합니다. 이 설정으로 필요할 때 더 나아갈 수 있습니다.",
      reassure_labels_title: "같은 제품, 라벨 없음",
      reassure_labels_body:
        "지원을 켠다고 해서 학습자를 다르게 표시하지 않습니다 — 인터페이스는 차분하고 고급스럽게 유지됩니다.",
      reassure_teachers_title: "교사도 이를 존중합니다",
      reassure_teachers_body:
        "여기서 켠 것은 수업, 숙제, AI 튜터에 적용됩니다 — 추가 설정이 필요 없습니다.",
    },
    settings_audio: {
      no_learner_title: "오디오",
      no_learner_body: "오디오 설정을 보려면 학습자로 로그인하세요.",
      eyebrow: "설정",
      title: "소리 내어 읽기",
      description: "음성과 재생 속도를 선택하세요. 소리 내어 읽기를 켤지는 보호자가 제어합니다.",
      voice_kid_friendly: "어린이 친화",
      voice_warm_female: "따뜻한 여성",
      voice_warm_male: "따뜻한 남성",
      voice_calm_neutral: "차분한 중립",
      voice_narrator_low: "내레이터(낮음)",
      voice_narrator_high: "내레이터(높음)",
      enable_label: "이 학습자에게 소리 내어 읽기 사용",
      voice_label: "음성",
      speed_label: "속도: {speed}x",
      captions_label: "항상 자막 표시",
      generating: "생성 중…",
      preview: "음성 미리 듣기",
      save: "저장",
      preview_aria: "음성 미리 듣기",
      no_audio_support: "브라우저가 오디오 재생을 지원하지 않습니다.",
      transcript: "전사",
      preview_unavailable: "오디오 미리 듣기를 사용할 수 없습니다 — 위에 전사가 대체로 표시됩니다.",
      preview_text: "안녕하세요! 소리 내어 읽기 음성 미리 듣기입니다.",
      failed: "실패했습니다.",
      preview_failed: "미리 듣기에 실패했습니다.",
    },
  },

  ar: {
    settings: {
      eyebrow: "الإعدادات",
      title: "اجعل AIVO خاصًّا بك",
      description: "اختر شكل AIVO وصوته وطريقة حديثه إليك.",
      language_title: "اللغة",
      language_desc:
        "سيستخدم AIVO هذه اللغة للأزرار والقوائم ورسائل المساعدة. تبقى دروسك بلغة المادة.",
      a11y_title: "إمكانية الوصول",
      a11y_desc: "نص أكبر، وحركة أقل، وتسميات توضيحية، ومسح بالمفتاح.",
      a11y_link: "فتح إعدادات إمكانية الوصول →",
      sound_title: "الصوت والنطق",
      sound_desc: "اختر صوت المساعدة الذي يستخدمه AIVO لقراءة الأسئلة والملاحظات.",
      sound_link: "فتح إعدادات الصوت →",
    },
    settings_a11y: {
      eyebrow: "الإعدادات · لـ {name}",
      title: "كيف تحبّ أن تتعلّم",
      body: "عدّلها في أي وقت — وستتبعها دروسك. كل خيار مدمج في تجربة AIVO الهادئة، وليس وضعًا منفصلًا أبدًا.",
      card_title: "القراءة والعرض",
      card_desc: "نص كبير، وخط ملائم لعسر القراءة، وتباعد إضافي، وتباين عالٍ.",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "كل شاشة في AIVO تستوفي WCAG 2.2 AA افتراضيًا. وتتيح لك هذه الإعدادات الذهاب أبعد عند الحاجة.",
      reassure_labels_title: "المنتج نفسه، دون تصنيفات",
      reassure_labels_body:
        "تفعيل وسائل الدعم لا يصنّف متعلّمك على أنه مختلف أبدًا — تبقى الواجهة هادئة وراقية.",
      reassure_teachers_title: "المعلّمون يحترمون هذه الإعدادات",
      reassure_teachers_body:
        "كل ما تفعّله هنا يُطبَّق أثناء الدروس والواجبات ومعلّم الذكاء الاصطناعي — دون إعداد إضافي.",
    },
    settings_audio: {
      no_learner_title: "الصوت",
      no_learner_body: "سجّل الدخول كمتعلّم لعرض إعدادات الصوت.",
      eyebrow: "الإعدادات",
      title: "القراءة الجهرية",
      description: "اختر صوتًا وسرعة تشغيل. يتحكّم الشخص البالغ لديك في تشغيل القراءة الجهرية.",
      voice_kid_friendly: "ملائم للأطفال",
      voice_warm_female: "أنثوي دافئ",
      voice_warm_male: "ذكوري دافئ",
      voice_calm_neutral: "محايد هادئ",
      voice_narrator_low: "راوٍ (منخفض)",
      voice_narrator_high: "راوٍ (مرتفع)",
      enable_label: "تفعيل القراءة الجهرية لهذا المتعلّم",
      voice_label: "الصوت",
      speed_label: "السرعة: {speed}x",
      captions_label: "إظهار التسميات التوضيحية دائمًا",
      generating: "جارٍ الإنشاء…",
      preview: "استماع للصوت",
      save: "حفظ",
      preview_aria: "معاينة الصوت",
      no_audio_support: "متصفّحك لا يدعم تشغيل الصوت.",
      transcript: "النص",
      preview_unavailable: "معاينة الصوت غير متاحة — يظهر النص البديل أعلاه.",
      preview_text: "مرحبًا! هذه معاينة صوت القراءة الجهرية الخاص بك.",
      failed: "فشل.",
      preview_failed: "فشلت المعاينة.",
    },
  },

  hi: {
    settings: {
      eyebrow: "सेटिंग्स",
      title: "AIVO को अपना बनाएँ",
      description: "चुनें कि AIVO कैसा दिखे, कैसा सुनाई दे और आपसे कैसे बात करे।",
      language_title: "भाषा",
      language_desc:
        "AIVO बटन, मेन्यू और सहायक संदेशों के लिए इस भाषा का उपयोग करेगा। आपके पाठ विषय की भाषा में ही रहते हैं।",
      a11y_title: "सुलभता",
      a11y_desc: "बड़ा टेक्स्ट, कम मोशन, कैप्शन और स्विच स्कैनिंग।",
      a11y_link: "सुलभता सेटिंग्स खोलें →",
      sound_title: "ध्वनि और आवाज़",
      sound_desc:
        "वह सहायक आवाज़ चुनें जिसका उपयोग AIVO प्रश्न और प्रतिक्रिया पढ़ने के लिए करता है।",
      sound_link: "ध्वनि सेटिंग्स खोलें →",
    },
    settings_a11y: {
      eyebrow: "सेटिंग्स · {name} के लिए",
      title: "आप कैसे सीखना पसंद करते हैं",
      body: "इन्हें कभी भी बदलें — आपके पाठ साथ चलेंगे। हर विकल्प शांत AIVO अनुभव में अंतर्निहित है, कभी कोई अलग मोड नहीं।",
      card_title: "पठन और प्रदर्शन",
      card_desc: "बड़ा टेक्स्ट, डिस्लेक्सिया-अनुकूल फ़ॉन्ट, अतिरिक्त रिक्ति, उच्च कंट्रास्ट।",
      reassure_wcag_title: "WCAG 2.2 AA",
      reassure_wcag_body:
        "AIVO की हर स्क्रीन डिफ़ॉल्ट रूप से WCAG 2.2 AA को पूरा करती है। ये सेटिंग्स ज़रूरत पड़ने पर आपको और आगे ले जाने देती हैं।",
      reassure_labels_title: "वही उत्पाद, कोई लेबल नहीं",
      reassure_labels_body:
        "सहायताएँ चालू करना आपके सीखने वाले को कभी अलग के रूप में चिह्नित नहीं करता — इंटरफ़ेस शांत और प्रीमियम बना रहता है।",
      reassure_teachers_title: "शिक्षक इन्हें मानते हैं",
      reassure_teachers_body:
        "आप यहाँ जो भी चालू करते हैं वह पाठों, होमवर्क और AI ट्यूटर के दौरान लागू होता है — कोई अतिरिक्त सेटअप नहीं।",
    },
    settings_audio: {
      no_learner_title: "ऑडियो",
      no_learner_body: "ऑडियो सेटिंग्स देखने के लिए सीखने वाले के रूप में साइन इन करें।",
      eyebrow: "सेटिंग्स",
      title: "ज़ोर से पढ़ना",
      description:
        "एक आवाज़ और प्लेबैक गति चुनें। ज़ोर से पढ़ना चालू है या नहीं, यह आपका बड़ा नियंत्रित करता है।",
      voice_kid_friendly: "बच्चों के अनुकूल",
      voice_warm_female: "गर्मजोश महिला",
      voice_warm_male: "गर्मजोश पुरुष",
      voice_calm_neutral: "शांत तटस्थ",
      voice_narrator_low: "वर्णनकर्ता (निम्न)",
      voice_narrator_high: "वर्णनकर्ता (उच्च)",
      enable_label: "इस सीखने वाले के लिए ज़ोर से पढ़ना सक्षम करें",
      voice_label: "आवाज़",
      speed_label: "गति: {speed}x",
      captions_label: "हमेशा कैप्शन दिखाएँ",
      generating: "उत्पन्न हो रहा है…",
      preview: "आवाज़ सुनें",
      save: "सहेजें",
      preview_aria: "आवाज़ पूर्वावलोकन",
      no_audio_support: "आपका ब्राउज़र ऑडियो प्लेबैक का समर्थन नहीं करता।",
      transcript: "प्रतिलेख",
      preview_unavailable:
        "ऑडियो पूर्वावलोकन अनुपलब्ध — ऊपर प्रतिलेख फ़ॉलबैक के रूप में दिखाया गया है।",
      preview_text: "नमस्ते! यह आपकी ज़ोर-से-पढ़ने वाली आवाज़ का पूर्वावलोकन है।",
      failed: "विफल।",
      preview_failed: "पूर्वावलोकन विफल।",
    },
  },
};

let written = 0;
for (const [locale, learner] of Object.entries(LEARNER)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.learner = { ...(json.learner ?? {}), ...learner };
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(
    `seed-learner-settings-i18n: merged learner settings namespaces → messages/${locale}.json`,
  );
}
console.log(`\nseed-learner-settings-i18n: done — ${written} locale catalogs updated.`);
