#!/usr/bin/env node
/* eslint-disable no-console */
// One-off: add the `lti_admin.*` namespace to all 10 web i18n catalogs in a
// parity-safe way. Idempotent — re-running replaces any existing block.
// Run from repo root with: node scripts/add-lti-admin-i18n.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const base = join(here, "..", "apps", "web-v2", "lib", "i18n", "messages");

const en = {
  page: {
    eyebrow: "Integrations",
    title: "LTI 1.3 platforms",
    description: "Register an LMS so its launches are accepted and grades can be written back.",
  },
  fields: {
    label: "Label (optional)",
    issuer: "Issuer",
    client_id: "Client ID",
    jwks_url: "JWKS URL",
    auth_token_url: "Auth token URL",
    auth_login_url: "Auth login URL",
    deployment_id: "Deployment ID (optional)",
  },
  placeholders: {
    label: "Canvas — District",
    issuer: "https://canvas.instructure.com",
    client_id: "10000000000001",
    jwks_url: "https://…/api/lti/security/jwks",
    auth_token_url: "https://…/login/oauth2/token",
    auth_login_url: "https://…/api/lti/authorize_redirect",
    deployment_id: "1:abcdef…",
  },
  actions: {
    register: "Register platform",
    registering: "Registering…",
    edit: "Edit",
    delete: "Delete",
    deleting: "Deleting…",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
  },
  confirm: {
    delete:
      "Delete LTI platform {issuer}? This removes its deployments, contexts, resource links, and AGS line items.",
  },
  errors: {
    load_failed: "Couldn't load registered platforms.",
    register_failed: "Registration failed.",
    update_failed: "Update failed.",
    delete_failed: "Delete failed.",
  },
  ok: {
    registered: "Platform registered.",
    updated: "Platform updated.",
    deleted: "Platform deleted.",
  },
  registered: {
    heading: "Registered platforms",
    loading: "Loading…",
    empty: "No platforms registered yet.",
    client_id_label: "client",
    deployments_label: "Deployments",
  },
};

function merge(overrides) {
  const out = JSON.parse(JSON.stringify(en));
  for (const [section, vals] of Object.entries(overrides)) {
    out[section] = { ...out[section], ...vals };
  }
  return out;
}

