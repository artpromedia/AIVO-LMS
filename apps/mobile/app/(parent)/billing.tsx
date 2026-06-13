import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type TutorSku } from "@aivo/billing-entitlements";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  priceLabel?: string;
  learnerLimit: number;
  features: string[];
}

type SubStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "inactive";

interface Subscription {
  plan: string;
  status: SubStatus;
  paymentStatus?: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer?: boolean;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  paymentMethod?: { brand: string | null; last4: string | null } | null;
}

interface Entitlements {
  plan: string;
  status: string;
  includedTutorSkus: TutorSku[];
  purchasedTutorSkus: TutorSku[];
  effectiveTutorSkus: TutorSku[];
}

interface Invoice {
  id: string;
  number?: string;
  status: string;
  amount: number;
  date?: string | null;
  url?: string | null;
}

function describeTrialDays(
  trialEndsAt: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end) || end <= now) return null;
  return Math.floor((end - now) / (24 * 60 * 60 * 1000));
}

function statusLabel(
  t: (k: string) => string,
  status: SubStatus,
  cancelAtPeriodEnd: boolean,
): string {
  if (cancelAtPeriodEnd) return t("parentBilling.cancelAtPeriodEnd");
  switch (status) {
    case "trialing":
      return t("parentBilling.statusTrialing");
    case "active":
      return t("parentBilling.statusActive");
    case "past_due":
      return t("parentBilling.statusPastDue");
    case "unpaid":
      return t("parentBilling.statusUnpaid");
    case "canceled":
      return t("parentBilling.statusCanceled");
    case "incomplete":
      return t("parentBilling.statusIncomplete");
    case "incomplete_expired":
      return t("parentBilling.statusIncompleteExpired");
    default:
      return t("parentBilling.statusInactive");
  }
}

function statusColor(status: SubStatus, cancelAtPeriodEnd: boolean): string {
  if (cancelAtPeriodEnd) return colors.warning ?? colors.textSecondary;
  switch (status) {
    case "trialing":
      return colors.primary;
    case "active":
      return colors.success;
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return colors.error;
    case "canceled":
      return colors.textSecondary;
    default:
      return colors.textSecondary;
  }
}

function BillingSkeleton() {
  return (
    <View style={{ paddingTop: spacing.lg, gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeletonCard, { height: 120 + i * 20 }]} />
      ))}
    </View>
  );
}

