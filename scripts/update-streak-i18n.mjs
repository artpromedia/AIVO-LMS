import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MSG_DIR = join(__dirname, "..", "apps", "web", "src", "i18n", "messages");

const TRANSLATIONS = {
  en: {
    streak_preview_title: "{name} is on a {days}-day streak!",
    streak_preview_subtitle_math: "Nova is ready for today's math quest",
    streak_preview_subtitle_reading: "Sage is ready for today's reading adventure",
    streak_preview_subtitle_science: "Spark is ready for today's science experiment",
    streak_preview_subtitle_sel: "Harmony is ready for today's mindful moment",
  },
  es: {
    streak_preview_title: "¡{name} lleva {days} días seguidos!",
    streak_preview_subtitle_math: "Nova está lista para la misión de mates de hoy",
    streak_preview_subtitle_reading: "Sage está lista para la aventura de lectura de hoy",
    streak_preview_subtitle_science: "Spark está listo para el experimento de ciencias de hoy",
    streak_preview_subtitle_sel: "Harmony está lista para el momento consciente de hoy",
  },
  fr: {
    streak_preview_title: "{name} enchaîne {days} jours d'affilée !",
    streak_preview_subtitle_math: "Nova est prête pour la quête maths du jour",
    streak_preview_subtitle_reading: "Sage est prête pour l'aventure lecture du jour",
    streak_preview_subtitle_science: "Spark est prêt pour l'expérience sciences du jour",
    streak_preview_subtitle_sel: "Harmony est prête pour le moment de pleine conscience du jour",
  },
  de: {
    streak_preview_title: "{name} hat eine {days}-Tage-Serie!",
    streak_preview_subtitle_math: "Nova ist bereit für die heutige Mathe-Quest",
    streak_preview_subtitle_reading: "Sage ist bereit für das heutige Lese-Abenteuer",
    streak_preview_subtitle_science: "Spark ist bereit für das heutige Wissenschafts-Experiment",
    streak_preview_subtitle_sel: "Harmony ist bereit für den heutigen Achtsamkeitsmoment",
  },
  ja: {
    streak_preview_title: "{name} は {days} 日連続学習中！",
    streak_preview_subtitle_math: "Nova は今日の算数クエストの準備ができました",
    streak_preview_subtitle_reading: "Sage は今日の読書アドベンチャーの準備ができました",
    streak_preview_subtitle_science: "Spark は今日の科学実験の準備ができました",
    streak_preview_subtitle_sel: "Harmony は今日のマインドフルな時間の準備ができました",
  },
  ko: {
    streak_preview_title: "{name}는 {days}일 연속 학습 중!",
    streak_preview_subtitle_math: "Nova가 오늘의 수학 퀘스트를 준비했어요",
    streak_preview_subtitle_reading: "Sage가 오늘의 독서 모험을 준비했어요",
    streak_preview_subtitle_science: "Spark가 오늘의 과학 실험을 준비했어요",
    streak_preview_subtitle_sel: "Harmony가 오늘의 마음챙김 시간을 준비했어요",
  },
  pt: {
    streak_preview_title: "{name} está em uma sequência de {days} dias!",
    streak_preview_subtitle_math: "Nova está pronta para a missão de matemática de hoje",
    streak_preview_subtitle_reading: "Sage está pronta para a aventura de leitura de hoje",
    streak_preview_subtitle_science: "Spark está pronto para a experiência de ciências de hoje",
    streak_preview_subtitle_sel: "Harmony está pronta para o momento de atenção plena de hoje",
  },
  zh: {
    streak_preview_title: "{name} 已经坚持学习 {days} 天了！",
    streak_preview_subtitle_math: "Nova 已为今天的数学挑战做好准备",
    streak_preview_subtitle_reading: "Sage 已为今天的阅读冒险做好准备",
    streak_preview_subtitle_science: "Spark 已为今天的科学实验做好准备",
    streak_preview_subtitle_sel: "Harmony 已为今天的正念时刻做好准备",
  },
  ar: {
    streak_preview_title: "{name} في سلسلة من {days} يومًا!",
    streak_preview_subtitle_math: "نوفا جاهزة لمهمة الرياضيات اليوم",
    streak_preview_subtitle_reading: "سيج جاهزة لمغامرة القراءة اليوم",
    streak_preview_subtitle_science: "سبارك جاهز لتجربة العلوم اليوم",
    streak_preview_subtitle_sel: "هارموني جاهزة للحظة التأمل اليوم",
  },
  hi: {
    streak_preview_title: "{name} की {days}-दिन की लकीर चल रही है!",
    streak_preview_subtitle_math: "नोवा आज की मैथ क्वेस्ट के लिए तैयार है",
    streak_preview_subtitle_reading: "सेज आज की रीडिंग एडवेंचर के लिए तैयार है",
    streak_preview_subtitle_science: "स्पार्क आज के साइंस एक्सपेरिमेंट के लिए तैयार है",
    streak_preview_subtitle_sel: "हार्मनी आज के माइंडफुल पल के लिए तैयार है",
  },
};

for (const [locale, keys] of Object.entries(TRANSLATIONS)) {
  const file = join(MSG_DIR, `${locale}.json`);
  const json = JSON.parse(readFileSync(file, "utf8"));
  if (!json.auth) {
    console.error(`MISSING auth section in ${locale}.json`);
    continue;
  }
  json.auth.streak_preview_title = keys.streak_preview_title;
  json.auth.streak_preview_subtitle_math = keys.streak_preview_subtitle_math;
  json.auth.streak_preview_subtitle_reading = keys.streak_preview_subtitle_reading;
  json.auth.streak_preview_subtitle_science = keys.streak_preview_subtitle_science;
  json.auth.streak_preview_subtitle_sel = keys.streak_preview_subtitle_sel;
  delete json.auth.streak_preview_subtitle;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`updated ${locale}.json`);
}
