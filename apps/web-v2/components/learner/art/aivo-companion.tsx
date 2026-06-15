/**
 * AivoCompanion — the AIVO Virtual Brain robot, ported from the public
 * landing page (HomeHeroDevice) into the learner Stage as a persistent,
 * brand-level COMPANION.
 *
 * This is the friendly AIVO mascot that accompanies the learner through a
 * session. It is intentionally distinct from the 14 subject tutors (whose
 * own identities are preserved elsewhere) — the robot is the constant AIVO
 * presence shared across web and mobile for brand consistency.
 *
 * Purely decorative (`aria-hidden`): every instruction and message is
 * carried by real text + SR-labelled UI around it. The idle float lives in
 * CSS (`app/learner-experience.css`, `.aivo-companion-float`), which is
 * already slowed under Calm, frozen under high-contrast, and removed under
 * `prefers-reduced-motion`. The `motionOff` prop drops the class entirely so
 * a vestibular-hyper sensory profile gets a fully static figure too.
 */
import Image from "next/image";

const ROBOT_SRC = "/images/mascot/virtual-brain-robot.png";

export function AivoCompanion({
  size = 112,
  motionOff = false,
  className,
}: {
  /** Rendered width/height in px (square). */
  size?: number;
  /** When true, no idle animation is applied. */
  motionOff?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className ?? ""}`}
    >
      <Image
        src={ROBOT_SRC}
        alt=""
        width={size}
        height={size}
        className={`drop-shadow-[0_20px_30px_rgba(76,29,149,0.30)] ${
          motionOff ? "" : "aivo-companion-float"
        }`}
        style={{ width: size, height: size }}
        priority={false}
      />
    </div>
  );
}
