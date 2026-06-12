"use server";

import { cookies } from "next/headers";
import {
  TYPEFACE_COOKIE,
  resolveTypeface,
  REDUCED_MOTION_COOKIE,
  resolveReducedMotion,
  SPACING_COOKIE,
  resolveSpacing,
  SOUND_COOKIE,
  resolveSound,
} from "./typeface";
import { WORKSPACE_THEME_COOKIE, resolveWorkspaceTheme } from "@/lib/learner/workspace-themes";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setTypefaceCookie(v: string): Promise<void> {
  const resolved = resolveTypeface(v);
  const store = await cookies();
  store.set(TYPEFACE_COOKIE, resolved, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function setReducedMotionCookie(v: string): Promise<void> {
  const resolved = resolveReducedMotion(v);
  const store = await cookies();
  store.set(REDUCED_MOTION_COOKIE, resolved, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function setSpacingCookie(v: string): Promise<void> {
  const resolved = resolveSpacing(v);
  const store = await cookies();
  store.set(SPACING_COOKIE, resolved, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function setSoundCookie(v: string): Promise<void> {
  const resolved = resolveSound(v);
  const store = await cookies();
  store.set(SOUND_COOKIE, resolved, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function setWorkspaceThemeCookie(v: string): Promise<void> {
  const resolved = resolveWorkspaceTheme(v);
  const store = await cookies();
  store.set(WORKSPACE_THEME_COOKIE, resolved, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}