export default function BillingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId || "";
  const { sizeClass, width: winWidth } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const contentWidth = Math.min(winWidth - hPad * 2, CONTENT_MAX_WIDTH.reading);

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const plansQuery = useQuery<{ plans: Plan[] }>({
    queryKey: ["billing-plans"],
    queryFn: async () => {
      const res = await apiFetch(API.BILLING, "/api/billing/plans", { skipAuth: true });
      if (!res.ok) throw new Error("plans");
      return res.json();
    },
  });

  const subscriptionQuery = useQuery<Subscription>({
    queryKey: ["billing-subscription", tenantId],
    queryFn: async () => {
      const res = await apiFetch(API.BILLING, `/api/billing/subscription/${tenantId}`);
      if (res.status === 403) {
        const e: any = new Error("forbidden");
        e.status = 403;
        throw e;
      }
      if (!res.ok) throw new Error("subscription");
      return res.json();
    },
    enabled: !!tenantId,
    retry: (count, err: any) => err?.status !== 403 && count < 1,
  });

  const entitlementsQuery = useQuery<Entitlements>({
    queryKey: ["billing-entitlements", tenantId],
    queryFn: async () => {
      const res = await apiFetch(API.BILLING, `/api/billing/entitlements/${tenantId}`);
      if (!res.ok) throw new Error("entitlements");
      return res.json();
    },
    enabled: !!tenantId,
  });

  const invoicesQuery = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["billing-invoices", tenantId],
    queryFn: async () => {
      const res = await apiFetch(API.BILLING, `/api/billing/invoices/${tenantId}`);
      if (!res.ok) throw new Error("invoices");
      return res.json();
    },
    enabled: !!tenantId,
  });

  const refetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing-subscription", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["billing-entitlements", tenantId] }),
        queryClient.invalidateQueries({ queryKey: ["billing-invoices", tenantId] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [tenantId, queryClient]);

  const subscription = subscriptionQuery.data;
  const invoices = invoicesQuery.data?.invoices ?? [];
  const plans = plansQuery.data?.plans ?? [];
  const currentPlanId = subscription?.plan || "none";
  const paymentFailed =
    subscription?.paymentStatus === "failed" || subscription?.status === "past_due";
  const incomplete =
    subscription?.status === "incomplete" || subscription?.status === "incomplete_expired";
  const trialDays = describeTrialDays(subscription?.trialEndsAt);

  const launchCheckout = useCallback(
    async (planId: string, planName: string) => {
      setCheckoutLoading(planId);
      try {
        const res = await apiFetch(API.BILLING, "/api/billing/checkout/session", {
          method: "POST",
          // termsAccepted records the parent's agreement to the per-child
          // subscription terms ($39.99/mo per child after the 30-day trial).
          body: JSON.stringify({ tenantId, planId, termsAccepted: true }),
        });
        const data = await res.json();
        if (res.ok && data.checkoutUrl) {
          await WebBrowser.openBrowserAsync(data.checkoutUrl);
          refetchAll();
        } else {
          Alert.alert(t("common.error"), data.error || `Could not start checkout for ${planName}`);
        }
      } catch {
        Alert.alert(t("common.error"), t("parentBilling.networkError"));
      } finally {
        setCheckoutLoading(null);
      }
    },
    [tenantId, t, refetchAll],
  );

  const startCheckout = useCallback(
    async (planId: string, planName: string) => {
      // Enterprise (and the legacy "district") is a contract sale.
      if (planId === "enterprise" || planId === "district") {
        Alert.alert(
          t("parentBilling.contactSales"),
          "Enterprise plans are set up with your school or district. Please contact sales@aivolearning.com.",
        );
        return;
      }
      // Family: require explicit agreement to the per-child terms before we
      // start a (trialing) subscription that bills $39.99/mo per child.
      Alert.alert(t("parentBilling.termsTitle"), t("parentBilling.termsMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("parentBilling.termsAgree"),
          onPress: () => launchCheckout(planId, planName),
        },
      ]);
    },
    [t, launchCheckout],
  );

  const openPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const res = await apiFetch(API.BILLING, "/api/billing/portal/session", {
        method: "POST",
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (res.ok && data.portalUrl) {
        await WebBrowser.openBrowserAsync(data.portalUrl);
        refetchAll();
      } else {
        Alert.alert(t("common.error"), data.error || "Could not open billing portal");
      }
    } catch {
      Alert.alert(t("common.error"), t("parentBilling.networkError"));
    } finally {
      setPortalLoading(false);
    }
  }, [tenantId, t, refetchAll]);

  const handleResume = useCallback(async () => {
    const res = await apiFetch(API.BILLING, `/api/billing/subscription/${tenantId}/resume`, {
      method: "POST",
    });
    if (res.ok) refetchAll();
  }, [tenantId, refetchAll]);

  const forbidden = (subscriptionQuery.error as any)?.status === 403;
  const networkErr =
    !forbidden && (subscriptionQuery.isError || entitlementsQuery.isError || invoicesQuery.isError);
  const loading = subscriptionQuery.isLoading && !subscription;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: hPad,
        alignItems: "center",
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={colors.primary} />
      }
    >
      <View style={{ width: contentWidth }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>

        <Text style={styles.title}>{t("parentBilling.title")}</Text>
        <Text style={styles.subtitle}>{t("parentBilling.subtitle")}</Text>

        {forbidden && (
          <AivoCard style={styles.errorCard}>
            <Text style={styles.errorText}>{t("parentBilling.accessDenied")}</Text>
          </AivoCard>
        )}

        {networkErr && !forbidden && (
          <AivoCard style={styles.errorCard}>
            <Text style={styles.errorText}>{t("parentBilling.networkError")}</Text>
            <AivoButton
              title={t("parentBilling.retry")}
              onPress={refetchAll}
              size="sm"
              style={{ marginTop: spacing.sm }}
            />
          </AivoCard>
        )}

        {loading && <BillingSkeleton />}

        {!loading && !forbidden && !networkErr && (
          <>
            {paymentFailed && (
              <AivoCard style={styles.paymentFailedCard}>
                <Text style={styles.paymentFailedText}>
                  {t("parentBilling.paymentFailedWarning")}
                </Text>
                <AivoButton
                  title={portalLoading ? "..." : t("parentBilling.updatePaymentMethod")}
                  onPress={openPortal}
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                />
              </AivoCard>
            )}

            {incomplete && !paymentFailed && (
              <AivoCard style={styles.incompleteCard}>
                <Text style={styles.incompleteText}>
                  {subscription?.status === "incomplete_expired"
                    ? "Your previous checkout expired before payment was confirmed."
                    : "Your subscription is waiting for payment confirmation."}
                </Text>
                <AivoButton
                  title={t("parentBilling.switchPlan")}
                  onPress={() => startCheckout(currentPlanId, subscription?.plan ?? "family")}
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                />
              </AivoCard>
            )}

            {trialDays !== null && (
              <AivoCard style={styles.trialCard}>
                <Text style={styles.trialText}>
                  {trialDays === 0
                    ? t("parentBilling.trialEndsToday")
                    : trialDays === 1
                      ? t("parentBilling.trialEndsTomorrow")
                      : t("parentBilling.trialEndsInDays", { days: trialDays })}
                </Text>
              </AivoCard>
            )}

            {/* Summary row */}
            <View style={styles.summaryRow}>
              <View style={styles.statusPill}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: statusColor(
                        subscription?.status ?? "inactive",
                        !!subscription?.cancelAtPeriodEnd,
                      ),
                    },
                  ]}
                />
                <Text style={styles.statusLabel}>
                  {statusLabel(
                    t as (k: string) => string,
                    subscription?.status ?? "inactive",
                    !!subscription?.cancelAtPeriodEnd,
                  )}
                </Text>
              </View>
              {subscription?.cancelAtPeriodEnd && (
                <Pressable accessibilityRole="button" onPress={handleResume}>
                  <Text style={styles.linkText}>{t("parentBilling.resumeSubscription")}</Text>
                </Pressable>
              )}
            </View>

            {/* Plans */}
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isSwitching = checkoutLoading === plan.id;
              return (
                <AivoCard key={plan.id} style={[styles.planCard, isCurrent && styles.planCurrent]}>
                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentText}>{t("parentBilling.currentPlan")}</Text>
                    </View>
                  )}
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>
                      {plan.price === 0 ? plan.priceLabel || "$0" : `$${plan.price}`}
                    </Text>
                    <Text style={styles.planPeriod}>
                      {plan.price > 0 ? `/${plan.interval}` : ""}
                    </Text>
                  </View>
                  {plan.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                  {!isCurrent &&
                    (isSwitching ? (
                      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
                    ) : (
                      <AivoButton
                        title={
                          plan.id === "enterprise" || plan.id === "district"
                            ? t("parentBilling.contactSales")
                            : t("parentBilling.switchPlan")
                        }
                        onPress={() => startCheckout(plan.id, plan.name)}
                        variant="outline"
                        size="sm"
                        style={{ marginTop: spacing.md }}
                      />
                    ))}
                </AivoCard>
              );
            })}

            {/* Payment method */}
            <Text
              style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}
            >
              {t("parentBilling.paymentMethod")}
            </Text>
            <AivoCard>
              <View style={styles.paymentRow}>
                <Ionicons name="card" size={24} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  {subscription?.paymentMethod?.last4 ? (
                    <>
                      <Text style={styles.cardNumber}>
                        {capitalize(subscription.paymentMethod.brand ?? "Card")} ending{" "}
                        {subscription.paymentMethod.last4}
                      </Text>
                      <Text style={styles.cardExpiry}>{t("parentBilling.manageBilling")}</Text>
                    </>
                  ) : subscription?.hasStripeCustomer ? (
                    <Text style={styles.cardNumber}>{t("parentBilling.noPaymentMethod")}</Text>
                  ) : (
                    <Text style={styles.cardNumber}>Subscribe to a paid plan to add a card.</Text>
                  )}
                </View>
              </View>
              {subscription?.hasStripeCustomer && (
                <AivoButton
                  title={portalLoading ? "..." : t("parentBilling.manageBilling")}
                  onPress={openPortal}
                  size="sm"
                  style={{ marginTop: spacing.sm }}
                />
              )}
            </AivoCard>

            {/* Tutors — all included on every plan (no add-ons). */}
            <Text
              style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}
            >
              {t("parentBilling.tutorAddons")}
            </Text>
            <AivoCard style={styles.tutorRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.featureText, { flex: 1, marginLeft: spacing.sm }]}>
                {t("parentBilling.allTutorsIncluded")}
              </Text>
            </AivoCard>

            {/* Invoice list */}
            <Text
              style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}
            >
              {t("parentBilling.invoiceHistory")}
            </Text>
            {invoices.length === 0 ? (
              <AivoCard>
                <Text style={styles.mutedText}>{t("parentBilling.noInvoices")}</Text>
              </AivoCard>
            ) : (
              invoices.map((inv) => (
                <AivoCard key={inv.id} style={styles.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceDate}>
                      {inv.date ? new Date(inv.date).toLocaleDateString() : "--"}
                    </Text>
                    <Text style={styles.invoiceStatus}>{inv.status}</Text>
                  </View>
                  <Text style={styles.invoiceAmount}>${inv.amount.toFixed(2)}</Text>
                  {inv.url && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("parentBilling.openInvoice", "Open invoice")}
                      onPress={() => WebBrowser.openBrowserAsync(inv.url!)}
                      style={{ marginLeft: spacing.sm }}
                    >
                      <Ionicons name="open-outline" size={18} color={colors.primary} />
                    </Pressable>
                  )}
                </AivoCard>
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.card,
    borderRadius: radius.full,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontFamily: "Nunito-Bold", color: colors.text },
  linkText: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.primary },
  planCard: { marginBottom: spacing.md },
  planCurrent: { borderWidth: 2, borderColor: colors.primary },
  currentBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  currentText: { fontSize: 11, fontFamily: "Nunito-Bold", color: "#FFF" },
  planName: { fontSize: 18, fontFamily: "Nunito-ExtraBold", color: colors.text },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4, marginBottom: 12 },
  planPrice: { fontSize: 28, fontFamily: "Nunito-ExtraBold", color: colors.primary },
  planPeriod: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginLeft: 4,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  featureText: { fontSize: 14, fontFamily: "Nunito-Regular", color: colors.text },
  sectionTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  paymentRow: { flexDirection: "row", alignItems: "center" },
  cardNumber: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  cardExpiry: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  paymentFailedCard: { marginBottom: spacing.md, borderWidth: 2, borderColor: colors.error },
  paymentFailedText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.error },
  incompleteCard: { marginBottom: spacing.md, borderWidth: 2, borderColor: colors.primary },
  incompleteText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.primary },
  trialCard: { marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary },
  trialText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.primary },
  tutorRow: {
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tutorInfo: { flex: 1 },
  tutorName: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  tutorDomain: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  includedTag: { fontSize: 12, fontFamily: "Nunito-Bold", color: colors.textSecondary },
  invoiceRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs },
  invoiceDate: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
  invoiceStatus: {
    fontSize: 11,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  invoiceAmount: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  mutedText: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  errorCard: { marginBottom: spacing.md, borderWidth: 2, borderColor: colors.error },
  errorText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.error },
  skeletonCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    opacity: 0.6,
  },
});
