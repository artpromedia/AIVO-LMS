/**
 * Remembered family roster (device-local).
 *
 * The learner login surface needs to show a parent's learner profiles
 * *before* anyone is authenticated — but `GET /api/users/learners`
 * requires the parent's token, so a cold-started app can't fetch it.
 *
 * To bridge that gap we cache a lightweight snapshot of the family the
 * last time a parent was signed in (written from the parent layout).
 * The learner-login screen reads it so a parent can hand the device to
 * a child, tap their face, and go straight to the PIN pad without the
 * parent re-entering their email. A live parent session always takes
 * precedence — the cache is only a fallback for the unauthenticated
 * cold-start path.
 *
 * Why SecureStore: the snapshot contains children's names (mild PII),
 * so we keep it next to the auth tokens rather than in cleartext
 * AsyncStorage. On web we fall back to localStorage to match the other
 * mobile auth helpers (see `pendingDeepLink.ts`).
 */
import { Platform } from "react-native";

const REMEMBERED_FAMILY_KEY = "aivo_remembered_family";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module load on non-web platforms
  SecureStore = require("expo-secure-store");
}

export interface RememberedLearner {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel?: string;
  avatar?: string;
}

export interface RememberedFamily {
  /** identity-svc subject id of the parent account. */
  parentId: string;
  parentName?: string;
  parentEmail?: string;
  learners: RememberedLearner[];
  /** epoch ms — lets a caller age out a stale roster if it wants to. */
  savedAt: number;
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(REMEMBERED_FAMILY_KEY);
    } catch {
      return null;
    }
  }
  return SecureStore!.getItemAsync(REMEMBERED_FAMILY_KEY);
}

export async function setRememberedFamily(family: RememberedFamily): Promise<void> {
  // Nothing to remember (and nothing the learner could tap) if there are
  // no learners — skip the write so we don't persist an empty roster.
  if (!family.parentId || family.learners.length === 0) return;
  const payload = JSON.stringify(family);
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(REMEMBERED_FAMILY_KEY, payload);
    } catch {}
    return;
  }
  await SecureStore!.setItemAsync(REMEMBERED_FAMILY_KEY, payload);
}

export async function getRememberedFamily(): Promise<RememberedFamily | null> {
  const raw = await readRaw();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RememberedFamily;
    if (!parsed?.parentId || !Array.isArray(parsed.learners)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearRememberedFamily(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(REMEMBERED_FAMILY_KEY);
    } catch {}
    return;
  }
  await SecureStore!.deleteItemAsync(REMEMBERED_FAMILY_KEY);
}