const catalogs = {
  en,
  es: merge({
    page: {
      eyebrow: "Integraciones",
      title: "Plataformas LTI 1.3",
      description:
        "Registra un LMS para que se acepten sus lanzamientos y se puedan devolver las calificaciones.",
    },
    fields: { label: "Etiqueta (opcional)", deployment_id: "ID de despliegue (opcional)" },
    actions: {
      register: "Registrar plataforma",
      registering: "Registrando…",
      edit: "Editar",
      delete: "Eliminar",
      deleting: "Eliminando…",
      save: "Guardar",
      saving: "Guardando…",
      cancel: "Cancelar",
    },
    confirm: {
      delete:
        "¿Eliminar la plataforma LTI {issuer}? Se eliminarán sus despliegues, contextos, enlaces de recursos y elementos de línea AGS.",
    },
    errors: {
      load_failed: "No se pudieron cargar las plataformas registradas.",
      register_failed: "Error al registrar.",
      update_failed: "Error al actualizar.",
      delete_failed: "Error al eliminar.",
    },
    ok: {
      registered: "Plataforma registrada.",
      updated: "Plataforma actualizada.",
      deleted: "Plataforma eliminada.",
    },
    registered: {
      heading: "Plataformas registradas",
      loading: "Cargando…",
      empty: "Aún no hay plataformas registradas.",
      client_id_label: "cliente",
      deployments_label: "Despliegues",
    },
  }),
  fr: merge({
    page: {
      eyebrow: "Intégrations",
      title: "Plateformes LTI 1.3",
      description: "Enregistrez un LMS pour accepter ses lancements et renvoyer les notes.",
    },
    fields: { label: "Libellé (optionnel)", deployment_id: "ID de déploiement (optionnel)" },
    actions: {
      register: "Enregistrer la plateforme",
      registering: "Enregistrement…",
      edit: "Modifier",
      delete: "Supprimer",
      deleting: "Suppression…",
      save: "Enregistrer",
      saving: "Enregistrement…",
      cancel: "Annuler",
    },
    confirm: {
      delete:
        "Supprimer la plateforme LTI {issuer} ? Cela supprime ses déploiements, contextes, liens de ressources et lignes AGS.",
    },
    errors: {
      load_failed: "Impossible de charger les plateformes enregistrées.",
      register_failed: "Échec de l'enregistrement.",
      update_failed: "Échec de la mise à jour.",
      delete_failed: "Échec de la suppression.",
    },
    ok: {
      registered: "Plateforme enregistrée.",
      updated: "Plateforme mise à jour.",
      deleted: "Plateforme supprimée.",
    },
    registered: {
      heading: "Plateformes enregistrées",
      loading: "Chargement…",
      empty: "Aucune plateforme enregistrée pour le moment.",
      client_id_label: "client",
      deployments_label: "Déploiements",
    },
  }),
  de: merge({
    page: {
      eyebrow: "Integrationen",
      title: "LTI-1.3-Plattformen",
      description:
        "Registrieren Sie ein LMS, damit dessen Starts akzeptiert werden und Noten zurückgeschrieben werden können.",
    },
    fields: { label: "Bezeichnung (optional)", deployment_id: "Deployment-ID (optional)" },
    actions: {
      register: "Plattform registrieren",
      registering: "Wird registriert…",
      edit: "Bearbeiten",
      delete: "Löschen",
      deleting: "Wird gelöscht…",
      save: "Speichern",
      saving: "Wird gespeichert…",
      cancel: "Abbrechen",
    },
    confirm: {
      delete:
        "LTI-Plattform {issuer} löschen? Dies entfernt deren Deployments, Kontexte, Ressourcen-Links und AGS-Einträge.",
    },
    errors: {
      load_failed: "Registrierte Plattformen konnten nicht geladen werden.",
      register_failed: "Registrierung fehlgeschlagen.",
      update_failed: "Aktualisierung fehlgeschlagen.",
      delete_failed: "Löschen fehlgeschlagen.",
    },
    ok: {
      registered: "Plattform registriert.",
      updated: "Plattform aktualisiert.",
      deleted: "Plattform gelöscht.",
    },
    registered: {
      heading: "Registrierte Plattformen",
      loading: "Wird geladen…",
      empty: "Noch keine Plattformen registriert.",
      client_id_label: "Client",
      deployments_label: "Deployments",
    },
  }),
  pt: merge({
    page: {
      eyebrow: "Integrações",
      title: "Plataformas LTI 1.3",
      description:
        "Registre um LMS para que seus lançamentos sejam aceitos e as notas possam ser devolvidas.",
    },
    fields: { label: "Rótulo (opcional)", deployment_id: "ID de implantação (opcional)" },
    actions: {
      register: "Registrar plataforma",
      registering: "Registrando…",
      edit: "Editar",
      delete: "Excluir",
      deleting: "Excluindo…",
      save: "Salvar",
      saving: "Salvando…",
      cancel: "Cancelar",
    },
    confirm: {
      delete:
        "Excluir a plataforma LTI {issuer}? Isso remove suas implantações, contextos, links de recursos e itens de linha AGS.",
    },
    errors: {
      load_failed: "Não foi possível carregar as plataformas registradas.",
      register_failed: "Falha no registro.",
      update_failed: "Falha na atualização.",
      delete_failed: "Falha na exclusão.",
    },
    ok: {
      registered: "Plataforma registrada.",
      updated: "Plataforma atualizada.",
      deleted: "Plataforma excluída.",
    },
    registered: {
      heading: "Plataformas registradas",
      loading: "Carregando…",
      empty: "Nenhuma plataforma registrada ainda.",
      client_id_label: "cliente",
      deployments_label: "Implantações",
    },
  }),
  ar: merge({
    page: {
      eyebrow: "التكاملات",
      title: "منصات LTI 1.3",
      description: "سجّل نظام إدارة التعلم حتى تُقبل عمليات تشغيله ويمكن إعادة كتابة الدرجات.",
    },
    fields: { label: "تسمية (اختياري)", deployment_id: "معرّف النشر (اختياري)" },
    actions: {
      register: "تسجيل المنصة",
      registering: "جارٍ التسجيل…",
      edit: "تعديل",
      delete: "حذف",
      deleting: "جارٍ الحذف…",
      save: "حفظ",
      saving: "جارٍ الحفظ…",
      cancel: "إلغاء",
    },
    confirm: {
      delete:
        "حذف منصة LTI {issuer}؟ سيؤدي هذا إلى إزالة عمليات النشر والسياقات وروابط الموارد وعناصر سطر AGS الخاصة بها.",
    },
    errors: {
      load_failed: "تعذّر تحميل المنصات المسجلة.",
      register_failed: "فشل التسجيل.",
      update_failed: "فشل التحديث.",
      delete_failed: "فشل الحذف.",
    },
    ok: {
      registered: "تم تسجيل المنصة.",
      updated: "تم تحديث المنصة.",
      deleted: "تم حذف المنصة.",
    },
    registered: {
      heading: "المنصات المسجلة",
      loading: "جارٍ التحميل…",
      empty: "لا توجد منصات مسجلة بعد.",
      client_id_label: "العميل",
      deployments_label: "عمليات النشر",
    },
  }),
  hi: merge({
    page: {
      eyebrow: "एकीकरण",
      title: "LTI 1.3 प्लेटफ़ॉर्म",
      description:
        "एक LMS पंजीकृत करें ताकि उसके लॉन्च स्वीकार किए जाएँ और ग्रेड वापस लिखे जा सकें।",
    },
    fields: { label: "लेबल (वैकल्पिक)", deployment_id: "परिनियोजन ID (वैकल्पिक)" },
    actions: {
      register: "प्लेटफ़ॉर्म पंजीकृत करें",
      registering: "पंजीकरण हो रहा है…",
      edit: "संपादित करें",
      delete: "हटाएँ",
      deleting: "हटाया जा रहा है…",
      save: "सहेजें",
      saving: "सहेजा जा रहा है…",
      cancel: "रद्द करें",
    },
    confirm: {
      delete:
        "LTI प्लेटफ़ॉर्म {issuer} हटाएँ? यह उसके परिनियोजन, संदर्भ, संसाधन लिंक और AGS लाइन आइटम हटा देता है।",
    },
    errors: {
      load_failed: "पंजीकृत प्लेटफ़ॉर्म लोड नहीं हो सके।",
      register_failed: "पंजीकरण विफल।",
      update_failed: "अपडेट विफल।",
      delete_failed: "हटाना विफल।",
    },
    ok: {
      registered: "प्लेटफ़ॉर्म पंजीकृत।",
      updated: "प्लेटफ़ॉर्म अपडेट किया गया।",
      deleted: "प्लेटफ़ॉर्म हटाया गया।",
    },
    registered: {
      heading: "पंजीकृत प्लेटफ़ॉर्म",
      loading: "लोड हो रहा है…",
      empty: "अभी तक कोई प्लेटफ़ॉर्म पंजीकृत नहीं है।",
      client_id_label: "क्लाइंट",
      deployments_label: "परिनियोजन",
    },
  }),
  ja: merge({
    page: {
      eyebrow: "連携",
      title: "LTI 1.3 プラットフォーム",
      description: "LMS を登録して、その起動が受け入れられ、成績を書き戻せるようにします。",
    },
    fields: { label: "ラベル（任意）", deployment_id: "デプロイメント ID（任意）" },
    actions: {
      register: "プラットフォームを登録",
      registering: "登録中…",
      edit: "編集",
      delete: "削除",
      deleting: "削除中…",
      save: "保存",
      saving: "保存中…",
      cancel: "キャンセル",
    },
    confirm: {
      delete:
        "LTI プラットフォーム {issuer} を削除しますか? デプロイメント、コンテキスト、リソースリンク、AGS ラインアイテムが削除されます。",
    },
    errors: {
      load_failed: "登録済みプラットフォームを読み込めませんでした。",
      register_failed: "登録に失敗しました。",
      update_failed: "更新に失敗しました。",
      delete_failed: "削除に失敗しました。",
    },
    ok: {
      registered: "プラットフォームを登録しました。",
      updated: "プラットフォームを更新しました。",
      deleted: "プラットフォームを削除しました。",
    },
    registered: {
      heading: "登録済みプラットフォーム",
      loading: "読み込み中…",
      empty: "まだプラットフォームが登録されていません。",
      client_id_label: "クライアント",
      deployments_label: "デプロイメント",
    },
  }),
  ko: merge({
    page: {
      eyebrow: "통합",
      title: "LTI 1.3 플랫폼",
      description: "LMS를 등록하여 해당 실행이 수락되고 성적을 다시 기록할 수 있도록 합니다.",
    },
    fields: { label: "라벨(선택사항)", deployment_id: "배포 ID(선택사항)" },
    actions: {
      register: "플랫폼 등록",
      registering: "등록 중…",
      edit: "편집",
      delete: "삭제",
      deleting: "삭제 중…",
      save: "저장",
      saving: "저장 중…",
      cancel: "취소",
    },
    confirm: {
      delete:
        "LTI 플랫폼 {issuer}을(를) 삭제하시겠습니까? 해당 배포, 컨텍스트, 리소스 링크 및 AGS 라인 항목이 제거됩니다.",
    },
    errors: {
      load_failed: "등록된 플랫폼을 불러올 수 없습니다.",
      register_failed: "등록에 실패했습니다.",
      update_failed: "업데이트에 실패했습니다.",
      delete_failed: "삭제에 실패했습니다.",
    },
    ok: {
      registered: "플랫폼이 등록되었습니다.",
      updated: "플랫폼이 업데이트되었습니다.",
      deleted: "플랫폼이 삭제되었습니다.",
    },
    registered: {
      heading: "등록된 플랫폼",
      loading: "불러오는 중…",
      empty: "아직 등록된 플랫폼이 없습니다.",
      client_id_label: "클라이언트",
      deployments_label: "배포",
    },
  }),
  zh: merge({
    page: {
      eyebrow: "集成",
      title: "LTI 1.3 平台",
      description: "注册 LMS 以接受其启动并可以回写成绩。",
    },
    fields: { label: "标签（可选）", deployment_id: "部署 ID（可选）" },
    actions: {
      register: "注册平台",
      registering: "注册中…",
      edit: "编辑",
      delete: "删除",
      deleting: "删除中…",
      save: "保存",
      saving: "保存中…",
      cancel: "取消",
    },
    confirm: {
      delete: "删除 LTI 平台 {issuer}？这将删除其部署、上下文、资源链接和 AGS 行项目。",
    },
    errors: {
      load_failed: "无法加载已注册的平台。",
      register_failed: "注册失败。",
      update_failed: "更新失败。",
      delete_failed: "删除失败。",
    },
    ok: {
      registered: "平台已注册。",
      updated: "平台已更新。",
      deleted: "平台已删除。",
    },
    registered: {
      heading: "已注册的平台",
      loading: "加载中…",
      empty: "尚未注册任何平台。",
      client_id_label: "客户端",
      deployments_label: "部署",
    },
  }),
};

const present = readdirSync(base)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));
for (const locale of present) {
  const path = join(base, `${locale}.json`);
  const cat = JSON.parse(readFileSync(path, "utf8"));
  cat.lti_admin = catalogs[locale] ?? catalogs.en;
  writeFileSync(path, JSON.stringify(cat, null, 2) + "\n", "utf8");
  console.log(`wrote ${locale}`);
}
