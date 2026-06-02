#!/usr/bin/env node
/**
 * seed-learner-browse-i18n — translator for the lighter learner browse pages.
 *
 * Covers missions, library, rewards, the parent "view as / pick a child"
 * selector, and the learner not-found screen. Adds learner.common (shared
 * eyebrow / no-profile / source) plus per-page namespaces, for all ten
 * locales, preserving other learner.* subtrees.
 *
 *   node scripts/seed-learner-browse-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const DATA = {
  en: {
    common: {
      learner_eyebrow: "Learner",
      no_profile: "No learner profile linked",
      source: "Source: {source}",
    },
    missions: {
      title: "Missions",
      description: "Your active assignments and lessons in progress.",
      from_teacher: "{subject} · from your teacher",
      subject_fallback: "Subject",
      lesson_in_progress: "Lesson in progress",
      continue: "Continue →",
      nothing_waiting: "Nothing waiting",
      nothing_desc: "Head to Today to pick your next mission.",
      go_today: "Go to Today →",
    },
    library: {
      title: "Library",
      description: "Replay lessons you've already finished.",
      nothing_finished: "Nothing finished yet",
      nothing_finished_desc: "Complete a lesson from Today's Mission and it will land here.",
      lesson: "Lesson",
      completed: "completed {date}",
      replay: "Replay →",
    },
    rewards: {
      title: "Rewards",
      description: "Track every chapter you've completed across the quest worlds.",
      open_world: "Open world →",
    },
    select: {
      eyebrow: "View as",
      title: "Pick a child",
      description: "Choose which child's learner experience to view.",
      forbidden: "That learner isn't linked to your account.",
      no_learners: "No learners yet",
      no_learners_desc: "Add a child to your account before viewing the learner experience.",
      add_learner: "Add a learner",
      view_as_aria: "View as {name}",
      age_not_set: "Age not set",
      readiness: "Readiness: {state}",
    },
    not_found: {
      title: "I can't find that one.",
      body: "Let's head back to your home and pick your next mission.",
      cta: "Go to my home",
    },
  },

  es: {
    common: {
      learner_eyebrow: "Estudiante",
      no_profile: "No hay un perfil de estudiante vinculado",
      source: "Fuente: {source}",
    },
    missions: {
      title: "Misiones",
      description: "Tus tareas activas y lecciones en curso.",
      from_teacher: "{subject} · de tu docente",
      subject_fallback: "Materia",
      lesson_in_progress: "Lección en curso",
      continue: "Continuar →",
      nothing_waiting: "Nada pendiente",
      nothing_desc: "Ve a Hoy para elegir tu próxima misión.",
      go_today: "Ir a Hoy →",
    },
    library: {
      title: "Biblioteca",
      description: "Vuelve a reproducir lecciones que ya terminaste.",
      nothing_finished: "Aún no has terminado nada",
      nothing_finished_desc: "Completa una lección desde la misión de hoy y aparecerá aquí.",
      lesson: "Lección",
      completed: "completada el {date}",
      replay: "Repetir →",
    },
    rewards: {
      title: "Recompensas",
      description: "Sigue cada capítulo que has completado en los mundos de aventuras.",
      open_world: "Abrir mundo →",
    },
    select: {
      eyebrow: "Ver como",
      title: "Elige un niño",
      description: "Elige la experiencia de qué niño quieres ver.",
      forbidden: "Ese estudiante no está vinculado a tu cuenta.",
      no_learners: "Aún no hay estudiantes",
      no_learners_desc: "Añade un niño a tu cuenta antes de ver la experiencia del estudiante.",
      add_learner: "Añadir un estudiante",
      view_as_aria: "Ver como {name}",
      age_not_set: "Edad no establecida",
      readiness: "Preparación: {state}",
    },
    not_found: {
      title: "No encuentro eso.",
      body: "Volvamos a tu inicio y elige tu próxima misión.",
      cta: "Ir a mi inicio",
    },
  },

  fr: {
    common: {
      learner_eyebrow: "Apprenant",
      no_profile: "Aucun profil d'apprenant associé",
      source: "Source : {source}",
    },
    missions: {
      title: "Missions",
      description: "Tes devoirs en cours et tes leçons en cours.",
      from_teacher: "{subject} · de ton enseignant",
      subject_fallback: "Matière",
      lesson_in_progress: "Leçon en cours",
      continue: "Continuer →",
      nothing_waiting: "Rien en attente",
      nothing_desc: "Va dans Aujourd'hui pour choisir ta prochaine mission.",
      go_today: "Aller à Aujourd'hui →",
    },
    library: {
      title: "Bibliothèque",
      description: "Rejoue les leçons que tu as déjà terminées.",
      nothing_finished: "Rien de terminé pour l'instant",
      nothing_finished_desc: "Termine une leçon depuis la mission du jour et elle apparaîtra ici.",
      lesson: "Leçon",
      completed: "terminée le {date}",
      replay: "Rejouer →",
    },
    rewards: {
      title: "Récompenses",
      description: "Suis chaque chapitre que tu as terminé dans les mondes de quête.",
      open_world: "Ouvrir le monde →",
    },
    select: {
      eyebrow: "Voir en tant que",
      title: "Choisis un enfant",
      description: "Choisis l'expérience d'apprenant de quel enfant afficher.",
      forbidden: "Cet apprenant n'est pas rattaché à ton compte.",
      no_learners: "Aucun apprenant pour l'instant",
      no_learners_desc: "Ajoute un enfant à ton compte avant d'afficher l'expérience d'apprenant.",
      add_learner: "Ajouter un apprenant",
      view_as_aria: "Voir en tant que {name}",
      age_not_set: "Âge non défini",
      readiness: "Préparation : {state}",
    },
    not_found: {
      title: "Je ne trouve pas ça.",
      body: "Revenons à ton accueil et choisis ta prochaine mission.",
      cta: "Aller à mon accueil",
    },
  },

  de: {
    common: {
      learner_eyebrow: "Lernende/r",
      no_profile: "Kein Lernprofil verknüpft",
      source: "Quelle: {source}",
    },
    missions: {
      title: "Missionen",
      description: "Deine aktiven Aufgaben und laufenden Lektionen.",
      from_teacher: "{subject} · von deiner Lehrkraft",
      subject_fallback: "Fach",
      lesson_in_progress: "Lektion läuft",
      continue: "Fortfahren →",
      nothing_waiting: "Nichts in Wartestellung",
      nothing_desc: "Geh zu Heute, um deine nächste Mission zu wählen.",
      go_today: "Zu Heute →",
    },
    library: {
      title: "Bibliothek",
      description: "Spiele Lektionen erneut, die du schon abgeschlossen hast.",
      nothing_finished: "Noch nichts abgeschlossen",
      nothing_finished_desc:
        "Schließe eine Lektion aus der heutigen Mission ab, dann erscheint sie hier.",
      lesson: "Lektion",
      completed: "abgeschlossen am {date}",
      replay: "Erneut abspielen →",
    },
    rewards: {
      title: "Belohnungen",
      description: "Verfolge jedes Kapitel, das du in den Quest-Welten abgeschlossen hast.",
      open_world: "Welt öffnen →",
    },
    select: {
      eyebrow: "Ansehen als",
      title: "Wähle ein Kind",
      description: "Wähle, wessen Lernenden-Erlebnis du ansehen möchtest.",
      forbidden: "Diese/r Lernende ist nicht mit deinem Konto verknüpft.",
      no_learners: "Noch keine Lernenden",
      no_learners_desc:
        "Füge deinem Konto ein Kind hinzu, bevor du das Lernenden-Erlebnis ansiehst.",
      add_learner: "Lernende/n hinzufügen",
      view_as_aria: "Ansehen als {name}",
      age_not_set: "Alter nicht festgelegt",
      readiness: "Bereitschaft: {state}",
    },
    not_found: {
      title: "Das finde ich nicht.",
      body: "Gehen wir zurück zu deiner Startseite und wähle deine nächste Mission.",
      cta: "Zu meiner Startseite",
    },
  },

  pt: {
    common: {
      learner_eyebrow: "Aluno",
      no_profile: "Nenhum perfil de aluno vinculado",
      source: "Fonte: {source}",
    },
    missions: {
      title: "Missões",
      description: "Suas tarefas ativas e lições em andamento.",
      from_teacher: "{subject} · do seu professor",
      subject_fallback: "Matéria",
      lesson_in_progress: "Lição em andamento",
      continue: "Continuar →",
      nothing_waiting: "Nada esperando",
      nothing_desc: "Vá para Hoje e escolha sua próxima missão.",
      go_today: "Ir para Hoje →",
    },
    library: {
      title: "Biblioteca",
      description: "Reproduza de novo lições que você já terminou.",
      nothing_finished: "Nada terminado ainda",
      nothing_finished_desc: "Conclua uma lição da missão de hoje e ela aparecerá aqui.",
      lesson: "Lição",
      completed: "concluída em {date}",
      replay: "Repetir →",
    },
    rewards: {
      title: "Recompensas",
      description: "Acompanhe cada capítulo que você concluiu nos mundos de aventura.",
      open_world: "Abrir mundo →",
    },
    select: {
      eyebrow: "Ver como",
      title: "Escolha uma criança",
      description: "Escolha a experiência de aluno de qual criança visualizar.",
      forbidden: "Esse aluno não está vinculado à sua conta.",
      no_learners: "Ainda não há alunos",
      no_learners_desc: "Adicione uma criança à sua conta antes de ver a experiência do aluno.",
      add_learner: "Adicionar um aluno",
      view_as_aria: "Ver como {name}",
      age_not_set: "Idade não definida",
      readiness: "Prontidão: {state}",
    },
    not_found: {
      title: "Não consigo encontrar isso.",
      body: "Vamos voltar ao seu início e escolher sua próxima missão.",
      cta: "Ir para meu início",
    },
  },

  zh: {
    common: { learner_eyebrow: "学习者", no_profile: "未关联学习者档案", source: "来源：{source}" },
    missions: {
      title: "任务",
      description: "你正在进行的作业和课程。",
      from_teacher: "{subject} · 来自你的老师",
      subject_fallback: "学科",
      lesson_in_progress: "课程进行中",
      continue: "继续 →",
      nothing_waiting: "没有待办",
      nothing_desc: "前往「今天」挑选你的下一个任务。",
      go_today: "前往今天 →",
    },
    library: {
      title: "图书馆",
      description: "重温你已经完成的课程。",
      nothing_finished: "还没有完成任何内容",
      nothing_finished_desc: "完成「今日任务」中的一节课，它就会出现在这里。",
      lesson: "课程",
      completed: "完成于 {date}",
      replay: "重玩 →",
    },
    rewards: {
      title: "奖励",
      description: "追踪你在各个任务世界中完成的每一章。",
      open_world: "打开世界 →",
    },
    select: {
      eyebrow: "查看身份",
      title: "选择一个孩子",
      description: "选择要查看哪个孩子的学习者体验。",
      forbidden: "该学习者未关联到你的账户。",
      no_learners: "还没有学习者",
      no_learners_desc: "在查看学习者体验之前，请先把一个孩子添加到你的账户。",
      add_learner: "添加学习者",
      view_as_aria: "以 {name} 的身份查看",
      age_not_set: "年龄未设置",
      readiness: "准备情况：{state}",
    },
    not_found: {
      title: "我找不到那个。",
      body: "我们回到你的主页，挑选下一个任务吧。",
      cta: "前往我的主页",
    },
  },

  ja: {
    common: {
      learner_eyebrow: "学習者",
      no_profile: "学習者プロフィールが関連付けられていません",
      source: "ソース：{source}",
    },
    missions: {
      title: "ミッション",
      description: "進行中の課題とレッスン。",
      from_teacher: "{subject} · 先生から",
      subject_fallback: "教科",
      lesson_in_progress: "レッスン進行中",
      continue: "続ける →",
      nothing_waiting: "待っているものはありません",
      nothing_desc: "「今日」に行って次のミッションを選ぼう。",
      go_today: "今日へ →",
    },
    library: {
      title: "ライブラリ",
      description: "もう終えたレッスンをもう一度再生しよう。",
      nothing_finished: "まだ何も終えていません",
      nothing_finished_desc: "今日のミッションのレッスンを終えると、ここに表示されます。",
      lesson: "レッスン",
      completed: "{date} に完了",
      replay: "もう一度 →",
    },
    rewards: {
      title: "ごほうび",
      description: "クエストの世界で終えた章をすべて記録します。",
      open_world: "世界を開く →",
    },
    select: {
      eyebrow: "表示の切り替え",
      title: "お子さまを選ぶ",
      description: "どのお子さまの学習者体験を表示するか選びます。",
      forbidden: "その学習者はあなたのアカウントに関連付けられていません。",
      no_learners: "まだ学習者がいません",
      no_learners_desc: "学習者体験を表示する前に、お子さまをアカウントに追加してください。",
      add_learner: "学習者を追加",
      view_as_aria: "{name} として表示",
      age_not_set: "年齢未設定",
      readiness: "準備状況：{state}",
    },
    not_found: {
      title: "それが見つかりません。",
      body: "ホームに戻って、次のミッションを選ぼう。",
      cta: "マイホームへ",
    },
  },

  ko: {
    common: {
      learner_eyebrow: "학습자",
      no_profile: "연결된 학습자 프로필이 없습니다",
      source: "출처: {source}",
    },
    missions: {
      title: "미션",
      description: "진행 중인 과제와 수업.",
      from_teacher: "{subject} · 선생님이 보냄",
      subject_fallback: "과목",
      lesson_in_progress: "수업 진행 중",
      continue: "계속 →",
      nothing_waiting: "대기 중인 것이 없어",
      nothing_desc: "'오늘'로 가서 다음 미션을 골라.",
      go_today: "오늘로 가기 →",
    },
    library: {
      title: "라이브러리",
      description: "이미 끝낸 수업을 다시 재생해.",
      nothing_finished: "아직 끝낸 게 없어",
      nothing_finished_desc: "오늘의 미션에서 수업을 완료하면 여기에 나타나.",
      lesson: "수업",
      completed: "{date}에 완료",
      replay: "다시 보기 →",
    },
    rewards: {
      title: "보상",
      description: "퀘스트 세계에서 완료한 모든 챕터를 추적해.",
      open_world: "세계 열기 →",
    },
    select: {
      eyebrow: "다음으로 보기",
      title: "아이 선택",
      description: "어느 아이의 학습자 경험을 볼지 선택하세요.",
      forbidden: "그 학습자는 귀하의 계정에 연결되어 있지 않습니다.",
      no_learners: "아직 학습자가 없습니다",
      no_learners_desc: "학습자 경험을 보기 전에 계정에 아이를 추가하세요.",
      add_learner: "학습자 추가",
      view_as_aria: "{name}(으)로 보기",
      age_not_set: "나이 미설정",
      readiness: "준비 상태: {state}",
    },
    not_found: {
      title: "그건 찾을 수 없어.",
      body: "홈으로 돌아가서 다음 미션을 고르자.",
      cta: "내 홈으로",
    },
  },

  ar: {
    common: {
      learner_eyebrow: "المتعلّم",
      no_profile: "لا يوجد ملف متعلّم مرتبط",
      source: "المصدر: {source}",
    },
    missions: {
      title: "المهام",
      description: "واجباتك النشطة ودروسك الجارية.",
      from_teacher: "{subject} · من معلّمك",
      subject_fallback: "المادة",
      lesson_in_progress: "درس قيد التقدّم",
      continue: "متابعة →",
      nothing_waiting: "لا شيء في الانتظار",
      nothing_desc: "اذهب إلى «اليوم» لتختار مهمتك التالية.",
      go_today: "الذهاب إلى اليوم →",
    },
    library: {
      title: "المكتبة",
      description: "أعد تشغيل الدروس التي أنهيتها بالفعل.",
      nothing_finished: "لم تُنهِ شيئًا بعد",
      nothing_finished_desc: "أكمل درسًا من مهمة اليوم وسيظهر هنا.",
      lesson: "درس",
      completed: "اكتمل في {date}",
      replay: "إعادة →",
    },
    rewards: {
      title: "المكافآت",
      description: "تتبّع كل فصل أنهيته عبر عوالم المغامرات.",
      open_world: "فتح العالم →",
    },
    select: {
      eyebrow: "العرض بصفة",
      title: "اختر طفلًا",
      description: "اختر تجربة المتعلّم لأي طفل تريد عرضها.",
      forbidden: "هذا المتعلّم غير مرتبط بحسابك.",
      no_learners: "لا يوجد متعلّمون بعد",
      no_learners_desc: "أضف طفلًا إلى حسابك قبل عرض تجربة المتعلّم.",
      add_learner: "إضافة متعلّم",
      view_as_aria: "العرض بصفة {name}",
      age_not_set: "العمر غير محدّد",
      readiness: "الجاهزية: {state}",
    },
    not_found: {
      title: "لا أستطيع العثور على ذلك.",
      body: "لنعد إلى صفحتك الرئيسية ونختر مهمتك التالية.",
      cta: "الذهاب إلى صفحتي الرئيسية",
    },
  },

  hi: {
    common: {
      learner_eyebrow: "सीखने वाला",
      no_profile: "कोई सीखने वाला प्रोफ़ाइल लिंक नहीं है",
      source: "स्रोत: {source}",
    },
    missions: {
      title: "मिशन",
      description: "तुम्हारे सक्रिय असाइनमेंट और चल रहे पाठ।",
      from_teacher: "{subject} · तुम्हारे शिक्षक से",
      subject_fallback: "विषय",
      lesson_in_progress: "पाठ जारी है",
      continue: "जारी रखें →",
      nothing_waiting: "कुछ भी प्रतीक्षा में नहीं",
      nothing_desc: "अपना अगला मिशन चुनने के लिए «आज» पर जाओ।",
      go_today: "आज पर जाएँ →",
    },
    library: {
      title: "लाइब्रेरी",
      description: "जो पाठ तुम पहले ही पूरे कर चुके हो उन्हें फिर से चलाओ।",
      nothing_finished: "अभी कुछ भी पूरा नहीं हुआ",
      nothing_finished_desc: "आज के मिशन से एक पाठ पूरा करो और वह यहाँ आ जाएगा।",
      lesson: "पाठ",
      completed: "{date} को पूरा हुआ",
      replay: "फिर से चलाएँ →",
    },
    rewards: {
      title: "पुरस्कार",
      description: "क्वेस्ट दुनियाओं में तुमने जो भी अध्याय पूरे किए, उन्हें ट्रैक करो।",
      open_world: "दुनिया खोलें →",
    },
    select: {
      eyebrow: "इस रूप में देखें",
      title: "एक बच्चा चुनें",
      description: "चुनें कि किस बच्चे का सीखने वाला अनुभव देखना है।",
      forbidden: "वह सीखने वाला तुम्हारे खाते से लिंक नहीं है।",
      no_learners: "अभी कोई सीखने वाला नहीं",
      no_learners_desc: "सीखने वाला अनुभव देखने से पहले अपने खाते में एक बच्चा जोड़ें।",
      add_learner: "एक सीखने वाला जोड़ें",
      view_as_aria: "{name} के रूप में देखें",
      age_not_set: "उम्र निर्धारित नहीं",
      readiness: "तैयारी: {state}",
    },
    not_found: {
      title: "मुझे वह नहीं मिल रहा।",
      body: "चलो तुम्हारे होम पर वापस चलें और अगला मिशन चुनें।",
      cta: "मेरे होम पर जाएँ",
    },
  },
};

let written = 0;
for (const [locale, data] of Object.entries(DATA)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.learner = json.learner ?? {};
  json.learner.common = { ...(json.learner.common ?? {}), ...data.common };
  json.learner.missions = data.missions;
  json.learner.library = data.library;
  json.learner.rewards = data.rewards;
  json.learner.select = data.select;
  json.learner.not_found = data.not_found;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(`seed-learner-browse-i18n: merged → messages/${locale}.json`);
}
console.log(`\nseed-learner-browse-i18n: done — ${written} locale catalogs updated.`);
