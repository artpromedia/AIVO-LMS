/**
 * Push notifications — delivery handling, token registration, tap routing
 * (Sprint A6).
 *
 * The permission priming screen and the comms-svc backend (fan-out via
 * /api/comms/push, registration at /api/comms/devices with FCM/APNs token
 * pruning) already existed; nothing on the device handled delivery or
 * taps. This module completes the loop:
 *
 *   - configureNotificationHandling(): foreground presentation + the tap
 *     listener that routes via expo-router. Cold-start taps are replayed
 *     from getLastNotificationResponseAsync.
 *   - registerPushToken(): NATIVE device token (APNs on iOS, FCM on
 *     Android — matching comms-svc's kind enum) posted to
 *     /api/comms/devices after login; remembered so logout can revoke.
 *   - unregisterPushToken(): DELETE on logout / token rotation.
 *
 * Notification payloads carry `data.path` — a same-app route allowlisted
 * against the deep-link prefixes app.json already declares. Anything else
 * falls back to the root so a malformed payload can never route outside
 * the app's own surfaces.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";
import { Sentry } from "@/lib/sentry";

const PUSH_TOKEN_KEY = "aivo_push_token_v1";

/** Same prefixes as app.json's deep-link intent filters. */
const ALLOWED_PATH_PREFIXES = [
  "/learner",
  "/parent",
  "/teacher",
  "/therapist",
  "/caregiver",
  "/notifications",
  "/messages",
  "/settings",
  "/billing",
  "/role-switch",
];

export function routeFromNotification(data: unknown): string {
  const path =
    data && typeof data === "object" && typeof (data as { path?: unknown }).path === "string"
      ? ((data as { path: string }).path as string)
      : null;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return "/";
  }
  return ALLOWED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    ? path
    : "/";
}

function handleResponse(response: Notifications.NotificationResponse | null): void {
  if (!response) return;
  const target = routeFromNotification(response.notification.request.content.data);
  // replace (not push) so a cold-start tap doesn't stack a dead back-entry.
  router.replace(target as never);
}

/** Install foreground presentation + tap routing. Call once at app root. */
export function configureNotificationHandling(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
  // Cold start: the tap that LAUNCHED the app is not re-delivered to the
  // listener — replay it once the router is mounted.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => handleResponse(response))
    .catch(() => undefined);
  return () => sub.remove();
}

/** Register the native device token with comms-svc. Call after login. */
export async function registerPushToken(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return; // priming screen owns the ask
    const native = await Notifications.getDevicePushTokenAsync();
    const token = typeof native.data === "string" ? native.data : JSON.stringify(native.data);
    const kind = Platform.OS === "ios" ? "apns" : "fcm";
    const res = await apiFetch(API.COMMS, "/api/comms/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, kind, platform: Platform.OS }),
    });
    if (res.ok) {
      await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token).catch(() => undefined);
    }
  } catch (error) {
    // Push is additive — never block login on it, but never lose the signal.
    Sentry.captureException(error);
  }
}

/** Revoke this device's token. Call on logout. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY).catch(() => null);
    if (!token) return;
    await apiFetch(API.COMMS, `/api/comms/devices/${encodeURIComponent(token)}`, {
      method: "DELETE",
    });
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => undefined);
  } catch (error) {
    Sentry.captureException(error);
  }
}
