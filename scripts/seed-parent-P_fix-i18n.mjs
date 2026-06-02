#!/usr/bin/env node
/**
 * seed-parent-P_fix-i18n — fills three parent namespaces that were wired in
 * page code but never seeded, so they rendered raw key paths to users:
 *   parent/error.tsx                       -> parent.error.*
 *   parent/not-found.tsx                   -> parent.not_found.*
 *   parent/learners/[learnerId]/homework   -> parent.learner_homework.*
 *
 * Also covers body copy on those pages that the extractor's heuristic missed
 * (multi-line JSX text, description props).
 *
 * Re-runnable. Run with: node scripts/seed-parent-P_fix-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const DATA = {
  en: {
    error: {
      eyebrow: "Error",
      heading: "Something went wrong",
      body: "Your learner's data is safe. We hit an unexpected error loading this page. You can retry, or go back to your parent home.",
      reference: "Reference: {digest}",
      retry: "Try again",
      home_link: "Back to parent home",
    },
    not_found: {
      eyebrow: "Not found",
      heading: "We couldn't find that page",
      body: "The link may have moved or the learner is no longer linked to your account. Let's get you back to your home.",
      home_link: "Go to home",
      all_learners: "All learners",
    },
    learner_homework: {
      title: "Homework history",
      description:
        "What your child has been working on with the Homework Helper. Message contents stay between your child and the tutor.",
      empty: "No homework sessions yet.",
      messages_count: "{count} messages",
      status_done: "Done",
      status_open: "Open",
    },
  },
  es: {
    error: {
      eyebrow: "Error",
      heading: "Algo salió mal",
      body: "Los datos de tu estudiante están a salvo. Ocurrió un error inesperado al cargar esta página. Puedes reintentar o volver a tu inicio de padre.",
      reference: "Referencia: {digest}",
      retry: "Reintentar",
      home_link: "Volver al inicio de padre",
    },
    not_found: {
      eyebrow: "No encontrado",
      heading: "No pudimos encontrar esa página",
      body: "Es posible que el enlace se haya movido o que el estudiante ya no esté vinculado a tu cuenta. Te llevamos de vuelta a tu inicio.",
      home_link: "Ir al inicio",
      all_learners: "Todos los estudiantes",
    },
    learner_homework: {
      title: "Historial de tareas",
      description:
        "En qué ha estado trabajando tu hijo con el Asistente de Tareas. El contenido de los mensajes queda entre tu hijo y el tutor.",
      empty: "Aún no hay sesiones de tareas.",
      messages_count: "{count} mensajes",
      status_done: "Hecho",
      status_open: "Abierto",
    },
  },
  fr: {
    error: {
      eyebrow: "Erreur",
      heading: "Une erreur s'est produite",
      body: "Les données de votre apprenant sont en sécurité. Une erreur inattendue est survenue lors du chargement de cette page. Vous pouvez réessayer ou revenir à votre accueil parent.",
      reference: "Référence : {digest}",
      retry: "Réessayer",
      home_link: "Retour à l'accueil parent",
    },
    not_found: {
      eyebrow: "Introuvable",
      heading: "Nous n'avons pas trouvé cette page",
      body: "Le lien a peut-être changé ou l'apprenant n'est plus lié à votre compte. Revenons à votre accueil.",
      home_link: "Aller à l'accueil",
      all_learners: "Tous les apprenants",
    },
    learner_homework: {
      title: "Historique des devoirs",
      description:
        "Ce sur quoi votre enfant a travaillé avec l'Assistant aux devoirs. Le contenu des messages reste entre votre enfant et le tuteur.",
      empty: "Aucune session de devoirs pour le moment.",
      messages_count: "{count} messages",
      status_done: "Terminé",
      status_open: "Ouvert",
    },
  },
  de: {
    error: {
      eyebrow: "Fehler",
      heading: "Etwas ist schiefgelaufen",
      body: "Die Daten Ihres Lernenden sind sicher. Beim Laden dieser Seite ist ein unerwarteter Fehler aufgetreten. Sie können es erneut versuchen oder zu Ihrer Eltern-Startseite zurückkehren.",
      reference: "Referenz: {digest}",
      retry: "Erneut versuchen",
      home_link: "Zurück zur Eltern-Startseite",
    },
    not_found: {
      eyebrow: "Nicht gefunden",
      heading: "Diese Seite konnten wir nicht finden",
      body: "Der Link wurde möglicherweise verschoben oder der Lernende ist nicht mehr mit Ihrem Konto verknüpft. Bringen wir Sie zurück zu Ihrer Startseite.",
      home_link: "Zur Startseite",
      all_learners: "Alle Lernenden",
    },
    learner_homework: {
      title: "Hausaufgabenverlauf",
      description:
        "Woran Ihr Kind mit dem Hausaufgaben-Helfer gearbeitet hat. Die Nachrichteninhalte bleiben zwischen Ihrem Kind und dem Tutor.",
      empty: "Noch keine Hausaufgaben-Sitzungen.",
      messages_count: "{count} Nachrichten",
      status_done: "Erledigt",
      status_open: "Offen",
    },
  },
  pt: {
    error: {
      eyebrow: "Erro",
      heading: "Algo deu errado",
      body: "Os dados do seu aluno estão seguros. Ocorreu um erro inesperado ao carregar esta página. Você pode tentar novamente ou voltar à sua página inicial de responsável.",
      reference: "Referência: {digest}",
      retry: "Tentar novamente",
      home_link: "Voltar ao início do responsável",
    },
    not_found: {
      eyebrow: "Não encontrado",
      heading: "Não encontramos essa página",
      body: "O link pode ter mudado ou o aluno não está mais vinculado à sua conta. Vamos levá-lo de volta ao início.",
      home_link: "Ir para o início",
      all_learners: "Todos os alunos",
    },
    learner_homework: {
      title: "Histórico de lição de casa",
      description:
        "No que seu filho tem trabalhado com o Assistente de Lição de Casa. O conteúdo das mensagens fica entre seu filho e o tutor.",
      empty: "Ainda não há sessões de lição de casa.",
      messages_count: "{count} mensagens",
      status_done: "Concluído",
      status_open: "Aberto",
    },
  },
  zh: {
    error: {
      eyebrow: "错误",
      heading: "出了点问题",
      body: "您孩子的数据是安全的。加载此页面时发生了意外错误。您可以重试，或返回家长主页。",
      reference: "参考编号：{digest}",
      retry: "重试",
      home_link: "返回家长主页",
    },
    not_found: {
      eyebrow: "未找到",
      heading: "我们找不到该页面",
      body: "该链接可能已移动，或该学习者已不再关联到您的账户。让我们带您回到主页。",
      home_link: "前往主页",
      all_learners: "所有学习者",
    },
    learner_homework: {
      title: "作业记录",
      description: "您的孩子在作业助手中所做的内容。消息内容仅在您的孩子与导师之间可见。",
      empty: "还没有作业会话。",
      messages_count: "{count} 条消息",
      status_done: "已完成",
      status_open: "进行中",
    },
  },
  ja: {
    error: {
      eyebrow: "エラー",
      heading: "問題が発生しました",
      body: "お子様のデータは安全です。このページの読み込み中に予期しないエラーが発生しました。再試行するか、保護者ホームに戻ってください。",
      reference: "参照: {digest}",
      retry: "再試行",
      home_link: "保護者ホームに戻る",
    },
    not_found: {
      eyebrow: "見つかりません",
      heading: "そのページが見つかりませんでした",
      body: "リンクが移動したか、学習者がアカウントに関連付けられていない可能性があります。ホームにお戻りください。",
      home_link: "ホームへ移動",
      all_learners: "すべての学習者",
    },
    learner_homework: {
      title: "宿題の履歴",
      description:
        "お子様が宿題ヘルパーで取り組んだ内容です。メッセージの内容はお子様とチューターの間だけに保たれます。",
      empty: "まだ宿題セッションはありません。",
      messages_count: "{count} 件のメッセージ",
      status_done: "完了",
      status_open: "進行中",
    },
  },
  ko: {
    error: {
      eyebrow: "오류",
      heading: "문제가 발생했습니다",
      body: "자녀의 데이터는 안전합니다. 이 페이지를 불러오는 중 예기치 않은 오류가 발생했습니다. 다시 시도하거나 학부모 홈으로 돌아갈 수 있습니다.",
      reference: "참조: {digest}",
      retry: "다시 시도",
      home_link: "학부모 홈으로 돌아가기",
    },
    not_found: {
      eyebrow: "찾을 수 없음",
      heading: "해당 페이지를 찾을 수 없습니다",
      body: "링크가 이동되었거나 학습자가 더 이상 계정에 연결되어 있지 않을 수 있습니다. 홈으로 돌려보내 드리겠습니다.",
      home_link: "홈으로 이동",
      all_learners: "모든 학습자",
    },
    learner_homework: {
      title: "숙제 기록",
      description:
        "자녀가 숙제 도우미와 함께 작업한 내용입니다. 메시지 내용은 자녀와 튜터 사이에만 유지됩니다.",
      empty: "아직 숙제 세션이 없습니다.",
      messages_count: "메시지 {count}개",
      status_done: "완료",
      status_open: "진행 중",
    },
  },
  ar: {
    error: {
      eyebrow: "خطأ",
      heading: "حدث خطأ ما",
      body: "بيانات المتعلّم آمنة. واجهنا خطأً غير متوقع أثناء تحميل هذه الصفحة. يمكنك إعادة المحاولة أو العودة إلى صفحة الوالدين الرئيسية.",
      reference: "المرجع: {digest}",
      retry: "إعادة المحاولة",
      home_link: "العودة إلى صفحة الوالدين الرئيسية",
    },
    not_found: {
      eyebrow: "غير موجود",
      heading: "تعذّر العثور على تلك الصفحة",
      body: "ربما تم نقل الرابط أو لم يعد المتعلّم مرتبطًا بحسابك. لنعدك إلى صفحتك الرئيسية.",
      home_link: "الانتقال إلى الصفحة الرئيسية",
      all_learners: "جميع المتعلّمين",
    },
    learner_homework: {
      title: "سجل الواجبات",
      description:
        "ما كان يعمل عليه طفلك مع مساعد الواجبات. يبقى محتوى الرسائل بين طفلك والمعلّم فقط.",
      empty: "لا توجد جلسات واجبات بعد.",
      messages_count: "{count} رسالة",
      status_done: "مكتمل",
      status_open: "مفتوح",
    },
  },
  hi: {
    error: {
      eyebrow: "त्रुटि",
      heading: "कुछ गलत हो गया",
      body: "आपके सीखने वाले का डेटा सुरक्षित है। इस पृष्ठ को लोड करते समय एक अप्रत्याशित त्रुटि हुई। आप पुनः प्रयास कर सकते हैं, या अपने अभिभावक होम पर वापस जा सकते हैं।",
      reference: "संदर्भ: {digest}",
      retry: "पुनः प्रयास करें",
      home_link: "अभिभावक होम पर वापस जाएँ",
    },
    not_found: {
      eyebrow: "नहीं मिला",
      heading: "हम वह पृष्ठ नहीं ढूँढ़ सके",
      body: "हो सकता है कि लिंक स्थानांतरित हो गया हो या सीखने वाला अब आपके खाते से जुड़ा न हो। चलिए आपको आपके होम पर वापस ले चलते हैं।",
      home_link: "होम पर जाएँ",
      all_learners: "सभी सीखने वाले",
    },
    learner_homework: {
      title: "होमवर्क इतिहास",
      description:
        "आपका बच्चा होमवर्क हेल्पर के साथ किस पर काम कर रहा है। संदेशों की सामग्री आपके बच्चे और ट्यूटर के बीच ही रहती है।",
      empty: "अभी तक कोई होमवर्क सत्र नहीं।",
      messages_count: "{count} संदेश",
      status_done: "पूर्ण",
      status_open: "खुला",
    },
  },
};

let written = 0;
for (const [locale, subtrees] of Object.entries(DATA)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.parent = json.parent ?? {};
  for (const [ns, keys] of Object.entries(subtrees)) {
    json.parent[ns] = { ...(json.parent[ns] ?? {}), ...keys };
  }
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(
    `seed-parent-P_fix-i18n: merged error/not_found/homework keys → messages/${locale}.json`,
  );
}
console.log(`\nseed-parent-P_fix-i18n: done — ${written} locale catalogs updated.`);
