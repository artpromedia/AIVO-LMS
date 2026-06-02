#!/usr/bin/env node
/**
 * seed-R_mine-i18n — remaining web-v2 strings that live under EXISTING
 * top-level namespaces (learner, brain_clone, onboarding, auth). Deep-merges
 * at the sub-namespace level so curated keys are preserved.
 *
 * Files served:
 *   learner/baseline/[baselineId]/page.tsx -> learner.baseline_runner.*
 *   learner/baseline/page.tsx              -> learner.baseline.back_home
 *   learner/lesson-runs/[lessonRunId]      -> learner.lesson_run.back_to_today
 *   learner/brain-clone/.../awakening      -> brain_clone.skip_animation
 *   onboarding/invite/district/page.tsx    -> onboarding.invite_district.code_placeholder
 *   onboarding/invite/school/page.tsx      -> onboarding.invite_school.code_placeholder
 *   onboarding/signup/page.tsx             -> onboarding.signup.{code_placeholder,name_placeholder}
 *   signup/page.tsx                        -> auth.signup.name_placeholder
 *
 * NOTE: learner/lesson-player-smoke/page.tsx is a dev/test-only surface
 * (notFound() in production) whose smoke-error diagnostics are intentionally
 * left in English, so they are not seeded here.
 *
 * Re-runnable. Run with: node scripts/seed-R_mine-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const DATA = {
  en: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "Exit proctor view",
        ready_title: "One last tap",
        ready_body: "You answered every question. Send your answers when you're ready.",
        finish_baseline: "Finish baseline",
        resume: "Resume",
        stop_for_today: "Stop for today",
        choose_one: "Choose one",
        type_answer: "Type your answer",
      },
      baseline: { back_home: "Back home" },
      lesson_run: { back_to_today: "Back to today" },
    },
    brain_clone: { skip_animation: "Skip animation" },
    onboarding: {
      invite_district: { code_placeholder: "e.g. DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "e.g. SCHOOL-7Q4M-2025" },
      signup: {
        code_placeholder: "e.g. SCHOOL-7Q4M-2025",
        name_placeholder: "First and last name",
      },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  es: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "Salir de la vista de supervisor",
        ready_title: "Un último toque",
        ready_body: "Respondiste todas las preguntas. Envía tus respuestas cuando estés listo.",
        finish_baseline: "Finalizar evaluación inicial",
        resume: "Continuar",
        stop_for_today: "Parar por hoy",
        choose_one: "Elige una",
        type_answer: "Escribe tu respuesta",
      },
      baseline: { back_home: "Volver al inicio" },
      lesson_run: { back_to_today: "Volver a hoy" },
    },
    brain_clone: { skip_animation: "Omitir animación" },
    onboarding: {
      invite_district: { code_placeholder: "p. ej. DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "p. ej. SCHOOL-7Q4M-2025" },
      signup: {
        code_placeholder: "p. ej. SCHOOL-7Q4M-2025",
        name_placeholder: "Nombre y apellidos",
      },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  fr: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "Quitter la vue surveillant",
        ready_title: "Un dernier appui",
        ready_body:
          "Vous avez répondu à toutes les questions. Envoyez vos réponses quand vous êtes prêt.",
        finish_baseline: "Terminer l'évaluation initiale",
        resume: "Reprendre",
        stop_for_today: "Arrêter pour aujourd'hui",
        choose_one: "Choisissez-en une",
        type_answer: "Saisissez votre réponse",
      },
      baseline: { back_home: "Retour à l'accueil" },
      lesson_run: { back_to_today: "Retour à aujourd'hui" },
    },
    brain_clone: { skip_animation: "Passer l'animation" },
    onboarding: {
      invite_district: { code_placeholder: "p. ex. DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "p. ex. SCHOOL-7Q4M-2025" },
      signup: { code_placeholder: "p. ex. SCHOOL-7Q4M-2025", name_placeholder: "Prénom et nom" },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  de: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "Aufsichtsansicht verlassen",
        ready_title: "Ein letzter Tipp",
        ready_body:
          "Sie haben alle Fragen beantwortet. Senden Sie Ihre Antworten, wenn Sie bereit sind.",
        finish_baseline: "Einstufung abschließen",
        resume: "Fortsetzen",
        stop_for_today: "Für heute beenden",
        choose_one: "Wählen Sie eine aus",
        type_answer: "Geben Sie Ihre Antwort ein",
      },
      baseline: { back_home: "Zurück zur Startseite" },
      lesson_run: { back_to_today: "Zurück zu heute" },
    },
    brain_clone: { skip_animation: "Animation überspringen" },
    onboarding: {
      invite_district: { code_placeholder: "z. B. DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "z. B. SCHOOL-7Q4M-2025" },
      signup: { code_placeholder: "z. B. SCHOOL-7Q4M-2025", name_placeholder: "Vor- und Nachname" },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  pt: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "Sair da visão de supervisor",
        ready_title: "Um último toque",
        ready_body:
          "Você respondeu todas as perguntas. Envie suas respostas quando estiver pronto.",
        finish_baseline: "Concluir avaliação inicial",
        resume: "Continuar",
        stop_for_today: "Parar por hoje",
        choose_one: "Escolha uma",
        type_answer: "Digite sua resposta",
      },
      baseline: { back_home: "Voltar ao início" },
      lesson_run: { back_to_today: "Voltar para hoje" },
    },
    brain_clone: { skip_animation: "Pular animação" },
    onboarding: {
      invite_district: { code_placeholder: "ex.: DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "ex.: SCHOOL-7Q4M-2025" },
      signup: { code_placeholder: "ex.: SCHOOL-7Q4M-2025", name_placeholder: "Nome e sobrenome" },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  zh: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "退出监考视图",
        ready_title: "最后一步",
        ready_body: "你已回答所有问题。准备好后即可提交答案。",
        finish_baseline: "完成基线评估",
        resume: "继续",
        stop_for_today: "今天就到这里",
        choose_one: "选择一项",
        type_answer: "输入你的答案",
      },
      baseline: { back_home: "返回主页" },
      lesson_run: { back_to_today: "返回今天" },
    },
    brain_clone: { skip_animation: "跳过动画" },
    onboarding: {
      invite_district: { code_placeholder: "例如 DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "例如 SCHOOL-7Q4M-2025" },
      signup: { code_placeholder: "例如 SCHOOL-7Q4M-2025", name_placeholder: "名和姓" },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  ja: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "監督ビューを終了",
        ready_title: "あと一回タップ",
        ready_body: "すべての質問に回答しました。準備ができたら回答を送信してください。",
        finish_baseline: "ベースラインを完了",
        resume: "再開",
        stop_for_today: "今日はここまで",
        choose_one: "1つ選んでください",
        type_answer: "回答を入力",
      },
      baseline: { back_home: "ホームに戻る" },
      lesson_run: { back_to_today: "今日に戻る" },
    },
    brain_clone: { skip_animation: "アニメーションをスキップ" },
    onboarding: {
      invite_district: { code_placeholder: "例: DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "例: SCHOOL-7Q4M-2025" },
      signup: { code_placeholder: "例: SCHOOL-7Q4M-2025", name_placeholder: "姓名" },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  ko: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "감독 보기 종료",
        ready_title: "마지막 한 번",
        ready_body: "모든 질문에 답했습니다. 준비되면 답안을 제출하세요.",
        finish_baseline: "기초 평가 완료",
        resume: "계속하기",
        stop_for_today: "오늘은 여기까지",
        choose_one: "하나를 선택하세요",
        type_answer: "답을 입력하세요",
      },
      baseline: { back_home: "홈으로 돌아가기" },
      lesson_run: { back_to_today: "오늘로 돌아가기" },
    },
    brain_clone: { skip_animation: "애니메이션 건너뛰기" },
    onboarding: {
      invite_district: { code_placeholder: "예: DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "예: SCHOOL-7Q4M-2025" },
      signup: { code_placeholder: "예: SCHOOL-7Q4M-2025", name_placeholder: "이름과 성" },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  ar: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "الخروج من عرض المراقب",
        ready_title: "نقرة أخيرة",
        ready_body: "لقد أجبت عن كل الأسئلة. أرسل إجاباتك عندما تكون جاهزًا.",
        finish_baseline: "إنهاء التقييم المبدئي",
        resume: "متابعة",
        stop_for_today: "التوقف لهذا اليوم",
        choose_one: "اختر واحدة",
        type_answer: "اكتب إجابتك",
      },
      baseline: { back_home: "العودة إلى الصفحة الرئيسية" },
      lesson_run: { back_to_today: "العودة إلى اليوم" },
    },
    brain_clone: { skip_animation: "تخطّي الرسوم المتحركة" },
    onboarding: {
      invite_district: { code_placeholder: "مثال: DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "مثال: SCHOOL-7Q4M-2025" },
      signup: {
        code_placeholder: "مثال: SCHOOL-7Q4M-2025",
        name_placeholder: "الاسم الأول واسم العائلة",
      },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
  hi: {
    learner: {
      baseline_runner: {
        exit_proctor_view: "प्रॉक्टर व्यू से बाहर निकलें",
        ready_title: "बस एक आख़िरी टैप",
        ready_body: "आपने हर प्रश्न का उत्तर दे दिया। तैयार होने पर अपने उत्तर भेजें।",
        finish_baseline: "बेसलाइन पूरा करें",
        resume: "फिर से शुरू करें",
        stop_for_today: "आज के लिए रोकें",
        choose_one: "एक चुनें",
        type_answer: "अपना उत्तर लिखें",
      },
      baseline: { back_home: "होम पर वापस जाएँ" },
      lesson_run: { back_to_today: "आज पर वापस जाएँ" },
    },
    brain_clone: { skip_animation: "एनिमेशन छोड़ें" },
    onboarding: {
      invite_district: { code_placeholder: "जैसे DISTRICT-9F2L-2025" },
      invite_school: { code_placeholder: "जैसे SCHOOL-7Q4M-2025" },
      signup: { code_placeholder: "जैसे SCHOOL-7Q4M-2025", name_placeholder: "पहला और अंतिम नाम" },
    },
    auth: { signup: { name_placeholder: "Riley Parent" } },
  },
};

// Recursive deep-merge: objects merge, leaf values (strings) overwrite. This
// correctly handles both nested sub-namespaces (learner.baseline_runner.*) and
// flat leaf keys directly under a root (brain_clone.skip_animation).
function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

let written = 0;
for (const [locale, roots] of Object.entries(DATA)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  deepMerge(json, roots);
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(
    `seed-R_mine-i18n: merged remaining existing-namespace keys → messages/${locale}.json`,
  );
}
console.log(`\nseed-R_mine-i18n: done — ${written} locale catalogs updated.`);
