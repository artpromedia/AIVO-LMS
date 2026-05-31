#!/usr/bin/env node
/**
 * seed-MB-es-i18n — translate the remaining Spanish stragglers in the mobile
 * catalog (keys whose es value still equalled the English source). Pure
 * brand/loanword tokens that are legitimately identical (PIN, PDF, Global,
 * "Error", app version, bare {{brand}}) are intentionally left as-is.
 *
 * Run with: node scripts/seed-MB-es-i18n.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const dir = join(repoRoot, "apps/mobile/i18n");

const ES = {
  parentBilling: {
    loading: "Cargando tu suscripción…",
    loadError: "No pudimos cargar tus datos de facturación. Desliza hacia abajo para reintentar.",
    accessDenied: "No tienes permiso para ver esta cuenta de facturación.",
    networkError: "Error de red. Comprueba tu conexión e inténtalo de nuevo.",
    retry: "Reintentar",
    paymentFailedWarning: "Tu último pago no se procesó.",
    updatePaymentMethod: "Actualizar método de pago",
    manageBilling: "Gestionar facturación",
    subscribeToAddTutors: "Suscríbete a un plan de pago para añadir tutores adicionales.",
    resumeSubscription: "Reanudar suscripción",
    trialEndsInDays: "La prueba termina en {{days}} días",
    trialEndsToday: "La prueba termina hoy — añade una tarjeta para mantener el acceso.",
    trialEndsTomorrow: "La prueba termina mañana — añade una tarjeta para mantener el acceso.",
    downgradeToFree: "Cambiar al plan gratuito",
    downgradeAlertTitle: "Cambiar a Gratis",
    downgradeAlertMessage:
      "¿Cancelar tu suscripción actual? El acceso continúa hasta el final del período de facturación.",
    downgradeConfirm: "Cancelar suscripción",
    downgradeScheduled: "Programado",
    downgradeScheduledMessage: "Tu suscripción finalizará al final del período.",
    paymentMethodCardLabel: "{{brand}} terminada en {{last4}}",
    noPaymentMethod: "No hay método de pago registrado.",
    statusTrialing: "Prueba",
    statusActive: "Activa",
    statusPastDue: "Vencida",
    statusUnpaid: "Sin pagar",
    statusCanceled: "Cancelada",
    statusIncomplete: "Incompleta",
    statusIncompleteExpired: "Expirada",
    statusInactive: "Inactiva",
    billingPeriod: "Período de facturación",
    invoiceHistory: "Historial de facturas",
    noInvoices: "Aún no hay facturas.",
    tutorAddons: "Complementos de tutores",
    included: "Incluido",
    remove: "Quitar",
    addonPrice: "+ $4.99/mes",
    cancelSubscription: "Cancelar suscripción",
    cancelAtPeriodEnd: "Se cancela al final del período",
    addedToBill: "{{count}} complemento(s) · ${{price}}/mes",
  },
  parentRecommendations: {
    adjust: "Ajustar",
    adjustValueLabel: "Editar valor propuesto",
    amendValueRequired: "Introduce un valor antes de ajustar.",
  },
};

function deepMerge(t, s) {
  for (const [k, v] of Object.entries(s)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!t[k] || typeof t[k] !== "object") t[k] = {};
      deepMerge(t[k], v);
    } else t[k] = v;
  }
  return t;
}

const file = join(dir, "es.json");
const json = JSON.parse(readFileSync(file, "utf8"));
deepMerge(json, ES);
writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
console.log("seed-MB-es-i18n: done — es.json stragglers translated.");
