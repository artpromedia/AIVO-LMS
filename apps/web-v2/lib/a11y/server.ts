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
  SPACING_COOKIE,
  SPACING_DEFAULT,
  resolveSpacing,
  type Spacing,
  SOUND_COOKIE,
  SOUND_DEFAULT,
  resolveSound,
  type SoundLevel,
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

export async function readSpacingFromCookies(): Promise<Spacing> {
  const store = await cookies();
  return resolveSpacing(store.get(SPACING_COOKIE)?.value ?? SPACING_DEFAULT);
}

export async function readSoundFromCookies(): Promise<SoundLevel> {
  const store = await cookies();
  return resolveSound(store.get(SOUND_COOKIE)?.value ?? SOUND_DEFAULT);
}
