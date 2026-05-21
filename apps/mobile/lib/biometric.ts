import { Platform } from "react-native";

/**
 * Biometric unlock helper.
 *
 * Layered on top of identity-svc's password / refresh-token auth as a
 * device-local accelerator: once the user has signed in once on this
 * device, opting in lets them re-enter the app via Face ID / Touch ID /
 * fingerprint instead of typing their password again.
 *
 * Trust model:
 *   - The biometric prompt is purely a *device* check. The server never
 *     learns anything about it.
 *   - We never store the user's password. The unlock token re-used
 *     across biometric sessions is the same short-lived JWT identity-svc
 *     issued at the last password / Google / MFA login.
 *   - When biometrics is enabled, the access token is *additionally*
 *     stored under a SecureStore item that requires authentication on
 *     read (`requireAuthentication: true`). That means even if a thief
 *     bypasses the JS layer, they still need to satisfy the OS-level
 *     keychain ACL to extract the token.
 *   - We also stash the user's `email` so the login screen can show
 *     "Unlock as <email>" instead of a bare button.
 *
 * Module loading:
 *   - `expo-local-authentication` and `expo-secure-store` are only
 *     `require()`d on native to avoid pulling them into the web bundle.
 *   - On web the entire surface is a no-op (`isBiometricAvailable`
 *     returns false), so callers can safely invoke these helpers
 *     unconditionally — they'll just decline gracefully.
 */

// Storage keys. The "_protected" suffix marks the token copy that lives
// behind the OS authentication gate; the plain copy in `aivo_access_token`
// is left untouched so non-biometric flows keep working.
const BIOMETRIC_ENABLED_KEY = "aivo_biometric_enabled";
const BIOMETRIC_EMAIL_KEY = "aivo_biometric_email";
const BIOMETRIC_TOKEN_KEY = "aivo_access_token_protected";

type SecureStoreModule = typeof import("expo-secure-store");
type LocalAuthModule = typeof import("expo-local-authentication");

let SecureStore: SecureStoreModule | null = null;
let LocalAuth: LocalAuthModule | null = null;

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SecureStore = require("expo-secure-store");
  } catch {
    SecureStore = null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LocalAuth = require("expo-local-authentication");
  } catch {
    // expo-local-authentication isn't installed in this build — every
    // helper below short-circuits to "not available" rather than throw.
    LocalAuth = null;
  }
}

export type BiometricSupport = {
  available: boolean;
  enrolled: boolean;
  /**
   * Human label for the prompt, e.g. "Face ID", "Touch ID",
   * "Fingerprint". May be empty when nothing is enrolled.
   */
  label: string;
};

/**
 * Reports what's available on this device, without prompting.
 * Cheap to call; safe to render on every mount.
 */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (!LocalAuth) {
    return { available: false, enrolled: false, label: "" };
  }
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuth.hasHardwareAsync(),
      LocalAuth.isEnrolledAsync(),
      LocalAuth.supportedAuthenticationTypesAsync(),
    ]);
    let label = "";
    if (types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION)) {
      label = Platform.OS === "ios" ? "Face ID" : "Face Unlock";
    } else if (types.includes(LocalAuth.AuthenticationType.FINGERPRINT)) {
      label = Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
    } else if (types.includes(LocalAuth.AuthenticationType.IRIS)) {
      label = "Iris";
    }
    return { available: !!hasHardware, enrolled: !!isEnrolled, label };
  } catch {
    return { available: false, enrolled: false, label: "" };
  }
}

/**
 * Has the user opted in *and* do we have a stored token ready to unlock?
 * The login screen uses this to decide whether to render the "Unlock"
 * button alongside the password fields.
 */
export async function isBiometricUnlockArmed(): Promise<{
  armed: boolean;
  email: string | null;
}> {
  if (!SecureStore || !LocalAuth) return { armed: false, email: null };
  try {
    const flag = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    if (flag !== "1") return { armed: false, email: null };
    const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
    return { armed: true, email: email ?? null };
  } catch {
    return { armed: false, email: null };
  }
}

/**
 * Prompt for biometrics. Returns true on success, false on cancel /
 * lockout / unavailable. Never throws.
 *
 * `reason` is shown by the OS prompt (Face ID dialog title on iOS, the
 * subtitle on Android).
 */
export async function promptBiometric(reason: string): Promise<boolean> {
  if (!LocalAuth) return false;
  const support = await getBiometricSupport();
  if (!support.available || !support.enrolled) return false;
  try {
    const result = await LocalAuth.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return !!result.success;
  } catch {
    return false;
  }
}

/**
 * Enable biometric unlock for the currently signed-in user. Caller
 * passes the access token they want to gate behind the biometric
 * prompt; we write it to SecureStore with `requireAuthentication: true`
 * after first verifying the user can actually pass a biometric prompt
 * (so we don't enroll a device that can't unlock itself).
 *
 * Returns true on success.
 */
export async function enableBiometricUnlock(args: {
  accessToken: string;
  email: string;
}): Promise<{ enabled: boolean; reason?: string }> {
  if (!SecureStore || !LocalAuth) {
    return { enabled: false, reason: "unsupported" };
  }
  const support = await getBiometricSupport();
  if (!support.available) return { enabled: false, reason: "no_hardware" };
  if (!support.enrolled) return { enabled: false, reason: "not_enrolled" };

  const ok = await promptBiometric(`Confirm to enable ${support.label} unlock`);
  if (!ok) return { enabled: false, reason: "cancelled" };

  try {
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, args.accessToken, {
      // Require an OS-level auth check whenever this item is read back.
      // On iOS this binds the item to the device passcode + the
      // currently enrolled biometric set; resetting biometrics
      // invalidates the entry, which is the safe default.
      requireAuthentication: true,
      authenticationPrompt: `Unlock AIVO with ${support.label}`,
    });
    await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, args.email);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "1");
    return { enabled: true };
  } catch {
    return { enabled: false, reason: "store_failed" };
  }
}

/**
 * Forget the biometric token + opt-in flag. Called from settings, from
 * logout, and on auth failures (so a stale token can't keep unlocking
 * after the server invalidated the session).
 */
export async function disableBiometricUnlock(): Promise<void> {
  if (!SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
  } catch {
    /* item may not exist */
  }
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
  } catch {
    /* ignore */
  }
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Prompt for biometrics, then return the stored access token on
 * success. Returns null if the user is not enrolled, cancels, the
 * token has been wiped, or the OS keychain ACL refuses the read.
 *
 * The caller (login screen) is responsible for handing the returned
 * token back to `setToken` and re-priming the auth state — so that
 * a fresh `apiFetch` can refresh-and-retry if the token is now stale.
 */
export async function tryBiometricUnlock(): Promise<string | null> {
  if (!SecureStore || !LocalAuth) return null;
  const { armed } = await isBiometricUnlockArmed();
  if (!armed) return null;
  const support = await getBiometricSupport();
  if (!support.available || !support.enrolled) return null;
  try {
    const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY, {
      requireAuthentication: true,
      authenticationPrompt: `Unlock AIVO with ${support.label}`,
    });
    return token && token.length > 0 ? token : null;
  } catch {
    return null;
  }
}
