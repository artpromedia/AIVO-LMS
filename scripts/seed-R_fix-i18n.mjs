#!/usr/bin/env node
/**
 * seed-R_fix-i18n — fills namespaces that were wired to t() in page code by
 * earlier work but never seeded, so they rendered raw key paths to users:
 *   admin/platform/billing/coupons/page.tsx     -> admin.platform_billing_coupons.*
 *   admin/platform/billing/daily-batch/page.tsx -> admin.platform_billing_daily_batch.*
 *   admin/platform/billing/invoices/page.tsx    -> admin.platform_billing_invoices.*
 *   teacher/assignments/new/*                    -> teacher.assignments_new.*
 *   teacher/assignments/page.tsx                 -> teacher.assignments.*
 *   teacher/classes/[classId]/page.tsx           -> teacher.classes_class.*
 *
 * Re-runnable. Run with: node scripts/seed-R_fix-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const messagesDir = join(repoRoot, "apps/web-v2/lib/i18n/messages");

const DATA = {
  en: {
    admin: {
      platform_billing_coupons: { title: "Coupons", empty_title: "No coupons yet", col_discount: "Discount", col_applies_to: "Applies to", col_status: "Status", col_redemptions: "Redemptions", col_valid_window: "Valid window" },
      platform_billing_daily_batch: { title: "Daily billing batch", empty_title: "No batch runs yet", col_run_date: "Run date", col_window: "Window", col_status: "Status", col_generated: "Generated", col_failed: "Failed", col_total_billed: "Total billed" },
      platform_billing_invoices: { title: "Invoices", link_revenue_summary: "Revenue summary", stat_total_invoices: "Total invoices", stat_outstanding: "Outstanding", empty_title: "No invoices yet", col_number: "Number", col_tenant: "Tenant", col_amount: "Amount", col_status: "Status", col_period: "Period" },
    },
    teacher: {
      assignments_new: { title: "New assignment", instructions_label: "Instructions", subject_label: "Subject", skills_label: "Skills", assign_label: "Assign to", no_learners: "No learners", due_date_label: "Due date" },
      assignments: { title: "Assignments", new_assignment: "New assignment", empty: "No assignments yet." },
      classes_class: { roster: "Roster", no_learners: "No learners" },
    },
  },
  es: {
    admin: {
      platform_billing_coupons: { title: "Cupones", empty_title: "Aún no hay cupones", col_discount: "Descuento", col_applies_to: "Se aplica a", col_status: "Estado", col_redemptions: "Canjes", col_valid_window: "Periodo de validez" },
      platform_billing_daily_batch: { title: "Lote de facturación diario", empty_title: "Aún no hay ejecuciones de lote", col_run_date: "Fecha de ejecución", col_window: "Ventana", col_status: "Estado", col_generated: "Generadas", col_failed: "Fallidas", col_total_billed: "Total facturado" },
      platform_billing_invoices: { title: "Facturas", link_revenue_summary: "Resumen de ingresos", stat_total_invoices: "Total de facturas", stat_outstanding: "Pendiente", empty_title: "Aún no hay facturas", col_number: "Número", col_tenant: "Inquilino", col_amount: "Importe", col_status: "Estado", col_period: "Periodo" },
    },
    teacher: {
      assignments_new: { title: "Nueva tarea", instructions_label: "Instrucciones", subject_label: "Materia", skills_label: "Habilidades", assign_label: "Asignar a", no_learners: "Sin estudiantes", due_date_label: "Fecha de entrega" },
      assignments: { title: "Tareas", new_assignment: "Nueva tarea", empty: "Aún no hay tareas." },
      classes_class: { roster: "Lista", no_learners: "Sin estudiantes" },
    },
  },
  fr: {
    admin: {
      platform_billing_coupons: { title: "Coupons", empty_title: "Aucun coupon pour le moment", col_discount: "Remise", col_applies_to: "S'applique à", col_status: "Statut", col_redemptions: "Utilisations", col_valid_window: "Période de validité" },
      platform_billing_daily_batch: { title: "Lot de facturation quotidien", empty_title: "Aucune exécution de lot pour le moment", col_run_date: "Date d'exécution", col_window: "Fenêtre", col_status: "Statut", col_generated: "Générées", col_failed: "Échouées", col_total_billed: "Total facturé" },
      platform_billing_invoices: { title: "Factures", link_revenue_summary: "Résumé des revenus", stat_total_invoices: "Total des factures", stat_outstanding: "En attente", empty_title: "Aucune facture pour le moment", col_number: "Numéro", col_tenant: "Locataire", col_amount: "Montant", col_status: "Statut", col_period: "Période" },
    },
    teacher: {
      assignments_new: { title: "Nouveau devoir", instructions_label: "Consignes", subject_label: "Matière", skills_label: "Compétences", assign_label: "Attribuer à", no_learners: "Aucun apprenant", due_date_label: "Date d'échéance" },
      assignments: { title: "Devoirs", new_assignment: "Nouveau devoir", empty: "Aucun devoir pour le moment." },
      classes_class: { roster: "Liste", no_learners: "Aucun apprenant" },
    },
  },
  de: {
    admin: {
      platform_billing_coupons: { title: "Gutscheine", empty_title: "Noch keine Gutscheine", col_discount: "Rabatt", col_applies_to: "Gilt für", col_status: "Status", col_redemptions: "Einlösungen", col_valid_window: "Gültigkeitszeitraum" },
      platform_billing_daily_batch: { title: "Täglicher Abrechnungslauf", empty_title: "Noch keine Lauf-Durchläufe", col_run_date: "Lauf-Datum", col_window: "Zeitfenster", col_status: "Status", col_generated: "Erstellt", col_failed: "Fehlgeschlagen", col_total_billed: "Gesamt abgerechnet" },
      platform_billing_invoices: { title: "Rechnungen", link_revenue_summary: "Umsatzübersicht", stat_total_invoices: "Rechnungen gesamt", stat_outstanding: "Ausstehend", empty_title: "Noch keine Rechnungen", col_number: "Nummer", col_tenant: "Mandant", col_amount: "Betrag", col_status: "Status", col_period: "Zeitraum" },
    },
    teacher: {
      assignments_new: { title: "Neue Aufgabe", instructions_label: "Anweisungen", subject_label: "Fach", skills_label: "Kompetenzen", assign_label: "Zuweisen an", no_learners: "Keine Lernenden", due_date_label: "Fälligkeitsdatum" },
      assignments: { title: "Aufgaben", new_assignment: "Neue Aufgabe", empty: "Noch keine Aufgaben." },
      classes_class: { roster: "Teilnehmerliste", no_learners: "Keine Lernenden" },
    },
  },
  pt: {
    admin: {
      platform_billing_coupons: { title: "Cupons", empty_title: "Ainda não há cupons", col_discount: "Desconto", col_applies_to: "Aplica-se a", col_status: "Status", col_redemptions: "Resgates", col_valid_window: "Período de validade" },
      platform_billing_daily_batch: { title: "Lote de cobrança diário", empty_title: "Ainda não há execuções de lote", col_run_date: "Data de execução", col_window: "Janela", col_status: "Status", col_generated: "Geradas", col_failed: "Falhadas", col_total_billed: "Total faturado" },
      platform_billing_invoices: { title: "Faturas", link_revenue_summary: "Resumo de receita", stat_total_invoices: "Total de faturas", stat_outstanding: "Em aberto", empty_title: "Ainda não há faturas", col_number: "Número", col_tenant: "Inquilino", col_amount: "Valor", col_status: "Status", col_period: "Período" },
    },
    teacher: {
      assignments_new: { title: "Nova tarefa", instructions_label: "Instruções", subject_label: "Disciplina", skills_label: "Habilidades", assign_label: "Atribuir a", no_learners: "Nenhum aluno", due_date_label: "Data de entrega" },
      assignments: { title: "Tarefas", new_assignment: "Nova tarefa", empty: "Ainda não há tarefas." },
      classes_class: { roster: "Lista de turma", no_learners: "Nenhum aluno" },
    },
  },
  zh: {
    admin: {
      platform_billing_coupons: { title: "优惠券", empty_title: "暂无优惠券", col_discount: "折扣", col_applies_to: "适用于", col_status: "状态", col_redemptions: "兑换次数", col_valid_window: "有效期" },
      platform_billing_daily_batch: { title: "每日计费批处理", empty_title: "暂无批处理运行", col_run_date: "运行日期", col_window: "时间窗口", col_status: "状态", col_generated: "已生成", col_failed: "失败", col_total_billed: "计费总额" },
      platform_billing_invoices: { title: "发票", link_revenue_summary: "收入摘要", stat_total_invoices: "发票总数", stat_outstanding: "未结清", empty_title: "暂无发票", col_number: "编号", col_tenant: "租户", col_amount: "金额", col_status: "状态", col_period: "周期" },
    },
    teacher: {
      assignments_new: { title: "新作业", instructions_label: "说明", subject_label: "科目", skills_label: "技能", assign_label: "分配给", no_learners: "没有学习者", due_date_label: "截止日期" },
      assignments: { title: "作业", new_assignment: "新作业", empty: "暂无作业。" },
      classes_class: { roster: "名单", no_learners: "没有学习者" },
    },
  },
  ja: {
    admin: {
      platform_billing_coupons: { title: "クーポン", empty_title: "まだクーポンはありません", col_discount: "割引", col_applies_to: "適用対象", col_status: "ステータス", col_redemptions: "利用回数", col_valid_window: "有効期間" },
      platform_billing_daily_batch: { title: "日次請求バッチ", empty_title: "まだバッチ実行はありません", col_run_date: "実行日", col_window: "期間", col_status: "ステータス", col_generated: "生成数", col_failed: "失敗数", col_total_billed: "請求合計" },
      platform_billing_invoices: { title: "請求書", link_revenue_summary: "収益サマリー", stat_total_invoices: "請求書総数", stat_outstanding: "未払い", empty_title: "まだ請求書はありません", col_number: "番号", col_tenant: "テナント", col_amount: "金額", col_status: "ステータス", col_period: "期間" },
    },
    teacher: {
      assignments_new: { title: "新しい課題", instructions_label: "指示", subject_label: "教科", skills_label: "スキル", assign_label: "割り当て先", no_learners: "学習者がいません", due_date_label: "期限" },
      assignments: { title: "課題", new_assignment: "新しい課題", empty: "まだ課題はありません。" },
      classes_class: { roster: "名簿", no_learners: "学習者がいません" },
    },
  },
  ko: {
    admin: {
      platform_billing_coupons: { title: "쿠폰", empty_title: "아직 쿠폰이 없습니다", col_discount: "할인", col_applies_to: "적용 대상", col_status: "상태", col_redemptions: "사용 횟수", col_valid_window: "유효 기간" },
      platform_billing_daily_batch: { title: "일일 청구 배치", empty_title: "아직 배치 실행이 없습니다", col_run_date: "실행 날짜", col_window: "기간", col_status: "상태", col_generated: "생성됨", col_failed: "실패", col_total_billed: "총 청구액" },
      platform_billing_invoices: { title: "인보이스", link_revenue_summary: "수익 요약", stat_total_invoices: "총 인보이스", stat_outstanding: "미결제", empty_title: "아직 인보이스가 없습니다", col_number: "번호", col_tenant: "테넌트", col_amount: "금액", col_status: "상태", col_period: "기간" },
    },
    teacher: {
      assignments_new: { title: "새 과제", instructions_label: "안내", subject_label: "과목", skills_label: "역량", assign_label: "배정 대상", no_learners: "학습자 없음", due_date_label: "마감일" },
      assignments: { title: "과제", new_assignment: "새 과제", empty: "아직 과제가 없습니다." },
      classes_class: { roster: "명단", no_learners: "학습자 없음" },
    },
  },
  ar: {
    admin: {
      platform_billing_coupons: { title: "القسائم", empty_title: "لا توجد قسائم بعد", col_discount: "الخصم", col_applies_to: "ينطبق على", col_status: "الحالة", col_redemptions: "الاستخدامات", col_valid_window: "فترة الصلاحية" },
      platform_billing_daily_batch: { title: "دفعة الفوترة اليومية", empty_title: "لا توجد عمليات تشغيل بعد", col_run_date: "تاريخ التشغيل", col_window: "النافذة", col_status: "الحالة", col_generated: "تم إنشاؤها", col_failed: "فشلت", col_total_billed: "إجمالي الفوترة" },
      platform_billing_invoices: { title: "الفواتير", link_revenue_summary: "ملخص الإيرادات", stat_total_invoices: "إجمالي الفواتير", stat_outstanding: "غير مسددة", empty_title: "لا توجد فواتير بعد", col_number: "الرقم", col_tenant: "المستأجر", col_amount: "المبلغ", col_status: "الحالة", col_period: "الفترة" },
    },
    teacher: {
      assignments_new: { title: "مهمة جديدة", instructions_label: "التعليمات", subject_label: "المادة", skills_label: "المهارات", assign_label: "إسناد إلى", no_learners: "لا يوجد متعلّمون", due_date_label: "تاريخ الاستحقاق" },
      assignments: { title: "المهام", new_assignment: "مهمة جديدة", empty: "لا توجد مهام بعد." },
      classes_class: { roster: "قائمة الطلاب", no_learners: "لا يوجد متعلّمون" },
    },
  },
  hi: {
    admin: {
      platform_billing_coupons: { title: "कूपन", empty_title: "अभी कोई कूपन नहीं", col_discount: "छूट", col_applies_to: "लागू होता है", col_status: "स्थिति", col_redemptions: "मोचन", col_valid_window: "वैधता अवधि" },
      platform_billing_daily_batch: { title: "दैनिक बिलिंग बैच", empty_title: "अभी कोई बैच रन नहीं", col_run_date: "रन तिथि", col_window: "विंडो", col_status: "स्थिति", col_generated: "जनरेट हुए", col_failed: "विफल", col_total_billed: "कुल बिल" },
      platform_billing_invoices: { title: "चालान", link_revenue_summary: "राजस्व सारांश", stat_total_invoices: "कुल चालान", stat_outstanding: "बकाया", empty_title: "अभी कोई चालान नहीं", col_number: "संख्या", col_tenant: "टेनेंट", col_amount: "राशि", col_status: "स्थिति", col_period: "अवधि" },
    },
    teacher: {
      assignments_new: { title: "नया असाइनमेंट", instructions_label: "निर्देश", subject_label: "विषय", skills_label: "कौशल", assign_label: "इन्हें सौंपें", no_learners: "कोई सीखने वाला नहीं", due_date_label: "नियत तिथि" },
      assignments: { title: "असाइनमेंट", new_assignment: "नया असाइनमेंट", empty: "अभी कोई असाइनमेंट नहीं।" },
      classes_class: { roster: "रोस्टर", no_learners: "कोई सीखने वाला नहीं" },
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
  console.log(`seed-R_fix-i18n: merged unseeded billing/assignment keys → messages/${locale}.json`);
}
console.log(`\nseed-R_fix-i18n: done — ${written} locale catalogs updated.`);
