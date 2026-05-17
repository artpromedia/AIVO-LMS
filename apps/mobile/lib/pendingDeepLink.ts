/**
 * Cross-auth-boundary deep-link target.
 *
 * The web app threads its post-auth redirect through the URL (the
 * accept-invite page links to `/login?redirect=/accept-invite?email=…`,
 * and the login page honors the `redirect` param). The mobile login
 * screen has no equivalent param, so when an unauthenticated user lands
 * on a deep link that requires auth we instead persist the target href
 * and consume it in `app/index.tsx` after the session is established.
 *
 * Why SecureStore: the auth tokens already live there, and the
 * `aivo://accept-invite?email=…` link contains an email address that
 * we'd rather not write to AsyncStorage / localStorage in the clear.
 * On web this falls back to localStorage to match the rest of the
 * mobile auth helpers.
 */
import { Platform } from 'react-native';

const PENDING_DEEP_LINK_KEY = 'aivo_pending_deep_link';

let SecureStore: typeof import('expo-secure-store') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module load on non-web platforms
  SecureStore = require('expo-secure-store');
}

export async function setPendingDeepLink(href: string): Promise<void> {
  if (!href) return;
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(PENDING_DEEP_LINK_KEY, href);
    } catch {}
    return;
  }
  await SecureStore!.setItemAsync(PENDING_DEEP_LINK_KEY, href);
}

export async function getPendingDeepLink(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(PENDING_DEEP_LINK_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore!.getItemAsync(PENDING_DEEP_LINK_KEY);
}

export async function clearPendingDeepLink(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(PENDING_DEEP_LINK_KEY);
    } catch {}
    return;
  }
  await SecureStore!.deleteItemAsync(PENDING_DEEP_LINK_KEY);
}
