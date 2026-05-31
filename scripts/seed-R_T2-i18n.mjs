#!/usr/bin/env node
/**
 * seed-R_T2-i18n — fills teacher and therapist namespaces extracted in batch R_T2:
 *   teacher/classes/page.tsx             -> teacher.classes.*
 *   teacher/error.tsx                    -> teacher.error.*
 *   teacher/insights/page.tsx            -> teacher.insights.*
 *   teacher/learners/page.tsx            -> teacher.learners.*
 *   teacher/not-found.tsx                -> teacher.not_found.*
 *   teacher/settings/page.tsx            -> teacher.settings.*
 *   therapist/home/page.tsx              -> therapist.home.*
 *   therapist/reports/page.tsx           -> therapist.reports.*
 *   therapist/sessions/page.tsx          -> therapist.sessions.*
 *   therapist/settings/page.tsx          -> therapist.settings.*
 *
 * Re-runnable (deep-merge, never clobbers existing keys).
 * Run with: node scripts/seed-R_T2-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const DATA = {
  en: {
    teacher: {
      classes: {
        title: "Your classes",
        empty_title: "No classes assigned",
      },
      error: {
        eyebrow: "Teacher area",
        heading: "Something went wrong loading this page.",
        body: "Your class data is safe. Retry now or head back to your teacher home.",
        retry: "Try again",
        home_link: "Teacher home",
      },
      insights: {
        title: "Insights",
        empty_title: "No learners in your tenant",
      },
      learners: {
        title: "Your roster",
        empty: "No learners are assigned to you yet.",
      },
      not_found: {
        eyebrow: "Teacher area · 404",
        heading: "We couldn't find that page.",
        body: "The link may have moved, or the learner is no longer enrolled in your class.",
        home_link: "Teacher home",
        classes_link: "My classes",
      },
      settings: {
        title: "Settings",
        signed_in_as: "Signed in as",
      },
    },
    therapist: {
      home: {
        stat_caseload: "Caseload",
        stat_ieps: "IEPs on file",
        quick_links: "Quick links",
        link_sessions: "Sessions →",
        link_reports: "Reports →",
        section_caseload: "Caseload",
        empty_title: "No learners yet",
      },
      reports: {
        title: "Reports",
        empty_title: "No caseload yet",
        focus_label: "Focus:",
        skills_tracked: "Skills tracked",
        avg_score: "Avg score",
      },
      sessions: {
        title: "Sessions",
        empty_no_caseload: "No caseload yet",
        empty_no_sessions: "No sessions logged yet",
      },
      settings: {
        title: "Settings",
        section_profile: "Profile",
        role_label: "Therapist",
        section_notifications: "Notifications",
      },
    },
  },
  es: {
    teacher: {
      classes: {
        title: "Tus clases",
        empty_title: "No tienes clases asignadas",
      },
      error: {
        eyebrow: "Área del docente",
        heading: "Algo salió mal al cargar esta página.",
        body: "Los datos de tu clase están seguros. Vuelve a intentarlo o regresa a tu inicio de docente.",
        retry: "Intentar de nuevo",
        home_link: "Inicio del docente",
      },
      insights: {
        title: "Perspectivas",
        empty_title: "No hay estudiantes en tu espacio",
      },
      learners: {
        title: "Tu lista de estudiantes",
        empty: "Aún no tienes estudiantes asignados.",
      },
      not_found: {
        eyebrow: "Área del docente · 404",
        heading: "No encontramos esa página.",
        body: "Es posible que el enlace haya cambiado o que el estudiante ya no esté inscrito en tu clase.",
        home_link: "Inicio del docente",
        classes_link: "Mis clases",
      },
      settings: {
        title: "Configuración",
        signed_in_as: "Conectado como",
      },
    },
    therapist: {
      home: {
        stat_caseload: "Carga de casos",
        stat_ieps: "IEP registrados",
        quick_links: "Accesos rápidos",
        link_sessions: "Sesiones →",
        link_reports: "Informes →",
        section_caseload: "Carga de casos",
        empty_title: "Aún no hay estudiantes",
      },
      reports: {
        title: "Informes",
        empty_title: "Aún no hay carga de casos",
        focus_label: "Enfoque:",
        skills_tracked: "Habilidades seguidas",
        avg_score: "Puntuación promedio",
      },
      sessions: {
        title: "Sesiones",
        empty_no_caseload: "Aún no hay carga de casos",
        empty_no_sessions: "Aún no hay sesiones registradas",
      },
      settings: {
        title: "Configuración",
        section_profile: "Perfil",
        role_label: "Terapeuta",
        section_notifications: "Notificaciones",
      },
    },
  },
  fr: {
    teacher: {
      classes: {
        title: "Vos classes",
        empty_title: "Aucune classe assignée",
      },
      error: {
        eyebrow: "Espace enseignant",
        heading: "Une erreur s'est produite lors du chargement de cette page.",
        body: "Les données de votre classe sont en sécurité. Réessayez maintenant ou revenez à votre accueil enseignant.",
        retry: "Réessayer",
        home_link: "Accueil enseignant",
      },
      insights: {
        title: "Analyses",
        empty_title: "Aucun apprenant dans votre espace",
      },
      learners: {
        title: "Votre liste d'apprenants",
        empty: "Aucun apprenant ne vous est encore assigné.",
      },
      not_found: {
        eyebrow: "Espace enseignant · 404",
        heading: "Nous n'avons pas trouvé cette page.",
        body: "Le lien a peut-être changé ou l'apprenant n'est plus inscrit dans votre classe.",
        home_link: "Accueil enseignant",
        classes_link: "Mes classes",
      },
      settings: {
        title: "Paramètres",
        signed_in_as: "Connecté en tant que",
      },
    },
    therapist: {
      home: {
        stat_caseload: "Charge de cas",
        stat_ieps: "IEP enregistrés",
        quick_links: "Liens rapides",
        link_sessions: "Séances →",
        link_reports: "Rapports →",
        section_caseload: "Charge de cas",
        empty_title: "Aucun apprenant pour le moment",
      },
      reports: {
        title: "Rapports",
        empty_title: "Aucune charge de cas pour le moment",
        focus_label: "Axe :",
        skills_tracked: "Compétences suivies",
        avg_score: "Score moyen",
      },
      sessions: {
        title: "Séances",
        empty_no_caseload: "Aucune charge de cas pour le moment",
        empty_no_sessions: "Aucune séance enregistrée pour le moment",
      },
      settings: {
        title: "Paramètres",
        section_profile: "Profil",
        role_label: "Thérapeute",
        section_notifications: "Notifications",
      },
    },
  },
  de: {
    teacher: {
      classes: {
        title: "Ihre Klassen",
        empty_title: "Keine Klassen zugewiesen",
      },
      error: {
        eyebrow: "Lehrerbereich",
        heading: "Beim Laden dieser Seite ist ein Fehler aufgetreten.",
        body: "Ihre Klassendaten sind sicher. Versuchen Sie es erneut oder kehren Sie zu Ihrer Lehrerstartseite zurück.",
        retry: "Erneut versuchen",
        home_link: "Lehrerstartseite",
      },
      insights: {
        title: "Einblicke",
        empty_title: "Keine Lernenden in Ihrem Bereich",
      },
      learners: {
        title: "Ihre Schülerliste",
        empty: "Ihnen sind noch keine Lernenden zugewiesen.",
      },
      not_found: {
        eyebrow: "Lehrerbereich · 404",
        heading: "Diese Seite konnten wir nicht finden.",
        body: "Der Link wurde möglicherweise verschoben oder der Lernende ist nicht mehr in Ihrer Klasse eingeschrieben.",
        home_link: "Lehrerstartseite",
        classes_link: "Meine Klassen",
      },
      settings: {
        title: "Einstellungen",
        signed_in_as: "Angemeldet als",
      },
    },
    therapist: {
      home: {
        stat_caseload: "Fallaufkommen",
        stat_ieps: "IEPs erfasst",
        quick_links: "Schnellzugriffe",
        link_sessions: "Sitzungen →",
        link_reports: "Berichte →",
        section_caseload: "Fallaufkommen",
        empty_title: "Noch keine Lernenden",
      },
      reports: {
        title: "Berichte",
        empty_title: "Noch kein Fallaufkommen",
        focus_label: "Schwerpunkt:",
        skills_tracked: "Verfolgte Fähigkeiten",
        avg_score: "Durchschnittliche Punktzahl",
      },
      sessions: {
        title: "Sitzungen",
        empty_no_caseload: "Noch kein Fallaufkommen",
        empty_no_sessions: "Noch keine Sitzungen protokolliert",
      },
      settings: {
        title: "Einstellungen",
        section_profile: "Profil",
        role_label: "Therapeut",
        section_notifications: "Benachrichtigungen",
      },
    },
  },
  pt: {
    teacher: {
      classes: {
        title: "Suas turmas",
        empty_title: "Nenhuma turma atribuída",
      },
      error: {
        eyebrow: "Área do professor",
        heading: "Algo deu errado ao carregar esta página.",
        body: "Os dados da sua turma estão seguros. Tente novamente ou volte para o início do professor.",
        retry: "Tentar novamente",
        home_link: "Início do professor",
      },
      insights: {
        title: "Perspectivas",
        empty_title: "Nenhum aluno no seu espaço",
      },
      learners: {
        title: "Sua lista de alunos",
        empty: "Nenhum aluno foi atribuído a você ainda.",
      },
      not_found: {
        eyebrow: "Área do professor · 404",
        heading: "Não encontramos essa página.",
        body: "O link pode ter mudado ou o aluno não está mais matriculado na sua turma.",
        home_link: "Início do professor",
        classes_link: "Minhas turmas",
      },
      settings: {
        title: "Configurações",
        signed_in_as: "Conectado como",
      },
    },
    therapist: {
      home: {
        stat_caseload: "Carga de casos",
        stat_ieps: "IEPs registrados",
        quick_links: "Acesso rápido",
        link_sessions: "Sessões →",
        link_reports: "Relatórios →",
        section_caseload: "Carga de casos",
        empty_title: "Nenhum aluno ainda",
      },
      reports: {
        title: "Relatórios",
        empty_title: "Nenhuma carga de casos ainda",
        focus_label: "Foco:",
        skills_tracked: "Habilidades monitoradas",
        avg_score: "Pontuação média",
      },
      sessions: {
        title: "Sessões",
        empty_no_caseload: "Nenhuma carga de casos ainda",
        empty_no_sessions: "Nenhuma sessão registrada ainda",
      },
      settings: {
        title: "Configurações",
        section_profile: "Perfil",
        role_label: "Terapeuta",
        section_notifications: "Notificações",
      },
    },
  },
  zh: {
    teacher: {
      classes: {
        title: "您的班级",
        empty_title: "暂无分配班级",
      },
      error: {
        eyebrow: "教师区域",
        heading: "加载此页面时出现错误。",
        body: "您的班级数据是安全的。请重试，或返回教师主页。",
        retry: "重试",
        home_link: "教师主页",
      },
      insights: {
        title: "洞察",
        empty_title: "您的租户中暂无学习者",
      },
      learners: {
        title: "您的学生名单",
        empty: "您目前尚未分配任何学习者。",
      },
      not_found: {
        eyebrow: "教师区域 · 404",
        heading: "找不到该页面。",
        body: "链接可能已更改，或该学习者已不再注册于您的班级。",
        home_link: "教师主页",
        classes_link: "我的班级",
      },
      settings: {
        title: "设置",
        signed_in_as: "当前登录账号",
      },
    },
    therapist: {
      home: {
        stat_caseload: "案例负荷",
        stat_ieps: "已存档 IEP",
        quick_links: "快捷链接",
        link_sessions: "会话 →",
        link_reports: "报告 →",
        section_caseload: "案例负荷",
        empty_title: "暂无学习者",
      },
      reports: {
        title: "报告",
        empty_title: "暂无案例负荷",
        focus_label: "重点：",
        skills_tracked: "已追踪技能",
        avg_score: "平均分",
      },
      sessions: {
        title: "会话",
        empty_no_caseload: "暂无案例负荷",
        empty_no_sessions: "暂无已记录会话",
      },
      settings: {
        title: "设置",
        section_profile: "个人资料",
        role_label: "治疗师",
        section_notifications: "通知",
      },
    },
  },
  ja: {
    teacher: {
      classes: {
        title: "あなたのクラス",
        empty_title: "クラスが割り当てられていません",
      },
      error: {
        eyebrow: "教師エリア",
        heading: "このページの読み込み中にエラーが発生しました。",
        body: "クラスデータは安全です。再試行するか、教師ホームに戻ってください。",
        retry: "再試行",
        home_link: "教師ホーム",
      },
      insights: {
        title: "インサイト",
        empty_title: "テナントに学習者がいません",
      },
      learners: {
        title: "あなたの名簿",
        empty: "まだ学習者が割り当てられていません。",
      },
      not_found: {
        eyebrow: "教師エリア · 404",
        heading: "ページが見つかりませんでした。",
        body: "リンクが変更されたか、その学習者がクラスから退学した可能性があります。",
        home_link: "教師ホーム",
        classes_link: "マイクラス",
      },
      settings: {
        title: "設定",
        signed_in_as: "ログイン中",
      },
    },
    therapist: {
      home: {
        stat_caseload: "ケースロード",
        stat_ieps: "登録済み IEP",
        quick_links: "クイックリンク",
        link_sessions: "セッション →",
        link_reports: "レポート →",
        section_caseload: "ケースロード",
        empty_title: "まだ学習者がいません",
      },
      reports: {
        title: "レポート",
        empty_title: "まだケースロードがありません",
        focus_label: "注力分野：",
        skills_tracked: "追跡中のスキル",
        avg_score: "平均スコア",
      },
      sessions: {
        title: "セッション",
        empty_no_caseload: "まだケースロードがありません",
        empty_no_sessions: "まだセッションが記録されていません",
      },
      settings: {
        title: "設定",
        section_profile: "プロフィール",
        role_label: "セラピスト",
        section_notifications: "通知",
      },
    },
  },
  ko: {
    teacher: {
      classes: {
        title: "내 반",
        empty_title: "배정된 반 없음",
      },
      error: {
        eyebrow: "교사 영역",
        heading: "페이지를 불러오는 중 오류가 발생했습니다.",
        body: "학급 데이터는 안전합니다. 다시 시도하거나 교사 홈으로 돌아가세요.",
        retry: "다시 시도",
        home_link: "교사 홈",
      },
      insights: {
        title: "인사이트",
        empty_title: "테넌트에 학습자가 없습니다",
      },
      learners: {
        title: "내 학생 명단",
        empty: "아직 배정된 학습자가 없습니다.",
      },
      not_found: {
        eyebrow: "교사 영역 · 404",
        heading: "해당 페이지를 찾을 수 없습니다.",
        body: "링크가 변경되었거나 학습자가 더 이상 학급에 등록되어 있지 않을 수 있습니다.",
        home_link: "교사 홈",
        classes_link: "내 반",
      },
      settings: {
        title: "설정",
        signed_in_as: "로그인 계정",
      },
    },
    therapist: {
      home: {
        stat_caseload: "케이스로드",
        stat_ieps: "등록된 IEP",
        quick_links: "빠른 링크",
        link_sessions: "세션 →",
        link_reports: "보고서 →",
        section_caseload: "케이스로드",
        empty_title: "아직 학습자가 없습니다",
      },
      reports: {
        title: "보고서",
        empty_title: "아직 케이스로드가 없습니다",
        focus_label: "집중 영역:",
        skills_tracked: "추적 중인 기술",
        avg_score: "평균 점수",
      },
      sessions: {
        title: "세션",
        empty_no_caseload: "아직 케이스로드가 없습니다",
        empty_no_sessions: "아직 기록된 세션이 없습니다",
      },
      settings: {
        title: "설정",
        section_profile: "프로필",
        role_label: "치료사",
        section_notifications: "알림",
      },
    },
  },
  ar: {
    teacher: {
      classes: {
        title: "فصولك الدراسية",
        empty_title: "لا توجد فصول مُعيَّنة",
      },
      error: {
        eyebrow: "منطقة المعلم",
        heading: "حدث خطأ أثناء تحميل هذه الصفحة.",
        body: "بيانات فصلك الدراسي آمنة. أعد المحاولة الآن أو عد إلى صفحة المعلم الرئيسية.",
        retry: "إعادة المحاولة",
        home_link: "صفحة المعلم الرئيسية",
      },
      insights: {
        title: "رؤى",
        empty_title: "لا يوجد متعلّمون في مساحتك",
      },
      learners: {
        title: "قائمة طلابك",
        empty: "لم يتم تعيين أي متعلّمين لك بعد.",
      },
      not_found: {
        eyebrow: "منطقة المعلم · 404",
        heading: "لم نتمكن من العثور على تلك الصفحة.",
        body: "ربما تغيّر الرابط أو لم يعد المتعلّم مسجّلاً في فصلك.",
        home_link: "صفحة المعلم الرئيسية",
        classes_link: "فصولي الدراسية",
      },
      settings: {
        title: "الإعدادات",
        signed_in_as: "تم تسجيل الدخول بوصفك",
      },
    },
    therapist: {
      home: {
        stat_caseload: "حجم الحالات",
        stat_ieps: "IEP المسجّلة",
        quick_links: "روابط سريعة",
        link_sessions: "الجلسات →",
        link_reports: "التقارير →",
        section_caseload: "حجم الحالات",
        empty_title: "لا يوجد متعلّمون بعد",
      },
      reports: {
        title: "التقارير",
        empty_title: "لا يوجد حجم حالات بعد",
        focus_label: "محور التركيز:",
        skills_tracked: "المهارات المتابَعة",
        avg_score: "متوسط الدرجات",
      },
      sessions: {
        title: "الجلسات",
        empty_no_caseload: "لا يوجد حجم حالات بعد",
        empty_no_sessions: "لم يتم تسجيل أي جلسات بعد",
      },
      settings: {
        title: "الإعدادات",
        section_profile: "الملف الشخصي",
        role_label: "معالج",
        section_notifications: "الإشعارات",
      },
    },
  },
  hi: {
    teacher: {
      classes: {
        title: "आपकी कक्षाएँ",
        empty_title: "कोई कक्षा नहीं सौंपी गई",
      },
      error: {
        eyebrow: "शिक्षक क्षेत्र",
        heading: "इस पृष्ठ को लोड करते समय कुछ गलत हो गया।",
        body: "आपकी कक्षा का डेटा सुरक्षित है। दोबारा प्रयास करें या अपने शिक्षक होम पर वापस जाएँ।",
        retry: "पुनः प्रयास करें",
        home_link: "शिक्षक होम",
      },
      insights: {
        title: "अंतर्दृष्टि",
        empty_title: "आपके टेनेंट में कोई सीखने वाला नहीं",
      },
      learners: {
        title: "आपकी छात्र सूची",
        empty: "अभी तक आपको कोई सीखने वाला नहीं सौंपा गया है।",
      },
      not_found: {
        eyebrow: "शिक्षक क्षेत्र · 404",
        heading: "हम वह पृष्ठ नहीं ढूँढ़ सके।",
        body: "हो सकता है लिंक बदल गया हो, या सीखने वाला अब आपकी कक्षा में नामांकित नहीं है।",
        home_link: "शिक्षक होम",
        classes_link: "मेरी कक्षाएँ",
      },
      settings: {
        title: "सेटिंग्स",
        signed_in_as: "इस रूप में लॉग इन किया",
      },
    },
    therapist: {
      home: {
        stat_caseload: "केसलोड",
        stat_ieps: "दर्ज IEP",
        quick_links: "त्वरित लिंक",
        link_sessions: "सत्र →",
        link_reports: "रिपोर्ट →",
        section_caseload: "केसलोड",
        empty_title: "अभी कोई सीखने वाला नहीं",
      },
      reports: {
        title: "रिपोर्ट",
        empty_title: "अभी कोई केसलोड नहीं",
        focus_label: "फोकस:",
        skills_tracked: "ट्रैक किए गए कौशल",
        avg_score: "औसत स्कोर",
      },
      sessions: {
        title: "सत्र",
        empty_no_caseload: "अभी कोई केसलोड नहीं",
        empty_no_sessions: "अभी तक कोई सत्र दर्ज नहीं हुआ",
      },
      settings: {
        title: "सेटिंग्स",
        section_profile: "प्रोफ़ाइल",
        role_label: "चिकित्सक",
        section_notifications: "सूचनाएँ",
      },
    },
  },
};

let written = 0;
for (const [locale, roots] of Object.entries(DATA)) {
  const file = join(messagesDir, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  for (const [root, subs] of Object.entries(roots)) {
    json[root] = json[root] ?? {};
    for (const [ns, keys] of Object.entries(subs)) {
      json[root][ns] = { ...(json[root][ns] ?? {}), ...keys };
    }
  }
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  written += 1;
  console.log(`seed-R_T2-i18n: merged teacher/therapist keys → messages/${locale}.json`);
}
console.log(`\nseed-R_T2-i18n: done — ${written} locale catalogs updated.`);
