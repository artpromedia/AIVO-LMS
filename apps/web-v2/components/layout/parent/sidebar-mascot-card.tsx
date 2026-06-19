import Image from "next/image";
import styles from "./parent-chrome.module.css";

/**
 * Sidebar "You're doing amazing!" card (ParentApp.dc.html sidebar) — the
 * lavender encouragement card with the sitting mascot. Copy is keyed/localized
 * by the caller; the learner name is real.
 */
export function SidebarMascotCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      className={`${styles.mascotCard} mt-4 overflow-hidden rounded-iw-card px-3.5 pb-0 pt-3.5 text-center`}
    >
      <p className="font-iw-display text-sm font-bold text-iw-text-strong">{title}</p>
      <p className="mt-1 text-xs leading-snug text-iw-text-muted">{body}</p>
      <Image
        src="/images/mascots/mascot-sit.png"
        alt=""
        width={110}
        height={110}
        className="mx-auto -mb-1 mt-1 block h-auto w-[110px]"
      />
    </div>
  );
}
