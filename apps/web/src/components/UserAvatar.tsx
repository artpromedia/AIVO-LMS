"use client";
import Image from "next/image";

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  /**
   * Optional cache-buster appended to the image URL. Useful right after a
   * successful upload so the new photo replaces the old one immediately
   * without waiting for the browser cache to expire.
   */
  bust?: string | number;
}

function initialFor(name?: string | null) {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export function UserAvatar({ avatarUrl, name, size = 32, className = "", bust }: UserAvatarProps) {
  const dim = size;
  const fontPx = Math.max(10, Math.round(size * 0.4));
  const wrapperBase =
    "relative inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0";

  if (avatarUrl) {
    const src = bust ? `${avatarUrl}?v=${encodeURIComponent(String(bust))}` : avatarUrl;
    return (
      <span className={`${wrapperBase} ${className}`} style={{ width: dim, height: dim }}>
        <Image
          src={src}
          alt={name ? `${name} profile photo` : "Profile photo"}
          width={dim}
          height={dim}
          unoptimized
          style={{ objectFit: "cover", width: dim, height: dim }}
        />
      </span>
    );
  }

  return (
    <span
      className={`${wrapperBase} bg-[hsl(var(--visual-primary))] text-white font-bold ${className}`}
      style={{ width: dim, height: dim, fontSize: fontPx }}
      aria-label={name ? `${name} profile placeholder` : "Profile placeholder"}
    >
      {initialFor(name)}
    </span>
  );
}

export default UserAvatar;
