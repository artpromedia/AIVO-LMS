import { cookies } from "next/headers";
import {
  TYPEFACE_COOKIE,
  TYPEFACE_DEFAULT,
  resolveTypeface,
  type Typeface,
  REDUCED_MOTION_COOKIE,
  REDUCED_MOTION_DEFAULT,
  resolveReducedMotion,
  type ReducedMotion,
} from "./typeface";

/**
 * SSR readers for the a11y prefs that need to land on `<html>` before
 * the first paint. Called once from `app/layout.tsx`.
 */
export async function readTypefaceFromCookies(): Promise<Typeface> {
  const store = await cookies();
  return resolveTypeface(store.get(TYPEFACE_COOKIE)?.value ?? TYPEFACE_DEFAULT);
}

export async function readReducedMotionFromCookies(): Promise<ReducedMotion> {
  const store = await cookies();
  return resolveReducedMotion(store.get(REDUCED_MOTION_COOKIE)?.value ?? REDUCED_MOTION_DEFAULT);
}
